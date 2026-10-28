from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from .models import MembershipRequest, Organization, OrganizationAdmin, OrganizationMembership


@transaction.atomic
def approve_organization_registration(organization, approved_by):
    if not approved_by.is_active or not approved_by.is_superuser:
        raise PermissionDenied("Only an active Super Admin can approve organization registration.")
    if organization.registration_status != Organization.RegistrationStatus.PENDING:
        raise ValidationError("Only a pending organization registration can be approved.")

    now = timezone.now()
    organization.registration_status = Organization.RegistrationStatus.APPROVED
    organization.reviewed_by = approved_by
    organization.reviewed_at = now
    organization.save(update_fields=["registration_status", "reviewed_by", "reviewed_at", "updated_at"])
    OrganizationAdmin.objects.get_or_create(
        organization=organization,
        user=organization.registered_by,
        status=OrganizationAdmin.Status.ACTIVE,
        defaults={"assigned_by": approved_by, "assigned_at": now},
    )
    return organization


@transaction.atomic
def approve_membership_request(membership_request, approved_by):
    if not approved_by.is_active:
        raise PermissionDenied("An active organization administrator is required.")
    is_org_admin = OrganizationAdmin.objects.filter(
        organization=membership_request.organization, user=approved_by, status=OrganizationAdmin.Status.ACTIVE
    ).exists()
    if not is_org_admin:
        raise PermissionDenied("Only an administrator of this organization can approve the request.")
    if membership_request.status != MembershipRequest.Status.PENDING:
        raise ValidationError("Only a pending membership request can be approved.")
    if (
        not membership_request.organization.is_active
        or membership_request.organization.registration_status != Organization.RegistrationStatus.APPROVED
    ):
        raise ValidationError("The organization must be approved and active before accepting volunteers.")
    if OrganizationMembership.objects.filter(
        volunteer=membership_request.volunteer, status=OrganizationMembership.Status.ACTIVE
    ).exists():
        raise ValidationError("This volunteer already has an active organization membership.")

    now = timezone.now()
    membership = OrganizationMembership.objects.create(
        organization=membership_request.organization,
        volunteer=membership_request.volunteer,
        request=membership_request,
        approved_by=approved_by,
        status=OrganizationMembership.Status.ACTIVE,
        started_at=now,
    )
    membership_request.status = MembershipRequest.Status.APPROVED
    membership_request.reviewed_by = approved_by
    membership_request.reviewed_at = now
    membership_request.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
    return membership
