from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from organizations.models import Organization
from teams.models import Team, TeamMembership

from .models import Mission, MissionAssignment, MissionUpdate


def team_suitability(team, help_request, current_mission=None):
    """Return a deterministic suitability result for one team and request."""
    reasons = []
    score = 0

    exact_area = team.service_upazilas.filter(pk=help_request.upazila_id).exists()
    district_area = team.service_districts.filter(pk=help_request.district_id).exists()
    if exact_area:
        score += 50
        reasons.append("Area match: exact upazila.")
    elif district_area:
        score += 30
        reasons.append("Area match: district service area.")
    else:
        reasons.append("Not eligible: no operating area matches this request.")

    if team.availability == Team.Availability.READY:
        score += 20
        reasons.append("Availability: ready.")
    elif team.availability == Team.Availability.LIMITED:
        score += 10
        reasons.append("Availability: limited capacity.")
    else:
        reasons.append("Not eligible: team is unavailable.")

    requested_ids = set(help_request.assistance_categories.values_list("pk", flat=True))
    capability_ids = set(team.capabilities.filter(is_active=True).values_list("pk", flat=True))
    matches = len(requested_ids & capability_ids)
    if matches:
        score += round(20 * matches / max(len(requested_ids), 1))
        reasons.append(f"Capability match: supports {matches} of {len(requested_ids)} requested categories.")
    else:
        reasons.append("Not eligible: no requested category matches team capabilities.")

    leader = TeamMembership.objects.filter(
        team=team,
        status=TeamMembership.Status.ACTIVE,
        role=TeamMembership.Role.LEADER,
        volunteer__user__is_active=True,
        volunteer__organization_memberships__organization_id=team.organization_id,
        volunteer__organization_memberships__status="active",
    ).select_related("volunteer__user").first()
    if leader:
        score += 10
        reasons.append("Leadership: active team leader is assigned.")
    else:
        reasons.append("Not eligible: team needs an active organization member as leader.")

    workload = MissionAssignment.objects.filter(team=team, is_active=True)
    if current_mission:
        workload = workload.exclude(mission=current_mission)
    if workload.exists():
        reasons.append("Not eligible: team already has an active mission.")
    else:
        score += 10
        reasons.append("Workload: no active missions.")

    organization_ready = bool(
        team.is_active
        and team.organization.is_active
        and team.organization.registration_status == Organization.RegistrationStatus.APPROVED
    )
    if organization_ready:
        score += 10
        reasons.append("Organization: approved and active.")
    else:
        reasons.append("Not eligible: organization or team is not active and approved.")

    eligible = not any(reason.startswith("Not eligible:") for reason in reasons)
    return {"eligible": eligible, "score": score, "reasons": reasons, "leader": leader}


def _close_active_assignment(mission, now):
    MissionAssignment.objects.filter(mission=mission, is_active=True).update(
        is_active=False, ended_at=now, updated_at=now
    )


@transaction.atomic
def assign_mission_to_team(mission, team, assigned_by, assignment_note=""):
    if not assigned_by.is_active or not assigned_by.is_superuser:
        raise PermissionDenied("Only an active Super Admin can assign or reassign a mission.")
    mission = Mission.objects.select_for_update().select_related(
        "help_request__district", "help_request__upazila"
    ).get(pk=mission.pk)
    team = Team.objects.select_for_update().select_related("organization").get(pk=team.pk)
    if mission.help_request.verification_status != "verified":
        raise ValidationError("Only a verified help request can be assigned.")
    if mission.status not in {Mission.Status.AWAITING_ASSIGNMENT, Mission.Status.FAILED}:
        raise ValidationError("An active mission must be cancelled or failed before it can be reassigned.")
    if MissionAssignment.objects.filter(mission=mission, is_active=True, team=team).exists():
        raise ValidationError("This mission is already assigned to the selected team.")

    suitability = team_suitability(team, mission.help_request)
    if not suitability["eligible"]:
        raise ValidationError(" ".join(reason for reason in suitability["reasons"] if reason.startswith("Not eligible:")))

    has_history = mission.assignments.exists()
    now = timezone.now()
    _close_active_assignment(mission, now)
    assignment = MissionAssignment.objects.create(
        mission=mission,
        team=team,
        assigned_team_leader=suitability["leader"].volunteer.user,
        assigned_by=assigned_by,
        assignment_note=assignment_note.strip(),
        assigned_at=now,
    )
    mission.status = Mission.Status.ASSIGNED
    mission.save(update_fields=["status", "updated_at"])
    MissionUpdate.objects.create(
        mission=mission,
        actor=assigned_by,
        status=Mission.Status.ASSIGNED,
        action="reassigned" if has_history else "assigned",
        note=assignment_note.strip(),
    )
    return assignment


@transaction.atomic
def transition_mission(mission, actor, action, reason=""):
    if not actor.is_active:
        raise PermissionDenied("An active account is required.")
    mission = Mission.objects.select_for_update().get(pk=mission.pk)
    previous = mission.status
    super_admin = actor.is_superuser
    assignment = mission.assignments.filter(is_active=True).select_related("team").first()
    assigned_leader = bool(assignment and assignment.assigned_team_leader_id == actor.pk)
    if not (super_admin or assigned_leader):
        raise PermissionDenied("Only the assigned team leader or a Super Admin may update this mission.")

    leader_actions = {
        "acknowledge", "decline", "start", "progress", "complete", "report_problem", "unable_to_continue",
        "resolve_problem",
    }
    if action in leader_actions and super_admin:
        raise PermissionDenied("Only the assigned team leader can report mission progress.")
    if action in {"cancel", "fail"} and not super_admin:
        raise PermissionDenied("Only a Super Admin can cancel or fail a mission.")

    status_after = previous
    action_note = reason.strip()
    close_assignment = False
    requires_reason = {"decline", "unable_to_continue", "progress", "complete", "report_problem", "resolve_problem", "cancel", "fail"}
    if action in requires_reason and not action_note:
        raise ValidationError("A reason or progress note is required for this action.")

    if action == "acknowledge":
        if super_admin or previous != Mission.Status.ASSIGNED:
            raise ValidationError("Only the assigned leader can acknowledge an assigned mission.")
        status_after = Mission.Status.ACKNOWLEDGED
    elif action == "decline":
        if super_admin or previous != Mission.Status.ASSIGNED:
            raise ValidationError("Only the assigned leader can decline an unacknowledged assignment.")
        status_after = Mission.Status.AWAITING_ASSIGNMENT
        close_assignment = True
    elif action == "start":
        if super_admin or previous != Mission.Status.ACKNOWLEDGED:
            raise ValidationError("Only the assigned leader can start an acknowledged mission.")
        status_after = Mission.Status.ONGOING
    elif action == "progress":
        if super_admin or previous != Mission.Status.ONGOING:
            raise ValidationError("Only the assigned leader can add progress to an ongoing mission.")
    elif action == "complete":
        if super_admin or previous != Mission.Status.ONGOING:
            raise ValidationError("Only the assigned leader can complete an ongoing mission.")
        status_after = Mission.Status.DONE
        close_assignment = True
    elif action == "report_problem":
        if super_admin or previous not in {Mission.Status.ASSIGNED, Mission.Status.ACKNOWLEDGED, Mission.Status.ONGOING}:
            raise ValidationError("The assigned leader can report a problem during an active mission.")
        status_after = Mission.Status.PROBLEM
    elif action == "unable_to_continue":
        if super_admin or previous not in {Mission.Status.ACKNOWLEDGED, Mission.Status.ONGOING, Mission.Status.PROBLEM}:
            raise ValidationError("The assigned leader can report inability to continue after accepting the assignment.")
        status_after = Mission.Status.AWAITING_ASSIGNMENT
        close_assignment = True
    elif action == "resolve_problem":
        if super_admin or previous != Mission.Status.PROBLEM:
            raise ValidationError("Only the assigned leader can resolve a reported problem.")
        prior = mission.updates.exclude(status=Mission.Status.PROBLEM).order_by("-created_at", "-id").first()
        if not prior or prior.status not in {Mission.Status.ASSIGNED, Mission.Status.ACKNOWLEDGED, Mission.Status.ONGOING}:
            raise ValidationError("The previous mission stage could not be restored.")
        status_after = prior.status
    elif action in {"cancel", "fail"}:
        if not super_admin:
            raise PermissionDenied("Only a Super Admin can cancel or fail a mission.")
        if previous in {Mission.Status.DONE, Mission.Status.CANCELLED, Mission.Status.FAILED}:
            raise ValidationError("This mission is already closed.")
        status_after = Mission.Status.CANCELLED if action == "cancel" else Mission.Status.FAILED
        close_assignment = True
    else:
        raise ValidationError("Unknown mission action.")

    mission.status = status_after
    mission.save(update_fields=["status", "updated_at"])
    if close_assignment:
        _close_active_assignment(mission, timezone.now())
    return MissionUpdate.objects.create(
        mission=mission,
        actor=actor,
        status=status_after,
        action=action,
        note=action_note,
    )


@transaction.atomic
def record_mission_update(mission, actor, status, note=""):
    previous = mission.status
    if status == Mission.Status.ACKNOWLEDGED:
        action = "acknowledge"
    elif status == Mission.Status.ONGOING:
        action = (
            "resolve_problem"
            if previous == Mission.Status.PROBLEM
            else "start"
            if previous == Mission.Status.ACKNOWLEDGED
            else "progress"
        )
    elif status == Mission.Status.PROBLEM:
        action = "report_problem"
    elif status == Mission.Status.DONE:
        action = "complete"
    elif status == Mission.Status.CANCELLED:
        action = "cancel"
    elif status == Mission.Status.FAILED:
        action = "fail"
    else:
        raise ValidationError(f"Mission cannot move from {previous} to {status}.")
    return transition_mission(mission, actor, action, note)
