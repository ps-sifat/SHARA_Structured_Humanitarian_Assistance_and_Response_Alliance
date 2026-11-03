from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from Sara.domain import TimestampedModel, Role, normalize_phone


class Organization(TimestampedModel):
    class Status(models.TextChoices):
        PENDING = 'pending', 'অপেক্ষমাণ / Pending'
        APPROVED = 'approved', 'অনুমোদিত / Approved'
        REJECTED = 'rejected', 'প্রত্যাখ্যাত / Rejected'

    TYPES = [('volunteer', 'স্বেচ্ছাসেবী / Volunteer organization'), ('ngo', 'এনজিও / NGO'), ('other', 'অন্যান্য / Other')]
    administrator = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='managed_organization')
    name = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    organization_type = models.CharField(max_length=24, choices=TYPES)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField()
    office_location = models.ForeignKey('geo_locations.Location', on_delete=models.PROTECT, related_name='organization_offices')
    operating_districts = models.ManyToManyField('geo_locations.Location', related_name='service_organizations', limit_choices_to={'kind': 'district'})
    verification_status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    verification_reason = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='reviewed_organizations')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    logo = models.ImageField(upload_to='organizations/%Y/%m/', blank=True)

    class Meta:
        ordering = ['name']
        constraints = [models.CheckConstraint(condition=models.Q(verification_status__in=['pending', 'approved', 'rejected']), name='organization_status_valid')]

    def clean(self):
        self.contact_phone = normalize_phone(self.contact_phone)
        if self.administrator_id and self.administrator.role != Role.ORGANIZATION_ADMIN:
            raise ValidationError({'administrator': 'An organization administrator is required.'})
        if self.office_location_id and self.office_location.kind != 'address':
            raise ValidationError({'office_location': 'An office address is required.'})
        if self.verification_status == 'rejected' and not self.verification_reason.strip():
            raise ValidationError({'verification_reason': 'A rejection reason is required.'})

    def get_active_teams(self):
        return self.teams.all()

    def __str__(self):
        return self.name

# Services
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from Sara.domain import Role, ACTIVE_MISSIONS


def validate_districts(districts):
    districts = list(districts)
    if not districts or any(d.kind != 'district' for d in districts):
        raise ValidationError('অন্তত একটি সেবার জেলা বাছুন। / Select at least one canonical service district.')
    return districts


@transaction.atomic
def review_organization(actor, organization_id, decision, reason=''):
    from shara_accounts.models import require_role
    require_role(actor, Role.SUPER_ADMIN)
    organization = Organization.objects.select_for_update().get(pk=organization_id)
    if organization.verification_status != 'pending' or decision not in ['approve','reject']:
        raise ValidationError('Only a pending organization can be reviewed.')
    if decision == 'reject' and not reason.strip():
        raise ValidationError('প্রত্যাখ্যানের কারণ আবশ্যক। / A rejection reason is required.')
    organization.verification_status = 'approved' if decision == 'approve' else 'rejected'
    organization.verification_reason = reason.strip() if decision == 'reject' else ''
    organization.reviewed_by, organization.reviewed_at = actor, timezone.now()
    organization.save()
    return organization


@transaction.atomic
def resubmit_organization(actor):
    from shara_accounts.models import own_organization
    organization = own_organization(actor, approved=False)
    organization = Organization.objects.select_for_update().get(pk=organization.pk)
    if organization.verification_status != 'rejected':
        raise ValidationError('Only a rejected organization can be resubmitted.')
    organization.verification_status = 'pending'
    organization.verification_reason = ''
    organization.reviewed_by = organization.reviewed_at = None
    organization.save()
    return organization


@transaction.atomic
def save_organization(actor, data, districts):
    from shara_accounts.models import own_organization
    organization = own_organization(actor, approved=False)
    organization = Organization.objects.select_for_update().get(pk=organization.pk)
    districts = validate_districts(districts)
    selected = {d.pk for d in districts}
    for team in organization.teams.all():
        if not set(team.operating_districts.values_list('pk',flat=True)).issubset(selected):
            raise ValidationError(f'{team.name}: update this team before removing its service districts.')
    allowed = {'name','description','organization_type','contact_phone','contact_email','logo','office_location'}
    for field in allowed & data.keys():
        setattr(organization, field, data[field])
    organization.save()
    organization.operating_districts.set(districts)
    return organization


@transaction.atomic
def apply_membership(actor, organization_id):
    from shara_accounts.models import require_role
    from volunteers.models import VolunteerProfile
    require_role(actor, Role.VOLUNTEER)
    profile = VolunteerProfile.objects.select_for_update().get(user=actor)
    organization = Organization.objects.select_for_update().get(pk=organization_id)
    if profile.membership_status in ['pending','approved']:
        raise ValidationError('আগে বর্তমান আবেদন প্রত্যাহার বা সংগঠন ত্যাগ করুন। / Withdraw or leave before applying elsewhere.')
    if organization.verification_status != 'approved':
        raise ValidationError('সংগঠনের অনুমোদন বাকি। / Organization not approved.')
    profile.organization, profile.membership_status = organization, 'pending'
    profile.membership_requested_at = timezone.now()
    profile.membership_reason = ''
    profile.membership_decided_at = profile.membership_decided_by = None
    profile.save()
    return profile


@transaction.atomic
def decide_membership(actor, profile_id, decision, reason=''):
    from shara_accounts.models import own_organization
    from volunteers.models import VolunteerProfile
    organization = own_organization(actor)
    profile = VolunteerProfile.objects.select_for_update().get(pk=profile_id)
    if profile.organization_id != organization.pk:
        raise PermissionDenied('This application belongs to another organization.')
    if profile.membership_status != 'pending' or decision not in ['approve','reject']:
        raise ValidationError('Only a pending application can be reviewed.')
    if decision == 'reject' and not reason.strip():
        raise ValidationError('A rejection reason is required.')
    profile.membership_status = 'approved' if decision == 'approve' else 'rejected'
    profile.membership_reason = reason.strip() if decision == 'reject' else ''
    profile.membership_decided_by, profile.membership_decided_at = actor, timezone.now()
    profile.save()
    return profile


@transaction.atomic
def end_membership(actor, profile_id=None, *, withdraw=False, reason=''):
    from shara_accounts.models import require_role, own_organization
    from volunteers.models import VolunteerProfile
    from response_teams.models import end_team_membership
    require_role(actor, Role.VOLUNTEER, Role.ORGANIZATION_ADMIN)
    if actor.role == Role.VOLUNTEER:
        profile = VolunteerProfile.objects.select_for_update().get(user=actor)
        status = 'none' if withdraw else 'left'
    else:
        organization = own_organization(actor)
        profile = VolunteerProfile.objects.select_for_update().get(pk=profile_id)
        if profile.organization_id != organization.pk or profile.membership_status != 'approved':
            raise PermissionDenied('Only your current approved members can be removed.')
        status = 'removed'
    expected = 'pending' if withdraw else 'approved'
    if profile.membership_status != expected:
        raise ValidationError('This membership action is no longer available.')
    for membership in profile.team_memberships.select_for_update().filter(is_active=True):
        end_team_membership(membership)
    # Individual missions survive departure. Former organization loses supervision.
    profile.individual_missions.filter(supervising_organization=profile.organization).update(supervising_organization=None)
    profile.organization = None
    profile.membership_status = status
    profile.membership_reason = reason.strip() if status == 'removed' else ''
    profile.membership_decided_by = actor if actor.role == Role.ORGANIZATION_ADMIN else None
    profile.membership_decided_at = timezone.now()
    profile.save()
    return profile
