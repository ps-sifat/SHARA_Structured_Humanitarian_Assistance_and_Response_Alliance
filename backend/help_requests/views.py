import hashlib
import hmac
import json
import secrets
from base64 import urlsafe_b64encode

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from accounts.permissions import IsSuperAdmin
from missions.services import team_suitability
from teams.models import Team

from .models import HelpRequest, RequestClarification
from .serializers import (
    ClarificationSubmissionSerializer,
    HelpRequestCreateSerializer,
    HelpRequestDetailSerializer,
    HelpRequestQueueSerializer,
    RequestTrackingSerializer,
    ReviewReasonSerializer,
    SafeOpenRequestSerializer,
    TrackingAccessSerializer,
)
from .services import (
    reject_help_request,
    request_help_clarification,
    resolve_help_clarification,
    verify_help_request,
)


def make_tracking_token(idempotency_key, request_code):
    material = f"SHARA tracking token:{idempotency_key}:{request_code}".encode("utf-8")
    digest = hmac.new(settings.SECRET_KEY.encode("utf-8"), material, hashlib.sha256).digest()
    return urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def raise_service_error(error):
    if isinstance(error, DjangoValidationError):
        messages = error.messages if hasattr(error, "messages") else [str(error)]
        raise serializers.ValidationError({"detail": messages}) from error
    raise error


class HelpRequestViewSet(GenericViewSet):
    queryset = HelpRequest.objects.select_related("district", "upazila", "reviewed_by").prefetch_related(
        "assistance_categories", "clarifications__requested_by", "clarifications__reviewed_by"
    )

    def get_permissions(self):
        if self.action in {"create", "assistance_categories", "track", "submit_clarification"}:
            return [AllowAny()]
        if self.action == "safe_open":
            return [IsAuthenticated()]
        if self.action in {"list", "retrieve", "verify", "reject", "clarify", "resolve_clarification", "eligible_teams"}:
            return [IsSuperAdmin()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "create":
            return HelpRequestCreateSerializer
        if self.action == "retrieve":
            return HelpRequestDetailSerializer
        return HelpRequestQueueSerializer

    @action(detail=False, methods=["get"], url_path="assistance-categories", permission_classes=[AllowAny])
    def assistance_categories(self, request):
        from .models import AssistanceCategory

        rows = AssistanceCategory.objects.filter(is_active=True)
        return Response([{"id": row.id, "code": row.code, "name_bn": row.name_bn, "name_en": row.name_en} for row in rows])

    @action(detail=False, methods=["get"], url_path="safe-open", permission_classes=[IsAuthenticated])
    def safe_open(self, request):
        from missions.models import Mission

        if not hasattr(request.user, "volunteer_profile"):
            raise PermissionDenied("A volunteer profile is required to view request summaries.")
        rows = self.get_queryset().filter(verification_status=HelpRequest.VerificationStatus.VERIFIED).filter(
            Q(mission__isnull=True)
            | Q(mission__status__in=[Mission.Status.AWAITING_ASSIGNMENT, Mission.Status.FAILED])
        ).distinct()
        return Response(SafeOpenRequestSerializer(rows, many=True).data)

    def get_queryset(self):
        return self.queryset

    def list(self, request):
        rows = self.get_queryset()
        if request.query_params.get("verification"):
            rows = rows.filter(verification_status=request.query_params["verification"])
        return Response(HelpRequestQueueSerializer(rows, many=True).data)

    def retrieve(self, request, pk=None):
        return Response(HelpRequestDetailSerializer(self.get_object()).data)

    def create(self, request):
        key = request.headers.get("Idempotency-Key", "").strip()
        if len(key) < 8 or len(key) > 128:
            raise serializers.ValidationError({"Idempotency-Key": ["Provide a unique request key (8–128 characters)."]})
        serializer = HelpRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        categories = data.pop("assistance_categories")
        canonical = {key: value for key, value in data.items()}
        canonical["assistance_categories"] = sorted(category.pk for category in categories)
        fingerprint = hashlib.sha256(
            json.dumps(canonical, sort_keys=True, default=lambda value: value.pk, ensure_ascii=False).encode("utf-8")
        ).hexdigest()

        try:
            with transaction.atomic():
                existing = HelpRequest.objects.select_for_update().filter(idempotency_key=key).first()
                if existing:
                    same_payload = secrets.compare_digest(existing.request_fingerprint, fingerprint)
                    if not same_payload:
                        return Response(
                            {"detail": "This request key was already used with different submission details."},
                            status=status.HTTP_409_CONFLICT,
                        )
                    created = existing
                    response_status = status.HTTP_200_OK
                else:
                    user = request.user if request.user.is_authenticated else None
                    created = HelpRequest.objects.create(
                        **data,
                        submitted_by=user,
                        idempotency_key=key,
                        request_fingerprint=fingerprint,
                    )
                    created.assistance_categories.set(categories)
                    tracking_token = make_tracking_token(key, created.request_code)
                    created.tracking_token_hash = hashlib.sha256(tracking_token.encode("utf-8")).hexdigest()
                    created.save(update_fields=["tracking_token_hash", "updated_at"])
                    response_status = status.HTTP_201_CREATED
        except IntegrityError:
            # A concurrent retry can race the initial lookup. Re-read the winning row
            # after the failed transaction and apply the same payload check.
            existing = HelpRequest.objects.filter(idempotency_key=key).first()
            if not existing:
                raise
            same_payload = secrets.compare_digest(existing.request_fingerprint, fingerprint)
            if not same_payload:
                return Response({"detail": "This request key was already used with different submission details."}, status=409)
            created = existing
            response_status = status.HTTP_200_OK

        tracking_token = make_tracking_token(key, created.request_code)
        expected_hash = hashlib.sha256(tracking_token.encode("utf-8")).hexdigest()
        if not secrets.compare_digest(created.tracking_token_hash, expected_hash):
            raise serializers.ValidationError({"detail": "The tracking credential could not be restored. Submit a new request key."})

        return Response(
            {
                "request_reference": created.request_code,
                "tracking_token": tracking_token,
                "verification_status": created.verification_status,
                "district": created.district.name_en or created.district.name_bn,
                "upazila": created.upazila.name_en or created.upazila.name_bn,
            },
            status=response_status,
        )

    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def track(self, request):
        serializer = TrackingAccessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reference = serializer.validated_data["reference"].strip().upper()
        token_hash = hashlib.sha256(serializer.validated_data["token"].encode("utf-8")).hexdigest()
        record = self.get_queryset().filter(request_code=reference).first()
        if not record or not secrets.compare_digest(record.tracking_token_hash, token_hash):
            raise NotFound("The reference and tracking token did not match.")
        return Response(RequestTrackingSerializer(record).data)

    @action(detail=False, methods=["post"], url_path="clarification", permission_classes=[AllowAny])
    def submit_clarification(self, request):
        serializer = ClarificationSubmissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        token_hash = hashlib.sha256(values["token"].encode("utf-8")).hexdigest()
        with transaction.atomic():
            record = HelpRequest.objects.select_for_update().filter(request_code=values["reference"].strip().upper()).first()
            if not record or not secrets.compare_digest(record.tracking_token_hash, token_hash):
                raise NotFound("The reference and tracking token did not match.")
            if record.verification_status != HelpRequest.VerificationStatus.CLARIFICATION:
                raise serializers.ValidationError({"detail": "This request is not waiting for clarification."})
            item = record.clarifications.filter(status=RequestClarification.Status.REQUESTED).order_by("-created_at").first()
            if not item:
                raise serializers.ValidationError({"detail": "No open clarification request was found."})
            item.applicant_message = values["message"]
            item.status = RequestClarification.Status.SUBMITTED
            item.submitted_at = timezone.now()
            item.save(update_fields=["applicant_message", "status", "submitted_at", "updated_at"])
            record.verification_status = HelpRequest.VerificationStatus.PENDING
            record.save(update_fields=["verification_status", "updated_at"])
        return Response({"detail": "Clarification received for review."}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):
        try:
            record = verify_help_request(self.get_object(), request.user)
        except DjangoValidationError as error:
            raise_service_error(error)
        return Response(HelpRequestDetailSerializer(record).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        reason = ReviewReasonSerializer(data=request.data)
        reason.is_valid(raise_exception=True)
        try:
            record = reject_help_request(self.get_object(), request.user, reason.validated_data["reason"])
        except DjangoValidationError as error:
            raise_service_error(error)
        return Response(HelpRequestDetailSerializer(record).data)

    @action(detail=True, methods=["post"])
    def clarify(self, request, pk=None):
        reason = ReviewReasonSerializer(data=request.data)
        reason.is_valid(raise_exception=True)
        try:
            request_help_clarification(self.get_object(), request.user, reason.validated_data["reason"])
        except DjangoValidationError as error:
            raise_service_error(error)
        return Response(HelpRequestDetailSerializer(self.get_object()).data)

    @action(detail=True, methods=["post"], url_path="resolve-clarification")
    def resolve_clarification(self, request, pk=None):
        reason = ReviewReasonSerializer(data=request.data)
        reason.is_valid(raise_exception=True)
        try:
            resolve_help_clarification(self.get_object(), request.user, reason.validated_data["reason"])
        except DjangoValidationError as error:
            raise_service_error(error)
        return Response(HelpRequestDetailSerializer(self.get_object()).data)

    @action(detail=True, methods=["get"], url_path="eligible-teams")
    def eligible_teams(self, request, pk=None):
        record = self.get_object()
        if record.verification_status != HelpRequest.VerificationStatus.VERIFIED:
            raise serializers.ValidationError({"detail": "Only a verified request can be dispatched."})
        teams = Team.objects.select_related("organization").filter(
            is_active=True,
            organization__is_active=True,
            organization__registration_status="approved",
        )
        matches = []
        for team in teams:
            result = team_suitability(team, record)
            if result["eligible"]:
                matches.append(
                    {
                        "id": team.pk,
                        "name": team.name,
                        "organization_name": team.organization.name,
                        "availability": team.availability,
                        "score": result["score"],
                        "reasons": result["reasons"],
                    }
                )
        matches.sort(key=lambda row: (-row["score"], row["organization_name"].casefold(), row["name"].casefold()))
        return Response(matches)
