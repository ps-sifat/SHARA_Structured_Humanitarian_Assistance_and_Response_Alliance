from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Q
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet, ModelViewSet, ReadOnlyModelViewSet

from accounts.models import VolunteerProfile
from accounts.permissions import IsSuperAdmin

from .models import MembershipRequest, Organization, OrganizationAdmin, OrganizationMembership
from .permissions import IsOrganizationAdmin
from .serializers import (
    MembershipDecisionSerializer,
    MembershipRequestCreateSerializer,
    MembershipRequestSerializer,
    OrganizationMembershipSerializer,
    OrganizationProfileUpdateSerializer,
    OrganizationPublicSerializer,
    OrganizationRegistrationSerializer,
    OrganizationReviewSerializer,
    OrganizationSerializer,
)
from .services import (
    approve_membership_request,
    approve_organization_registration,
    create_membership_request,
    reject_membership_request,
    reject_organization_registration,
    withdraw_membership_request,
)


def raise_api_service_error(error):
    if isinstance(error, DjangoPermissionDenied):
        raise PermissionDenied(str(error)) from error
    if isinstance(error, DjangoValidationError):
        messages = error.messages if hasattr(error, "messages") else [str(error)]
        raise serializers.ValidationError({"detail": messages}) from error
    raise error


class OrganizationViewSet(ModelViewSet):
    queryset = Organization.objects.filter(
        is_active=True, registration_status=Organization.RegistrationStatus.APPROVED
    ).prefetch_related("service_districts", "service_upazilas__district")
    serializer_class = OrganizationSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            classes = [AllowAny]
        elif self.action == "create":
            classes = [IsAuthenticated]
        elif self.action == "mine":
            classes = [IsAuthenticated]
        elif self.action in {"review_queue", "approve", "reject"}:
            classes = [IsSuperAdmin]
        elif self.action in {"membership_requests", "memberships", "partial_update"}:
            classes = [IsOrganizationAdmin]
        else:
            classes = [IsAuthenticated]
        if self.action == "membership_requests" and self.request.method == "POST":
            classes = [IsAuthenticated]
        return [permission() for permission in classes]

    def get_queryset(self):
        if self.action in {"approve", "reject"}:
            return Organization.objects.filter(registration_status=Organization.RegistrationStatus.PENDING)
        if self.action == "mine":
            return Organization.objects.filter(
                Q(registered_by=self.request.user)
                | Q(administrators__user=self.request.user, administrators__status=OrganizationAdmin.Status.ACTIVE)
            ).distinct().prefetch_related("service_districts", "service_upazilas__district")
        if self.action == "review_queue":
            return Organization.objects.filter(registration_status=Organization.RegistrationStatus.PENDING).select_related(
                "registered_by"
            )
        return super().get_queryset()

    def get_serializer_class(self):
        if self.action == "create":
            return OrganizationRegistrationSerializer
        if self.action in {"partial_update", "update"}:
            return OrganizationProfileUpdateSerializer
        if self.action in {"list", "retrieve"}:
            if self.action == "retrieve" and self.request.user.is_authenticated and OrganizationAdmin.objects.filter(
                organization_id=self.kwargs.get("pk"), user=self.request.user, status=OrganizationAdmin.Status.ACTIVE
            ).exists():
                return OrganizationSerializer
            return OrganizationPublicSerializer
        return OrganizationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            organization = serializer.save(registered_by=request.user)
        return Response(OrganizationSerializer(organization).data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        with transaction.atomic():
            serializer.save()

    @action(detail=False, methods=["get"], url_path="mine", permission_classes=[IsAuthenticated])
    def mine(self, request):
        organizations = self.get_queryset()
        return Response(OrganizationSerializer(organizations, many=True).data)

    @action(detail=False, methods=["get"], url_path="review-queue", permission_classes=[IsSuperAdmin])
    def review_queue(self, request):
        organizations = self.get_queryset()
        return Response(OrganizationReviewSerializer(organizations, many=True).data)

    @action(detail=True, methods=["post"], permission_classes=[IsSuperAdmin])
    def approve(self, request, pk=None):
        organization = self.get_object()
        try:
            organization = approve_organization_registration(organization, request.user)
        except (DjangoPermissionDenied, DjangoValidationError) as error:
            raise_api_service_error(error)
        return Response(OrganizationSerializer(organization).data)

    @action(detail=True, methods=["post"], permission_classes=[IsSuperAdmin])
    def reject(self, request, pk=None):
        organization = self.get_object()
        serializer = MembershipDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data.get("reason", "").strip()
        if not reason:
            raise serializers.ValidationError({"reason": ["A rejection reason is required."]})
        try:
            organization = reject_organization_registration(organization, request.user, reason)
        except (DjangoPermissionDenied, DjangoValidationError) as error:
            raise_api_service_error(error)
        return Response(OrganizationSerializer(organization).data)

    @action(detail=True, methods=["get", "post"], url_path="membership-requests")
    def membership_requests(self, request, pk=None):
        organization = self.get_object()
        if request.method == "GET":
            rows = MembershipRequest.objects.filter(organization=organization).select_related(
                "volunteer__user", "volunteer__district", "volunteer__upazila", "reviewed_by"
            ).prefetch_related("volunteer__skills")
            return Response(MembershipRequestSerializer(rows, many=True).data)

        serializer = MembershipRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            volunteer = request.user.volunteer_profile
        except VolunteerProfile.DoesNotExist:
            raise serializers.ValidationError({"detail": "A volunteer profile is required to request membership."})
        try:
            membership_request = create_membership_request(
                organization, volunteer, serializer.validated_data.get("request_note", "")
            )
        except (DjangoPermissionDenied, DjangoValidationError) as error:
            raise_api_service_error(error)
        return Response(
            MembershipRequestSerializer(membership_request).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"])
    def memberships(self, request, pk=None):
        organization = self.get_object()
        memberships = OrganizationMembership.objects.filter(organization=organization).select_related(
            "volunteer__user", "request", "approved_by"
        )
        return Response(OrganizationMembershipSerializer(memberships, many=True).data)


class MembershipRequestViewSet(GenericViewSet):
    serializer_class = MembershipRequestSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return MembershipRequest.objects.none()
        if self.action in {"approve", "reject"}:
            organization_ids = OrganizationAdmin.objects.filter(
                user=user, status=OrganizationAdmin.Status.ACTIVE
            ).values_list("organization_id", flat=True)
            return MembershipRequest.objects.filter(organization_id__in=organization_ids).select_related(
                "organization", "volunteer__user", "volunteer__district", "volunteer__upazila", "reviewed_by"
            ).prefetch_related("volunteer__skills")
        try:
            profile_id = user.volunteer_profile.pk
        except VolunteerProfile.DoesNotExist:
            return MembershipRequest.objects.none()
        return MembershipRequest.objects.filter(volunteer_id=profile_id).select_related(
            "organization", "volunteer__user", "volunteer__district", "volunteer__upazila", "reviewed_by"
        ).prefetch_related("volunteer__skills")

    def get_permissions(self):
        if self.action in {"approve", "reject"}:
            return [IsOrganizationAdmin()]
        return [IsAuthenticated()]

    @action(detail=False, methods=["get"], url_path="mine", permission_classes=[IsAuthenticated])
    def mine(self, request):
        return Response(MembershipRequestSerializer(self.get_queryset(), many=True).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def withdraw(self, request, pk=None):
        membership_request = self.get_object()
        try:
            membership_request = withdraw_membership_request(membership_request, request.user)
        except (DjangoPermissionDenied, DjangoValidationError) as error:
            raise_api_service_error(error)
        return Response(MembershipRequestSerializer(membership_request).data)

    @action(detail=True, methods=["post"], permission_classes=[IsOrganizationAdmin])
    def approve(self, request, pk=None):
        membership_request = self.get_object()
        try:
            membership = approve_membership_request(membership_request, request.user)
        except (DjangoPermissionDenied, DjangoValidationError) as error:
            raise_api_service_error(error)
        return Response(MembershipRequestSerializer(membership.request).data)

    @action(detail=True, methods=["post"], permission_classes=[IsOrganizationAdmin])
    def reject(self, request, pk=None):
        membership_request = self.get_object()
        serializer = MembershipDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data.get("reason", "").strip()
        if not reason:
            raise serializers.ValidationError({"reason": ["A rejection reason is required."]})
        try:
            membership_request = reject_membership_request(membership_request, request.user, reason)
        except (DjangoPermissionDenied, DjangoValidationError) as error:
            raise_api_service_error(error)
        return Response(MembershipRequestSerializer(membership_request).data)


class OrganizationMembershipViewSet(ReadOnlyModelViewSet):
    serializer_class = OrganizationMembershipSerializer
    http_method_names = ["get", "head", "options"]

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return OrganizationMembership.objects.none()
        try:
            profile_id = self.request.user.volunteer_profile.pk
        except VolunteerProfile.DoesNotExist:
            return OrganizationMembership.objects.none()
        return OrganizationMembership.objects.filter(volunteer_id=profile_id).select_related("organization", "request")

    @action(detail=False, methods=["get"], url_path="mine", permission_classes=[IsAuthenticated])
    def mine(self, request):
        return Response(OrganizationMembershipSerializer(self.get_queryset(), many=True).data)
