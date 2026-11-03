from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from Sara.domain import TimestampedModel, Priority, ACTIVE_MISSIONS


class Mission(TimestampedModel):
    class Status(models.TextChoices):
        ASSIGNED = 'assigned', 'নির্ধারিত / Assigned'
        ACCEPTED = 'accepted', 'গৃহীত / Accepted'
        IN_PROGRESS = 'in_progress', 'চলমান / In progress'
        PAUSED = 'paused', 'নতুন নেতার অপেক্ষায় / Awaiting replacement leader'
        COMPLETED = 'completed', 'সম্পন্ন / Completed'
        CANCELLED = 'cancelled', 'বাতিল / Cancelled'
        FAILED = 'failed', 'ব্যর্থ / Failed'

    help_request = models.ForeignKey('requests.HelpRequest', on_delete=models.PROTECT, related_name='missions')
    attempt_number = models.PositiveIntegerField()
    assigned_team = models.ForeignKey('response_teams.VolunteerTeam', on_delete=models.PROTECT, null=True, blank=True, related_name='missions')
    assigned_volunteer = models.ForeignKey('volunteers.VolunteerProfile', on_delete=models.PROTECT, null=True, blank=True, related_name='individual_missions')
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='dispatched_missions')
    supervising_organization = models.ForeignKey('organizations.Organization', on_delete=models.PROTECT, null=True, blank=True, related_name='supervised_missions')
    origin_organization_name = models.CharField(max_length=180, blank=True)
    priority = models.CharField(max_length=10, choices=Priority.choices)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ASSIGNED)
    resume_status = models.CharField(max_length=16, blank=True, null=True, choices=[(x,x) for x in ['assigned','accepted','in_progress']])
    assigned_at = models.DateTimeField(default=timezone.now)
    accepted_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    paused_at = models.DateTimeField(null=True, blank=True)
    pause_reason = models.CharField(max_length=24, blank=True, null=True, choices=[('leader_replacement','নতুন নেতা / Leader replacement')])
    ended_at = models.DateTimeField(null=True, blank=True)
    ended_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='ended_missions')
    end_reason = models.TextField(blank=True)
    all_needs_fulfilled = models.BooleanField(default=False)
    completion_debrief = models.TextField(blank=True)
    delivered_assistance = models.TextField(blank=True)
    issues_encountered = models.TextField(blank=True)
    assigned_roster_snapshot = models.JSONField(default=list, blank=True)
    final_roster_snapshot = models.JSONField(default=list, blank=True)
    assignee_label_snapshot = models.CharField(max_length=180)

    class Meta:
        ordering = ['-assigned_at']
        constraints = [
            models.CheckConstraint(condition=models.Q(attempt_number__gt=0), name='mission_positive_attempt'),
            models.UniqueConstraint(fields=['help_request','attempt_number'], name='request_attempt_unique'),
            models.CheckConstraint(condition=(models.Q(assigned_team__isnull=False,assigned_volunteer__isnull=True) | models.Q(assigned_team__isnull=True,assigned_volunteer__isnull=False)), name='mission_exactly_one_target'),
            models.UniqueConstraint(fields=['help_request'], condition=models.Q(status__in=ACTIVE_MISSIONS), name='one_active_attempt_per_request'),
            models.UniqueConstraint(fields=['assigned_team'], condition=models.Q(status__in=ACTIVE_MISSIONS,assigned_team__isnull=False), name='one_active_mission_per_team'),
            models.UniqueConstraint(fields=['assigned_volunteer'], condition=models.Q(status__in=ACTIVE_MISSIONS,assigned_volunteer__isnull=False), name='one_active_direct_mission'),
            models.CheckConstraint(condition=~models.Q(status='completed') | models.Q(all_needs_fulfilled=True,ended_at__isnull=False,ended_by__isnull=False), name='completed_mission_confirmed'),
            models.CheckConstraint(condition=~models.Q(status__in=['cancelled','failed']) | (models.Q(ended_at__isnull=False,ended_by__isnull=False) & ~models.Q(end_reason='')), name='unsuccessful_mission_has_reason'),
            models.CheckConstraint(condition=~models.Q(status='paused') | models.Q(assigned_team__isnull=False,pause_reason='leader_replacement',resume_status__in=['assigned','accepted','in_progress']), name='paused_mission_replacement'),
            models.CheckConstraint(condition=models.Q(status__in=['assigned','accepted','in_progress','paused','completed','cancelled','failed']), name='mission_status_valid'),
            models.CheckConstraint(condition=models.Q(priority__in=Priority.values), name='mission_priority_valid'),
        ]

    def clean(self):
        if self.status in ['cancelled','failed'] and not self.end_reason.strip():
            raise ValidationError({'end_reason': 'A cancellation/failure reason is required.'})

    @property
    def active(self):
        return self.status in ACTIVE_MISSIONS

    @property
    def target_label(self):
        return self.assignee_label_snapshot

    @property
    def target_type(self):
        return 'team' if self.assigned_team_id else 'individual'

    def __str__(self):
        return f'{self.help_request.reference} · {self.attempt_number}'

# Permissions
from django.core.exceptions import PermissionDenied
from django.db.models import Q

from Sara.domain import Role, ACTIVE_MISSIONS


def visible_missions(user):
    from shara_accounts.models import own_organization
    if not user.is_authenticated or not user.is_active:
        return Mission.objects.none()
    if user.role == Role.SUPER_ADMIN:
        return Mission.objects.all()
    if user.role == Role.ORGANIZATION_ADMIN:
        return Mission.objects.filter(supervising_organization=own_organization(user))
    if user.role != Role.VOLUNTEER or not hasattr(user, 'volunteer_profile'):
        return Mission.objects.none()
    profile = user.volunteer_profile
    current = Q(assigned_volunteer=profile) | Q(assigned_team__memberships__volunteer=profile, assigned_team__memberships__is_active=True)
    historical_ids = []
    # SQLite does not implement JSON-array containment. Snapshots grant safe history only.
    for pk, assigned, final in Mission.objects.exclude(status__in=ACTIVE_MISSIONS).values_list('pk','assigned_roster_snapshot','final_roster_snapshot'):
        if any(row.get('id') == str(profile.pk) for row in assigned + final):
            historical_ids.append(pk)
    return Mission.objects.filter(current | Q(pk__in=historical_ids)).distinct()


def responsible_assignee(user, mission):
    if not user.is_authenticated or user.role != Role.VOLUNTEER:
        return False
    if mission.assigned_volunteer_id:
        return mission.assigned_volunteer.user_id == user.pk
    team = mission.assigned_team
    return bool(team.leader_id and team.leader.user_id == user.pk and team.memberships.filter(volunteer_id=team.leader_id,is_active=True).exists())


def supervising_admin(user, mission):
    if not user.is_authenticated or not user.is_active:
        return False
    if user.role == Role.SUPER_ADMIN:
        return True
    return (user.role == Role.ORGANIZATION_ADMIN and mission.supervising_organization_id is not None
            and mission.supervising_organization.administrator_id == user.pk
            and mission.supervising_organization.verification_status == 'approved')


def private_mission_access(user, mission):
    return mission.active and (supervising_admin(user, mission) or responsible_assignee(user, mission))


def report_access(user, mission):
    return supervising_admin(user, mission) or responsible_assignee(user, mission)


def can_review_request(user, help_request):
    from shara_accounts.models import own_organization
    if not user.is_authenticated or not user.is_active:
        return False
    if user.role == Role.SUPER_ADMIN:
        return True
    if user.role != Role.ORGANIZATION_ADMIN:
        return False
    organization = own_organization(user)
    active = help_request.missions.filter(status__in=ACTIVE_MISSIONS).first()
    if active:
        return active.supervising_organization_id == organization.pk
    if help_request.status not in ['pending','clarification_needed']:
        return help_request.missions.filter(supervising_organization=organization).exists()
    return True


def require_request_review(user, help_request):
    if not can_review_request(user, help_request):
        raise PermissionDenied('এই আবেদন আপনার আওতায় নয়। / Request outside your scope.')


# Services
"""Atomic dispatch and lifecycle operations; the browser never decides eligibility."""
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import Max, Q
from django.utils import timezone

from Sara.domain import Role, ACTIVE_MISSIONS


def volunteer_busy(profile, excluding=None):
    missions = Mission.objects.filter(status__in=ACTIVE_MISSIONS).filter(
        Q(assigned_volunteer=profile) | Q(assigned_team__memberships__volunteer=profile, assigned_team__memberships__is_active=True))
    if excluding:
        missions = missions.exclude(pk=excluding)
    return missions.exists()


def candidate_reasons(actor, help_request, target):
    from shara_accounts.models import own_organization
    from response_teams.models import VolunteerTeam
    reasons = []
    organization = own_organization(actor) if actor.role == Role.ORGANIZATION_ADMIN else None
    if isinstance(target, VolunteerTeam):
        if organization and target.organization_id != organization.pk:
            reasons.append('অন্য সংগঠনের দল / Team belongs to another organization')
        if target.organization.verification_status != 'approved':
            reasons.append('সংগঠনের অনুমোদন বাকি / Organization awaiting approval')
        members = list(target.memberships.filter(is_active=True).select_related('volunteer__user'))
        if not target.leader_id or not any(row.volunteer_id == target.leader_id for row in members):
            reasons.append('নেতা প্রয়োজন / Leader needed')
        if not members:
            reasons.append('দলে সদস্য নেই / Team is empty')
        if target.missions.filter(status__in=ACTIVE_MISSIONS).exists():
            reasons.append('দল ইতোমধ্যে মিশনে / Team already on a mission')
        for row in members:
            member = row.volunteer
            if not member.user.is_active or member.membership_status != 'approved' or member.organization_id != target.organization_id:
                reasons.append('অযোগ্য সদস্য / Ineligible team member')
            if volunteer_busy(member):
                reasons.append('সদস্য ব্যস্ত / Member is busy')
    else:
        if organization and (target.organization_id != organization.pk or target.membership_status != 'approved'):
            reasons.append('নিজ সংগঠনের অনুমোদিত সদস্য নন / Not an approved member of your organization')
        if not target.user.is_active:
            reasons.append('অ্যাকাউন্ট নিষ্ক্রিয় / Account inactive')
        if target.availability != 'available':
            reasons.append('স্বেচ্ছাসেবক অনুপলব্ধ বা সীমিত / Volunteer unavailable or limited')
        if volunteer_busy(target):
            reasons.append('ইতোমধ্যে মিশনে / Already on a mission')
    # Team dispatch is the organization's decision; profile attributes are descriptive.
    # Individually dispatched volunteers retain their existing matching requirements.
    if not isinstance(target, VolunteerTeam):
        if not target.operating_districts.filter(kind='district',district_code=help_request.location.district_code).exists():
            reasons.append('সেবার জেলার বাইরে / Outside service district')
        for need in set(help_request.need_categories) - set(target.assistance_capabilities):
            reasons.append(f'{need} সক্ষমতা নেই / Missing {need} capability')
    return list(dict.fromkeys(reasons))


def roster_snapshot(team):
    if not team:
        return []
    return [{'id':str(row.volunteer_id), 'name':row.volunteer.user.full_name}
            for row in team.memberships.filter(is_active=True).select_related('volunteer__user')]


@transaction.atomic
def assign_mission(actor, request_id, *, team_id=None, volunteer_id=None):
    from shara_accounts.models import require_role
    from volunteers.models import VolunteerProfile
    from response_teams.models import VolunteerTeam
    from requests.models import HelpRequest
    require_role(actor, Role.SUPER_ADMIN, Role.ORGANIZATION_ADMIN)
    help_request = HelpRequest.objects.select_for_update().select_related('location').get(pk=request_id)
    require_request_review(actor, help_request)
    if help_request.status not in ['pending', 'clarification_needed'] or help_request.missions.filter(status__in=ACTIVE_MISSIONS).exists():
        raise ValidationError('আবেদন ইতোমধ্যে নির্ধারিত বা অপেক্ষমাণ নয়। / Request is already assigned or is not pending.')
    if bool(team_id) == bool(volunteer_id):
        raise ValidationError('একটি দল অথবা একজন ব্যক্তি বাছুন। / Select exactly one team or individual.')
    if team_id:
        target = VolunteerTeam.objects.select_for_update().select_related('organization','leader__user').get(pk=team_id)
        # Acquire participant locks consistently on databases supporting row locks.
        list(VolunteerProfile.objects.select_for_update().filter(team_memberships__team=target,team_memberships__is_active=True).order_by('pk'))
    else:
        target = VolunteerProfile.objects.select_for_update().select_related('organization','user').get(pk=volunteer_id)
    reasons = candidate_reasons(actor, help_request, target)
    if reasons:
        raise ValidationError(reasons)
    supervisor = target.organization if team_id or target.membership_status == 'approved' else None
    if supervisor and supervisor.verification_status != 'approved':
        supervisor = None
    attempt = (help_request.missions.aggregate(number=Max('attempt_number'))['number'] or 0) + 1
    mission = Mission.objects.create(
        help_request=help_request, attempt_number=attempt, assigned_team=target if team_id else None,
        assigned_volunteer=target if volunteer_id else None, assigned_by=actor,
        supervising_organization=supervisor, origin_organization_name=supervisor.name if supervisor else '',
        priority=help_request.priority, assignee_label_snapshot=str(target),
        assigned_roster_snapshot=roster_snapshot(target) if team_id else [])
    help_request.status = 'assigned'
    help_request.save()
    return mission


@transaction.atomic
def transition_mission(actor, mission_id, action, *, reason='', all_needs_fulfilled=False,
                       delivered_assistance='', completion_debrief='', issues_encountered=''):
    from requests.models import HelpRequest
    mission = Mission.objects.select_for_update().select_related('assigned_team__leader__user','assigned_volunteer__user','supervising_organization','help_request').get(pk=mission_id)
    if not mission.active:
        raise ValidationError('মিশন ইতোমধ্যে শেষ হয়েছে। / Mission already ended.')
    responsible = actor.is_active and responsible_assignee(actor, mission)
    if action in ['accept','start','complete'] and not responsible:
        raise PermissionDenied('শুধু দায়িত্বপ্রাপ্ত ব্যক্তি বা বর্তমান নেতা কাজটি করতে পারেন। / Only the responsible assignee can perform this action.')
    if action in ['cancel','fail'] and not (responsible or supervising_admin(actor, mission)):
        raise PermissionDenied('You cannot end this mission.')
    expected = {'accept':'assigned','start':'accepted','complete':'in_progress'}
    if action in expected and mission.status != expected[action]:
        raise ValidationError('এই ধাপে কাজটি করা যায় না। / Action is invalid at this stage.')
    now = timezone.now()
    if action == 'accept':
        mission.status, mission.accepted_at = 'accepted', now
    elif action == 'start':
        mission.status, mission.started_at = 'in_progress', now
    elif action == 'complete':
        if not all_needs_fulfilled:
            raise ValidationError('সব চাহিদা পূরণের নিশ্চিতকরণ আবশ্যক। / Confirm all needs were fulfilled.')
        mission.status = 'completed'
        mission.all_needs_fulfilled = True
        mission.delivered_assistance = delivered_assistance
        mission.completion_debrief = completion_debrief
        mission.issues_encountered = issues_encountered
    elif action in ['cancel','fail']:
        if not reason.strip():
            raise ValidationError('কারণ আবশ্যক। / A reason is required.')
        mission.status = 'cancelled' if action == 'cancel' else 'failed'
        mission.end_reason = reason.strip()
    else:
        raise ValidationError('Unknown mission action.')
    if mission.status in ['completed','cancelled','failed']:
        mission.ended_at, mission.ended_by = now, actor
        mission.final_roster_snapshot = roster_snapshot(mission.assigned_team)
        help_request = HelpRequest.objects.select_for_update().get(pk=mission.help_request_id)
        help_request.status = 'completed' if action == 'complete' else 'pending'
        help_request.closed_at = now if action == 'complete' else None
        help_request.save()
        mission.pause_reason = mission.resume_status = None
    mission.save()
    return mission


def pause_for_leader_replacement(team):
    for mission in team.missions.select_for_update().filter(status__in=['assigned','accepted','in_progress']):
        mission.resume_status = mission.status
        mission.status = 'paused'
        mission.pause_reason = 'leader_replacement'
        mission.paused_at = timezone.now()
        mission.save()


def resume_after_leader_replacement(team):
    for mission in team.missions.select_for_update().filter(status='paused',pause_reason='leader_replacement'):
        mission.status = mission.resume_status
        mission.resume_status = mission.pause_reason = None
        mission.paused_at = None
        mission.save()
