from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from organizations.models import Organization
from teams.models import Team, TeamMembership

from .models import Mission, MissionAssignment, MissionUpdate


@transaction.atomic
def assign_mission_to_team(mission, team, assigned_by, assignment_note=""):
    if not assigned_by.is_active or not assigned_by.is_superuser:
        raise PermissionDenied("Only an active Super Admin can assign or reassign a mission.")
    if (
        not team.is_active
        or not team.organization.is_active
        or team.organization.registration_status != Organization.RegistrationStatus.APPROVED
    ):
        raise ValidationError("The team must belong to an approved, active organization.")
    if mission.help_request.verification_status != "verified":
        raise ValidationError("Only a verified help request can be assigned.")
    if mission.status in {Mission.Status.DONE, Mission.Status.CANCELLED}:
        raise ValidationError("A completed or cancelled mission cannot be reassigned.")
    leader = TeamMembership.objects.filter(
        team=team, status=TeamMembership.Status.ACTIVE, role=TeamMembership.Role.LEADER
    ).select_related("volunteer__user").first()
    if not leader:
        raise ValidationError("The selected team needs an active leader before assignment.")
    if MissionAssignment.objects.filter(team=team, is_active=True).exclude(mission=mission).exists():
        raise ValidationError("The selected team already has an active mission.")

    now = timezone.now()
    MissionAssignment.objects.filter(mission=mission, is_active=True).update(
        is_active=False, ended_at=now, updated_at=now
    )
    assignment = MissionAssignment.objects.create(
        mission=mission,
        team=team,
        assigned_team_leader=leader.volunteer.user,
        assigned_by=assigned_by,
        assignment_note=assignment_note,
        assigned_at=now,
    )
    mission.status = Mission.Status.ASSIGNED
    mission.save(update_fields=["status", "updated_at"])
    MissionUpdate.objects.create(
        mission=mission,
        actor=assigned_by,
        status=Mission.Status.ASSIGNED,
        note=assignment_note or "Mission assigned by Super Admin.",
    )
    return assignment


@transaction.atomic
def record_mission_update(mission, actor, status, note=""):
    if not actor.is_active:
        raise PermissionDenied("An active account is required.")
    is_super_admin = actor.is_superuser
    active_assignment = mission.assignments.filter(is_active=True).first()
    is_assigned_leader = bool(active_assignment and active_assignment.assigned_team_leader_id == actor.id)
    if not (is_super_admin or is_assigned_leader):
        raise PermissionDenied("Only the assigned team leader or a Super Admin may update mission progress.")

    previous_status = mission.status
    if status in {Mission.Status.CANCELLED, Mission.Status.FAILED}:
        if not is_super_admin:
            raise PermissionDenied("Only a Super Admin can cancel or fail a mission.")
        allowed = (
            {Mission.Status.CANCELLED, Mission.Status.FAILED}
            if previous_status not in {Mission.Status.DONE, Mission.Status.CANCELLED, Mission.Status.FAILED}
            else set()
        )
    elif is_super_admin:
        raise PermissionDenied("Only the assigned team leader can report mission progress.")
    elif status == Mission.Status.PROBLEM:
        allowed = {Mission.Status.ASSIGNED, Mission.Status.ACKNOWLEDGED, Mission.Status.ONGOING}
    elif previous_status == Mission.Status.PROBLEM:
        previous_update = mission.updates.exclude(status=Mission.Status.PROBLEM).order_by("-created_at", "-id").first()
        allowed = {previous_update.status} if previous_update else set()
    else:
        allowed = {
            Mission.Status.AWAITING_ASSIGNMENT: set(),
            Mission.Status.ASSIGNED: {Mission.Status.ACKNOWLEDGED},
            Mission.Status.ACKNOWLEDGED: {Mission.Status.ONGOING},
            Mission.Status.ONGOING: {Mission.Status.DONE},
            Mission.Status.DONE: set(),
            Mission.Status.CANCELLED: set(),
            Mission.Status.FAILED: set(),
        }.get(previous_status, set())
    if status not in allowed:
        raise ValidationError(f"Mission cannot move from {previous_status} to {status}.")
    if status in {Mission.Status.PROBLEM, Mission.Status.DONE, Mission.Status.FAILED} and not note.strip():
        raise ValidationError("Add a note when reporting a problem or closing a mission.")

    mission.status = status
    mission.save(update_fields=["status", "updated_at"])
    update = MissionUpdate.objects.create(mission=mission, actor=actor, status=status, note=note.strip())
    if status in {Mission.Status.DONE, Mission.Status.CANCELLED, Mission.Status.FAILED}:
        MissionAssignment.objects.filter(mission=mission, is_active=True).update(
            is_active=False, ended_at=timezone.now(), updated_at=timezone.now()
        )
    return update
