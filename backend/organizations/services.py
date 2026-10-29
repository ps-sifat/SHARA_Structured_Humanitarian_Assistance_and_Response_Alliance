from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import MembershipRequest, Organization, OrganizationAdmin, OrganizationMembership


@transaction.atomic
def approve_organization_registration(organization, approved_by):
    if not approved_by.is_active or not approved_by.is_superuser:
        raise PermissionDenied("Only an active Super Admin can approve organization registration.")
    locked_organization = Organization.objects.select_for_update().get(pk=organization.pk)
    if locked_organization.registration_status != Organization.RegistrationStatus.PENDING:
        raise ValidationError("Only a pending organization registration can be approved.")

    now = timezone.now()
    locked_organization.registration_status = Organization.RegistrationStatus.APPROVED
    locked_organization.reviewed_by = approved_by
    locked_organization.reviewed_at = now
    locked_organization.save(update_fields=["registration_status", "reviewed_by", "reviewed_at", "updated_at"])
    organization.registration_status = locked_organization.registration_status
    organization.reviewed_by = locked_organization.reviewed_by
    organization.reviewed_at = locked_organization.reviewed_at
    organization.updated_at = locked_organization.updated_at
    OrganizationAdmin.objects.get_or_create(
        organization=locked_organization,
        user=locked_organization.registered_by,
        status=OrganizationAdmin.Status.ACTIVE,
        defaults={"assigned_by": approved_by, "assigned_at": now},
    )
    return organization


@transaction.atomic
def reject_organization_registration(organization, rejected_by, reason):
    if not rejected_by.is_active or not rejected_by.is_superuser:
        raise PermissionDenied("Only an active Super Admin can reject organization registration.")
    reason = reason.strip()
    if not reason:
        raise ValidationError("A rejection reason is required.")
    locked_organization = Organization.objects.select_for_update().get(pk=organization.pk)
    if locked_organization.registration_status != Organization.RegistrationStatus.PENDING:
        raise ValidationError("Only a pending organization registration can be rejected.")

    locked_organization.registration_status = Organization.RegistrationStatus.REJECTED
    locked_organization.review_note = reason
    locked_organization.reviewed_by = rejected_by
    locked_organization.reviewed_at = timezone.now()
    locked_organization.save(
        update_fields=["registration_status", "review_note", "reviewed_by", "reviewed_at", "updated_at"]
    )
    organization.registration_status = locked_organization.registration_status
    organization.review_note = locked_organization.review_note
    organization.reviewed_by = locked_organization.reviewed_by
    organization.reviewed_at = locked_organization.reviewed_at
    organization.updated_at = locked_organization.updated_at
    return organization


@transaction.atomic
def create_membership_request(organization, volunteer, request_note=""):
    organization = Organization.objects.select_for_update().get(pk=organization.pk)
    if not organization.is_active or organization.registration_status != Organization.RegistrationStatus.APPROVED:
        raise ValidationError("Membership requests are available for verified organizations only.")
    if OrganizationMembership.objects.filter(volunteer=volunteer, status=OrganizationMembership.Status.ACTIVE).exists():
        raise ValidationError("This volunteer already has an active organization membership.")
    if MembershipRequest.objects.filter(organization=organization, volunteer=volunteer, status="pending").exists():
        raise ValidationError("A pending request already exists for this organization.")
    try:
        with transaction.atomic():
            return MembershipRequest.objects.create(
                organization=organization, volunteer=volunteer, request_note=request_note.strip()
            )
    except IntegrityError as error:
        raise ValidationError("A pending request already exists for this organization.") from error


@transaction.atomic
def withdraw_membership_request(membership_request, volunteer_user):
    membership_request = MembershipRequest.objects.select_for_update().select_related("volunteer").get(
        pk=membership_request.pk
    )
    if membership_request.volunteer.user_id != volunteer_user.pk:
        raise PermissionDenied("You can withdraw only your own membership requests.")
    if membership_request.status != MembershipRequest.Status.PENDING:
        raise ValidationError("Only a pending membership request can be withdrawn.")
    now = timezone.now()
    membership_request.status = MembershipRequest.Status.WITHDRAWN
    membership_request.reviewed_at = now
    membership_request.save(update_fields=["status", "reviewed_at", "updated_at"])
    return membership_request


@transaction.atomic
def reject_membership_request(membership_request, rejected_by, reason):
    if not rejected_by.is_active or not OrganizationAdmin.objects.filter(
        organization=membership_request.organization,
        user=rejected_by,
        status=OrganizationAdmin.Status.ACTIVE,
    ).exists():
        raise PermissionDenied("Only an active administrator of this organization can reject the request.")
    reason = reason.strip()
    if not reason:
        raise ValidationError("A rejection reason is required.")
    membership_request = MembershipRequest.objects.select_for_update().get(pk=membership_request.pk)
    if membership_request.status != MembershipRequest.Status.PENDING:
        raise ValidationError("Only a pending membership request can be rejected.")
    membership_request.status = MembershipRequest.Status.REJECTED
    membership_request.decision_note = reason
    membership_request.reviewed_by = rejected_by
    membership_request.reviewed_at = timezone.now()
    membership_request.save(
        update_fields=["status", "decision_note", "reviewed_by", "reviewed_at", "updated_at"]
    )
    return membership_request


@transaction.atomic
def approve_membership_request(membership_request, approved_by):
    request_argument = membership_request
    if not approved_by.is_active:
        raise PermissionDenied("An active organization administrator is required.")
    is_org_admin = OrganizationAdmin.objects.filter(
        organization=membership_request.organization, user=approved_by, status=OrganizationAdmin.Status.ACTIVE
    ).exists()
    if not is_org_admin:
        raise PermissionDenied("Only an administrator of this organization can approve the request.")
    locked_request = MembershipRequest.objects.select_for_update().select_related(
        "organization", "volunteer"
    ).get(pk=membership_request.pk)
    if locked_request.status != MembershipRequest.Status.PENDING:
        raise ValidationError("Only a pending membership request can be approved.")
    membership_request = locked_request
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
    try:
        with transaction.atomic():
            membership = OrganizationMembership.objects.create(
                organization=membership_request.organization,
                volunteer=membership_request.volunteer,
                request=membership_request,
                approved_by=approved_by,
                status=OrganizationMembership.Status.ACTIVE,
                started_at=now,
            )
    except IntegrityError as error:
        raise ValidationError("This volunteer already has an active organization membership.") from error
    membership_request.status = MembershipRequest.Status.APPROVED
    membership_request.reviewed_by = approved_by
    membership_request.reviewed_at = now
    membership_request.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
    request_argument.status = membership_request.status
    request_argument.reviewed_by = membership_request.reviewed_by
    request_argument.reviewed_at = membership_request.reviewed_at
    request_argument.updated_at = membership_request.updated_at
    MembershipRequest.objects.filter(
        volunteer=membership_request.volunteer,
        status=MembershipRequest.Status.PENDING,
    ).exclude(pk=membership_request.pk).update(
        status=MembershipRequest.Status.REJECTED,
        decision_note="Volunteer joined another organization.",
        reviewed_by=approved_by,
        reviewed_at=now,
        updated_at=now,
    )
    return membership
