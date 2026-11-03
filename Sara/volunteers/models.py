from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from Sara.domain import TimestampedModel, Role, ACTIVE_MISSIONS, validate_assistance, validate_skills


class VolunteerProfile(TimestampedModel):
    class Membership(models.TextChoices):
        NONE = 'none', 'সদস্যতা নেই / None'
        PENDING = 'pending', 'অপেক্ষমাণ / Pending'
        APPROVED = 'approved', 'অনুমোদিত / Approved'
        REJECTED = 'rejected', 'প্রত্যাখ্যাত / Rejected'
        LEFT = 'left', 'ত্যাগ করেছেন / Left'
        REMOVED = 'removed', 'সরানো হয়েছে / Removed'

    AVAILABILITY = [('available', 'প্রস্তুত / Available'), ('limited', 'সীমিত / Limited'), ('unavailable', 'অনুপলব্ধ / Unavailable')]
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='volunteer_profile')
    organization = models.ForeignKey('organizations.Organization', on_delete=models.PROTECT, null=True, blank=True, related_name='membership_profiles')
    membership_status = models.CharField(max_length=12, choices=Membership.choices, default=Membership.NONE)
    membership_reason = models.TextField(blank=True)
    membership_requested_at = models.DateTimeField(null=True, blank=True)
    membership_decided_at = models.DateTimeField(null=True, blank=True)
    membership_decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='membership_decisions')
    current_location = models.ForeignKey('geo_locations.Location', on_delete=models.PROTECT, related_name='current_volunteer_profiles')
    operating_districts = models.ManyToManyField('geo_locations.Location', related_name='service_volunteers', limit_choices_to={'kind': 'district'})
    skills = models.JSONField(default=list, blank=True, validators=[validate_skills])
    assistance_capabilities = models.JSONField(default=list, blank=True, validators=[validate_assistance])
    availability = models.CharField(max_length=12, choices=AVAILABILITY, default='available')
    vehicle_access = models.BooleanField(default=False)
    swimming_capability = models.BooleanField(default=False)
    profile_photo = models.ImageField(upload_to='volunteers/%Y/%m/', blank=True)

    class Meta:
        ordering = ['user__full_name']
        constraints = [
            models.CheckConstraint(condition=(models.Q(membership_status__in=['pending','approved','rejected'], organization__isnull=False) | models.Q(membership_status__in=['none','left','removed'], organization__isnull=True)), name='membership_target_matches_state'),
            models.CheckConstraint(condition=models.Q(availability__in=['available','limited','unavailable']), name='volunteer_availability_valid'),
        ]

    def clean(self):
        if self.user_id and self.user.role != Role.VOLUNTEER:
            raise ValidationError({'user': 'A volunteer account is required.'})
        if self.current_location_id and self.current_location.kind != 'address':
            raise ValidationError({'current_location': 'A current address is required.'})

    @property
    def active_team(self):
        membership = self.team_memberships.filter(is_active=True).select_related('team').first()
        return membership.team if membership else None

    @property
    def busy(self):
        from missions.models import Mission
        return Mission.objects.filter(models.Q(assigned_volunteer=self) | models.Q(assigned_team__memberships__volunteer=self, assigned_team__memberships__is_active=True), status__in=ACTIVE_MISSIONS).exists()

    def view_assigned_missions(self):
        from missions.models import visible_missions
        return visible_missions(self.user)

    def __str__(self):
        return self.user.full_name

# Services
from django.db import transaction

from Sara.domain import Role


@transaction.atomic
def save_profile(actor, data, districts):
    from shara_accounts.models import require_role
    from organizations.models import validate_districts
    require_role(actor, Role.VOLUNTEER)
    profile = VolunteerProfile.objects.select_for_update().get(user=actor)
    districts = validate_districts(districts)
    for field in {'current_location','skills','assistance_capabilities','availability','vehicle_access','swimming_capability','profile_photo'} & data.keys():
        setattr(profile, field, data[field])
    profile.save()
    profile.operating_districts.set(districts)
    return profile
