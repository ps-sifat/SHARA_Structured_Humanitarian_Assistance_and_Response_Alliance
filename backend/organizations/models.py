from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Organization(models.Model):
    class RegistrationStatus(models.TextChoices):
        PENDING = "pending", "Pending review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    registered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="organization_registrations"
    )
    name = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    organization_type = models.CharField(max_length=120, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    office_district = models.ForeignKey(
        "locations.District", on_delete=models.PROTECT, null=True, blank=True, related_name="organizations"
    )
    office_upazila = models.ForeignKey(
        "locations.Upazila", on_delete=models.PROTECT, null=True, blank=True, related_name="organizations"
    )
    service_districts = models.ManyToManyField("locations.District", blank=True, related_name="service_organizations")
    service_upazilas = models.ManyToManyField("locations.Upazila", blank=True, related_name="service_organizations")
    registration_status = models.CharField(
        max_length=12, choices=RegistrationStatus.choices, default=RegistrationStatus.PENDING
    )
    review_note = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_organizations",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    profile_image_url = models.URLField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["registration_status", "created_at"], name="org_status_created_idx"),
            models.Index(fields=["registered_by", "registration_status"], name="org_owner_status_idx"),
        ]

    def __str__(self):
        return self.name


class OrganizationAdmin(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        REVOKED = "revoked", "Revoked"

    organization = models.ForeignKey(Organization, on_delete=models.PROTECT, related_name="administrators")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="organization_admin_roles")
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="granted_org_admins"
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    assigned_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "user"], condition=Q(status="active"), name="org_active_admin_uniq"
            ),
        ]
        indexes = [models.Index(fields=["user", "status"], name="org_admin_user_status_idx")]

    def __str__(self):
        return f"{self.user} — {self.organization}"


class MembershipRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        WITHDRAWN = "withdrawn", "Withdrawn"

    organization = models.ForeignKey(Organization, on_delete=models.PROTECT, related_name="membership_requests")
    volunteer = models.ForeignKey(
        "accounts.VolunteerProfile", on_delete=models.PROTECT, related_name="membership_requests"
    )
    request_note = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    decision_note = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="membership_decisions"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "volunteer"], condition=Q(status="pending"), name="org_pending_request_uniq"
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "status", "created_at"], name="org_request_queue_idx"),
            models.Index(fields=["volunteer", "status"], name="org_request_vol_status_idx"),
        ]

    def __str__(self):
        return f"{self.volunteer} → {self.organization} ({self.status})"


class OrganizationMembership(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ENDED = "ended", "Ended"
        REVOKED = "revoked", "Revoked"

    organization = models.ForeignKey(Organization, on_delete=models.PROTECT, related_name="memberships")
    volunteer = models.ForeignKey(
        "accounts.VolunteerProfile", on_delete=models.PROTECT, related_name="organization_memberships"
    )
    request = models.ForeignKey(
        MembershipRequest, on_delete=models.SET_NULL, null=True, blank=True, related_name="memberships"
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_memberships"
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-started_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["volunteer"], condition=Q(status="active"), name="org_one_active_membership_per_volunteer"
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "status"], name="org_member_org_status_idx"),
            models.Index(fields=["volunteer", "status"], name="org_member_vol_status_idx"),
        ]

    def __str__(self):
        return f"{self.volunteer} — {self.organization} ({self.status})"
