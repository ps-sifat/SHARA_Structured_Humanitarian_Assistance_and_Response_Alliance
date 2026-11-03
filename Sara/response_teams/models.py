from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from Sara.domain import TimestampedModel, DomainModel, ACTIVE_MISSIONS, validate_assistance


class VolunteerTeam(TimestampedModel):
    AVAILABILITY = [('ready','প্রস্তুত / Ready'), ('limited','সীমিত / Limited'), ('unavailable','অনুপলব্ধ / Unavailable')]
    organization = models.ForeignKey('organizations.Organization', on_delete=models.PROTECT, related_name='teams')
    name = models.CharField(max_length=160)
    leader = models.ForeignKey('volunteers.VolunteerProfile', on_delete=models.PROTECT, null=True, blank=True, related_name='led_teams')
    operating_districts = models.ManyToManyField('geo_locations.Location', related_name='service_teams', limit_choices_to={'kind':'district'})
    assistance_capabilities = models.JSONField(default=list, blank=True, validators=[validate_assistance])
    availability = models.CharField(max_length=12, choices=AVAILABILITY, default='ready')
    volunteers = models.ManyToManyField('volunteers.VolunteerProfile', through='TeamMember', related_name='teams')

    class Meta:
        ordering = ['name']
        constraints = [models.CheckConstraint(condition=models.Q(availability__in=['ready','limited','unavailable']), name='team_availability_valid')]

    def clean(self):
        if self.leader_id and not self.memberships.filter(volunteer_id=self.leader_id, is_active=True).exists():
            raise ValidationError({'leader': 'The leader must be an active member of this team.'})

    @property
    def busy(self):
        return self.missions.filter(status__in=ACTIVE_MISSIONS).exists()

    @property
    def member_count(self):
        return self.memberships.filter(is_active=True).count()

    def __str__(self):
        return self.name


class TeamMember(DomainModel):
    team = models.ForeignKey(VolunteerTeam, on_delete=models.PROTECT, related_name='memberships')
    volunteer = models.ForeignKey('volunteers.VolunteerProfile', on_delete=models.PROTECT, related_name='team_memberships')
    joined_at = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)
    left_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['team','volunteer'], name='team_volunteer_unique'),
            models.UniqueConstraint(fields=['volunteer'], condition=models.Q(is_active=True), name='one_active_team_per_volunteer'),
        ]

    def clean(self):
        if self.is_active and self.team_id and self.volunteer_id:
            if self.volunteer.membership_status != 'approved' or self.volunteer.organization_id != self.team.organization_id:
                raise ValidationError('An active member must be approved in the owning organization.')

    @property
    def member_role(self):
        return 'leader' if self.is_active and self.team.leader_id == self.volunteer_id else 'member'

    def __str__(self):
        return f'{self.volunteer} — {self.team}'

# Services
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from Sara.domain import Role


def end_team_membership(membership):
    from missions.models import pause_for_leader_replacement
    team = VolunteerTeam.objects.select_for_update().get(pk=membership.team_id)
    membership.is_active, membership.left_at = False, timezone.now()
    membership.save()
    if team.leader_id == membership.volunteer_id:
        team.leader = None
        team.save()
        pause_for_leader_replacement(team)


@transaction.atomic
def leave_team(actor):
    from shara_accounts.models import require_role
    from volunteers.models import VolunteerProfile
    require_role(actor, Role.VOLUNTEER)
    profile = VolunteerProfile.objects.select_for_update().get(user=actor)
    membership = profile.team_memberships.select_for_update().filter(is_active=True).first()
    if not membership:
        raise ValidationError('সক্রিয় দলের সদস্যতা নেই। / No active team membership.')
    end_team_membership(membership)


@transaction.atomic
def remove_member(actor, team_id, profile_id):
    from shara_accounts.models import own_organization
    organization = own_organization(actor)
    team = VolunteerTeam.objects.select_for_update().get(pk=team_id)
    if team.organization_id != organization.pk:
        raise PermissionDenied('This team belongs to another organization.')
    membership = team.memberships.select_for_update().filter(volunteer_id=profile_id,is_active=True).first()
    if not membership:
        raise ValidationError('The member has already left this team.')
    end_team_membership(membership)


@transaction.atomic
def save_team(actor, *, team_id=None, name, districts, capabilities, members, leader, availability):
    from shara_accounts.models import own_organization
    from organizations.models import validate_districts
    from volunteers.models import VolunteerProfile
    from missions.models import volunteer_busy, pause_for_leader_replacement, resume_after_leader_replacement
    organization = own_organization(actor)
    districts = validate_districts(districts)
    if not {d.pk for d in districts}.issubset(set(organization.operating_districts.values_list('pk',flat=True))):
        raise ValidationError('দলের জেলা সংগঠনের এলাকার মধ্যে হতে হবে। / Team districts must be within organization coverage.')
    member_ids = {member.pk for member in members}
    profiles = list(VolunteerProfile.objects.select_for_update().filter(pk__in=member_ids).select_related('user').order_by('pk'))
    if len(profiles) != len(member_ids):
        raise ValidationError('A selected member no longer exists.')
    if leader and leader.pk not in member_ids:
        raise ValidationError('নেতাকে নির্বাচিত সদস্য হতে হবে। / The leader must be a selected member.')
    if team_id:
        team = VolunteerTeam.objects.select_for_update().get(pk=team_id)
        if team.organization_id != organization.pk:
            raise PermissionDenied('This team belongs to another organization.')
        if team.busy and (set(team.operating_districts.values_list('pk',flat=True)) != {d.pk for d in districts} or set(team.assistance_capabilities) != set(capabilities)):
            raise ValidationError('সক্রিয় মিশনে শুধু জেলা ও সক্ষমতা স্থির। / Coverage and capabilities are locked during an active mission.')
    else:
        if not profiles or not leader:
            raise ValidationError('নতুন দলের সদস্য ও নেতা আবশ্যক। / A new team needs members and a leader.')
        team = VolunteerTeam.objects.create(organization=organization,name=name,assistance_capabilities=capabilities,availability=availability)
    current = set(team.memberships.filter(is_active=True).values_list('volunteer_id',flat=True))
    for profile in profiles:
        if not profile.user.is_active or profile.membership_status != 'approved' or profile.organization_id != organization.pk:
            raise ValidationError(f'{profile}: not an active approved member of this organization.')
        if profile.pk not in current:
            if profile.team_memberships.filter(is_active=True).exclude(team=team).exists():
                raise ValidationError(f'{profile}: leave the current team first.')
            if volunteer_busy(profile):
                raise ValidationError(f'{profile}: already participates in an active mission.')
    for membership in team.memberships.select_for_update().filter(is_active=True).exclude(volunteer_id__in=member_ids):
        end_team_membership(membership)
    for profile in profiles:
        if profile.pk not in current:
            row, created = TeamMember.objects.get_or_create(team=team,volunteer=profile,defaults={'is_active':True})
            if not created:
                row.is_active, row.joined_at, row.left_at = True, timezone.now(), None
                row.save()
    # Reload after departures may have cleared the leader and paused the mission.
    team.refresh_from_db()
    team.name, team.availability = name, availability
    team.assistance_capabilities = list(capabilities)
    team.leader = leader
    team.save()
    team.operating_districts.set(districts)
    if leader:
        resume_after_leader_replacement(team)
    else:
        pause_for_leader_replacement(team)
    return team
