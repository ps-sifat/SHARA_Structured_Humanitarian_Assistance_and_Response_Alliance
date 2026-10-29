import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q


def make_request_code():
    return f"SH-{uuid.uuid4().hex[:10].upper()}"


# Kept for the import path used by the original migration state.
def make_tracking_code():
    return uuid.uuid4().hex


class AssistanceCategory(models.Model):
    code = models.SlugField(max_length=48, unique=True)
    name_bn = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name_en", "name_bn"]
        indexes = [models.Index(fields=["is_active", "name_en"], name="help_category_active_idx")]

    def __str__(self):
        return self.name_en or self.name_bn


class HelpRequest(models.Model):
    class ReporterType(models.TextChoices):
        DIRECT = "direct", "Direct"
        PROXY = "proxy", "Proxy"

    class VerificationStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        VERIFIED = "verified", "Verified"
        REJECTED = "rejected", "Rejected"
        CLARIFICATION = "clarification", "Clarification needed"

    class Priority(models.TextChoices):
        HIGH = "high", "High"
        MEDIUM = "medium", "Medium"
        LOW = "low", "Low"

    request_code = models.CharField(max_length=16, unique=True, default=make_request_code, editable=False)
    tracking_token_hash = models.CharField(max_length=64, blank=True, default="", editable=False)
    idempotency_key = models.CharField(max_length=128, null=True, blank=True, editable=False)
    request_fingerprint = models.CharField(max_length=64, blank=True, default="", editable=False)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="help_requests"
    )
    reporter_type = models.CharField(max_length=8, choices=ReporterType.choices, default=ReporterType.DIRECT)
    affected_person_name = models.CharField(max_length=160, blank=True)
    contact_phone = models.CharField(max_length=20)
    reporter_name = models.CharField(max_length=160, blank=True)
    reporter_phone = models.CharField(max_length=20, blank=True)
    relation_to_affected = models.CharField(max_length=120, blank=True)
    district = models.ForeignKey("locations.District", on_delete=models.PROTECT, related_name="help_requests")
    upazila = models.ForeignKey("locations.Upazila", on_delete=models.PROTECT, related_name="help_requests")
    people_affected = models.PositiveIntegerField(default=1)
    assistance_categories = models.ManyToManyField(
        AssistanceCategory, related_name="help_requests", through="HelpRequestCategory"
    )
    description = models.TextField(blank=True)
    risks = models.JSONField(default=list, blank=True)
    priority = models.CharField(max_length=8, choices=Priority.choices, default=Priority.MEDIUM)
    verification_status = models.CharField(
        max_length=14, choices=VerificationStatus.choices, default=VerificationStatus.PENDING
    )
    review_note = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_help_requests"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["verification_status", "created_at"], name="help_req_queue_idx"),
            models.Index(fields=["district", "upazila", "verification_status"], name="help_req_area_status_idx"),
            models.Index(fields=["priority", "created_at"], name="help_req_priority_idx"),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(people_affected__gte=1), name="help_req_people_positive"),
            models.UniqueConstraint(
                fields=["tracking_token_hash"], condition=~Q(tracking_token_hash=""), name="help_req_token_hash_uniq"
            ),
            models.UniqueConstraint(
                fields=["idempotency_key"], condition=Q(idempotency_key__isnull=False), name="help_req_idem_key_uniq"
            ),
        ]

    def clean(self):
        super().clean()
        if self.upazila_id and self.district_id and self.upazila.district_id != self.district_id:
            raise ValidationError({"upazila": "The upazila must belong to the selected district."})
        if self.reporter_type == self.ReporterType.PROXY and not self.relation_to_affected.strip():
            raise ValidationError({"relation_to_affected": "Provide the reporter's relation to the affected person."})

    def __str__(self):
        return f"{self.request_code} ({self.verification_status})"


class RequestClarification(models.Model):
    class Status(models.TextChoices):
        REQUESTED = "requested", "Waiting for applicant"
        SUBMITTED = "submitted", "Waiting for review"
        RESOLVED = "resolved", "Resolved"

    help_request = models.ForeignKey(HelpRequest, on_delete=models.CASCADE, related_name="clarifications")
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="requested_clarifications"
    )
    request_note = models.TextField()
    applicant_message = models.TextField(blank=True)
    review_note = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.REQUESTED)
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_clarifications"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [models.Index(fields=["help_request", "status"], name="help_clarify_req_status_idx")]

    def __str__(self):
        return f"Clarification for {self.help_request.request_code} ({self.status})"


class HelpRequestCategory(models.Model):
    help_request = models.ForeignKey(HelpRequest, on_delete=models.CASCADE)
    category = models.ForeignKey(AssistanceCategory, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["help_request", "category"], name="help_req_category_uniq"),
        ]

    def __str__(self):
        return f"{self.help_request.request_code}: {self.category}"
