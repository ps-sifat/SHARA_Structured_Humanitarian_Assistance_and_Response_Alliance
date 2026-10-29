from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from missions.models import Mission, MissionUpdate

from .models import HelpRequest, RequestClarification


@transaction.atomic
def verify_help_request(help_request, reviewer):
    if not reviewer.is_active or not reviewer.is_superuser:
        raise ValidationError("Only an active Super Admin can verify public requests.")
    request = HelpRequest.objects.select_for_update().get(pk=help_request.pk)
    if request.verification_status != HelpRequest.VerificationStatus.PENDING:
        raise ValidationError("Only a pending request can be verified.")
    request.verification_status = HelpRequest.VerificationStatus.VERIFIED
    request.review_note = ""
    request.reviewed_by = reviewer
    request.reviewed_at = timezone.now()
    request.save(update_fields=["verification_status", "review_note", "reviewed_by", "reviewed_at", "updated_at"])
    mission, created = Mission.objects.get_or_create(help_request=request, defaults={"created_by": reviewer})
    if created:
        MissionUpdate.objects.create(mission=mission, actor=reviewer, status=Mission.Status.AWAITING_ASSIGNMENT)
    return request


@transaction.atomic
def reject_help_request(help_request, reviewer, reason):
    if not reviewer.is_active or not reviewer.is_superuser:
        raise ValidationError("Only an active Super Admin can reject public requests.")
    request = HelpRequest.objects.select_for_update().get(pk=help_request.pk)
    if request.verification_status not in {
        HelpRequest.VerificationStatus.PENDING,
        HelpRequest.VerificationStatus.CLARIFICATION,
    }:
        raise ValidationError("Only an unverified request can be rejected.")
    request.verification_status = HelpRequest.VerificationStatus.REJECTED
    request.review_note = reason.strip()
    request.reviewed_by = reviewer
    request.reviewed_at = timezone.now()
    request.save(update_fields=["verification_status", "review_note", "reviewed_by", "reviewed_at", "updated_at"])
    return request


@transaction.atomic
def request_help_clarification(help_request, reviewer, reason):
    if not reviewer.is_active or not reviewer.is_superuser:
        raise ValidationError("Only an active Super Admin can request clarification.")
    request = HelpRequest.objects.select_for_update().get(pk=help_request.pk)
    if request.verification_status != HelpRequest.VerificationStatus.PENDING:
        raise ValidationError("Clarification can only be requested for a pending request.")
    item = RequestClarification.objects.create(help_request=request, requested_by=reviewer, request_note=reason.strip())
    request.verification_status = HelpRequest.VerificationStatus.CLARIFICATION
    request.review_note = reason.strip()
    request.reviewed_by = reviewer
    request.reviewed_at = timezone.now()
    request.save(update_fields=["verification_status", "review_note", "reviewed_by", "reviewed_at", "updated_at"])
    return item


@transaction.atomic
def resolve_help_clarification(help_request, reviewer, note):
    if not reviewer.is_active or not reviewer.is_superuser:
        raise ValidationError("Only an active Super Admin can resolve a clarification.")
    request = HelpRequest.objects.select_for_update().get(pk=help_request.pk)
    item = request.clarifications.filter(status=RequestClarification.Status.SUBMITTED).order_by(
        "-submitted_at", "-id"
    ).first()
    if not item:
        raise ValidationError("There is no submitted clarification waiting for review.")
    item.status = RequestClarification.Status.RESOLVED
    item.review_note = note.strip()
    item.reviewed_by = reviewer
    item.reviewed_at = timezone.now()
    item.save(update_fields=["status", "review_note", "reviewed_by", "reviewed_at", "updated_at"])
    return item
