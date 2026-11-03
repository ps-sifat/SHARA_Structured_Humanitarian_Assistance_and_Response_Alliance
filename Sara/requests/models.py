import secrets

from django.conf import settings
from django.contrib.auth.hashers import check_password
from django.core.exceptions import ValidationError
from django.db import models

from Sara.domain import TimestampedModel, Priority, normalize_phone, validate_assistance


def request_reference():
    return 'SH-' + secrets.token_hex(5).upper()


class HelpRequest(TimestampedModel):
    submission_key = models.UUIDField(null=True, blank=True, unique=True, editable=False)
    class Status(models.TextChoices):
        PENDING = 'pending', 'অপেক্ষমাণ / Pending'
        CLARIFICATION = 'clarification_needed', 'ব্যাখ্যা প্রয়োজন / Clarification needed'
        ASSIGNED = 'assigned', 'নির্ধারিত / Assigned'
        COMPLETED = 'completed', 'সম্পন্ন / Completed'
        REJECTED = 'rejected', 'প্রত্যাখ্যাত / Rejected'

    reference = models.CharField(max_length=20, unique=True, default=request_reference, editable=False)
    tracking_code_hash = models.CharField(max_length=128, editable=False)
    requester = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='submitted_help_requests')
    victim_name = models.CharField(max_length=160, blank=True)
    contact_phone = models.CharField()
    location = models.ForeignKey('geo_locations.Location', on_delete=models.PROTECT, related_name='help_requests')
    person_count = models.PositiveIntegerField()
    need_categories = models.JSONField(validators=[validate_assistance])
    emergency_condition = models.TextField(blank=True)
    trapped_person = models.BooleanField(default=False)
    child_in_danger = models.BooleanField(default=False)
    elderly_in_danger = models.BooleanField(default=False)
    injured_person = models.BooleanField(default=False)
    critical_medical_emergency = models.BooleanField(default=False)
    immediate_rescue_required = models.BooleanField(default=False)
    is_proxy = models.BooleanField(default=False)
    reporter_name = models.CharField(max_length=160, blank=True)
    reporter_relationship = models.CharField(max_length=100, blank=True)
    reporter_phone = models.CharField(blank=True)
    suggested_priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NORMAL)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NORMAL)
    priority_override_reason = models.TextField(blank=True)
    priority_overridden_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='priority_overrides')
    priority_overridden_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PENDING)
    clarification_question = models.TextField(blank=True)
    clarification_response = models.TextField(blank=True)
    clarification_requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='requested_clarifications')
    clarification_requested_at = models.DateTimeField(null=True, blank=True)
    clarification_responded_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    rejected_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='rejected_help_requests')
    rejected_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(condition=models.Q(person_count__gt=0), name='request_positive_people'),
            models.CheckConstraint(condition=models.Q(status__in=['pending','clarification_needed','assigned','completed','rejected']), name='request_status_valid'),
            models.CheckConstraint(condition=models.Q(priority__in=Priority.values, suggested_priority__in=Priority.values), name='request_priorities_valid'),
        ]

    def clean(self):
        self.contact_phone = normalize_phone(self.contact_phone)
        self.reporter_phone = normalize_phone(self.reporter_phone)
        if self.location_id and (self.location.kind != 'address' or not self.location.directions.strip()):
            raise ValidationError({'location': 'An address with local directions is required.'})
        self.suggested_priority = self.calculate_priority()
        if not self.priority_overridden_by_id:
            self.priority = self.suggested_priority
        elif not self.priority_override_reason.strip():
            raise ValidationError({'priority_override_reason': 'A priority override requires a reason.'})

    def calculate_priority(self):
        if self.immediate_rescue_required or self.trapped_person or self.critical_medical_emergency:
            return Priority.CRITICAL
        if self.injured_person or self.child_in_danger or self.elderly_in_danger:
            return Priority.HIGH
        return Priority.NORMAL

    def verify_tracking_code(self, code):
        return bool(code) and check_password(code, self.tracking_code_hash)

    def __str__(self):
        return self.reference

# Services
import secrets

from django.contrib.auth.hashers import make_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from django.core import signing

from Sara.domain import Role, ACTIVE_MISSIONS, Priority, normalize_phone


def requests_for_phone(phone):
    """Find the full request history for the submitted contact number."""
    phone = normalize_phone(phone)
    if not phone:
        return HelpRequest.objects.none()
    return (HelpRequest.objects.filter(contact_phone=phone)
            .select_related('location').prefetch_related('missions')
            .order_by('-created_at', '-pk'))


@transaction.atomic
def submit_request(data, location, requester=None):
    key = data.get('submission_key')
    if key:
        existing = HelpRequest.objects.filter(submission_key=key).first()
        if existing:
            return existing, None
    code = secrets.token_urlsafe(12)
    help_request = HelpRequest(**data, location=location,
                               requester=requester if requester and requester.is_authenticated else None,
                               tracking_code_hash=make_password(code))
    help_request.save()
    return help_request, code


@transaction.atomic
def request_clarification(actor, request_id, question):
    from missions.models import require_request_review
    item = HelpRequest.objects.select_for_update().get(pk=request_id)
    require_request_review(actor, item)
    if item.status != 'pending' or item.missions.filter(status__in=ACTIVE_MISSIONS).exists():
        raise ValidationError('Only an unassigned pending request can be clarified.')
    if not question.strip():
        raise ValidationError('প্রশ্ন আবশ্যক। / A question is required.')
    item.status = 'clarification_needed'
    item.clarification_question = question.strip()
    item.clarification_response = ''
    item.clarification_requested_by = actor
    item.clarification_requested_at = timezone.now()
    item.clarification_responded_at = None
    item.save()
    return item


@transaction.atomic
def respond_to_clarification(request_id, response, *, tracking_grant):
    item = HelpRequest.objects.select_for_update().get(pk=request_id)
    try:
        grant = signing.loads(tracking_grant, salt='shara-tracking', max_age=3600)
    except signing.BadSignature:
        raise ValidationError('ট্র্যাকিং তথ্য আবার দিন। / Enter tracking credentials again.')
    if grant != {'id':str(item.pk), 'hash':item.tracking_code_hash}:
        raise ValidationError('অকার্যকর ট্র্যাকিং অনুমতি। / Invalid tracking permission.')
    if item.status != 'clarification_needed' or not response.strip():
        raise ValidationError('A clarification response is required for a waiting request.')
    item.clarification_response = response.strip()
    item.clarification_responded_at = timezone.now()
    item.status = 'pending'
    item.save()
    return item


@transaction.atomic
def reject_request(actor, request_id, reason):
    from shara_accounts.models import require_role
    require_role(actor, Role.SUPER_ADMIN)
    item = HelpRequest.objects.select_for_update().get(pk=request_id)
    if item.status not in ['pending','clarification_needed'] or item.missions.filter(status__in=ACTIVE_MISSIONS).exists():
        raise ValidationError('End any active mission before rejecting this request.')
    if not reason.strip():
        raise ValidationError('কারণ আবশ্যক। / A reason is required.')
    item.status = 'rejected'
    item.rejection_reason = reason.strip()
    item.rejected_by, item.rejected_at = actor, timezone.now()
    item.closed_at = item.rejected_at
    item.save()
    return item


@transaction.atomic
def override_priority(actor, request_id, priority=None, reason=''):
    from shara_accounts.models import require_role
    require_role(actor, Role.SUPER_ADMIN)
    item = HelpRequest.objects.select_for_update().get(pk=request_id)
    if item.status in ['completed','rejected']:
        raise ValidationError('A closed request is read-only.')
    if priority is None:
        item.priority = item.calculate_priority()
        item.priority_overridden_by = item.priority_overridden_at = None
        item.priority_override_reason = ''
    else:
        if priority not in Priority.values or not reason.strip():
            raise ValidationError('সঠিক অগ্রাধিকার ও কারণ দিন। / Supply a valid priority and reason.')
        item.priority, item.priority_override_reason = priority, reason.strip()
        item.priority_overridden_by, item.priority_overridden_at = actor, timezone.now()
    item.save()
    item.missions.filter(status__in=ACTIVE_MISSIONS).update(priority=item.priority)
    return item
