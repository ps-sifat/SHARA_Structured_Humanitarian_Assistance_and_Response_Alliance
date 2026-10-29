from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from organizations.models import OrganizationAdmin

from .models import VolunteerProfile
from .serializers import (
    VolunteerProfileSerializer,
    VolunteerProfileUpdateSerializer,
    VolunteerRegistrationSerializer,
)


def session_user_payload(user):
    try:
        volunteer_profile = user.volunteer_profile
    except VolunteerProfile.DoesNotExist:
        volunteer_profile = None

    admin_relationships = OrganizationAdmin.objects.filter(
        user=user, status=OrganizationAdmin.Status.ACTIVE, organization__is_active=True,
        organization__registration_status="approved",
    ).select_related("organization")
    organizations = [
        {"id": relationship.organization_id, "name": relationship.organization.name}
        for relationship in admin_relationships
    ]
    applications = list(
        user.organization_registrations.order_by("-created_at").values(
            "id", "name", "registration_status", "review_note", "created_at"
        )
    )
    workspaces = []
    if user.is_active and user.is_superuser:
        workspaces.append({"type": "super_admin", "label": "Super Admin", "path": "/admin"})
    if volunteer_profile:
        workspaces.append({"type": "volunteer", "label": "Volunteer", "path": "/volunteer"})
    workspaces.extend(
        {
            "type": "organization_admin",
            "organization_id": organization["id"],
            "label": organization["name"],
            "path": "/org",
        }
        for organization in organizations
    )
    return {
        "id": user.pk,
        "name": user.name,
        "phone_number": user.phone_number,
        "email": user.email,
        "is_super_admin": bool(user.is_active and user.is_superuser),
        "is_volunteer": volunteer_profile is not None,
        "is_organization_admin": bool(organizations),
        "volunteer_profile_id": volunteer_profile.pk if volunteer_profile else None,
        "organizations": organizations,
        "organization_applications": applications,
        "workspaces": workspaces,
    }


@ensure_csrf_cookie
def csrf_cookie(request):
    return JsonResponse({"csrfToken": get_token(request)})


class CurrentUserView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        user = request.user
        return Response({"user": session_user_payload(user) if user.is_authenticated else None})


@method_decorator(csrf_protect, name="dispatch")
class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VolunteerRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                user = serializer.save()
        except IntegrityError:
            # Covers a duplicate phone/email submitted concurrently with another registration.
            return Response(
                {"detail": "An account with this phone number or email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        login(request, user, backend="accounts.backends.IdentifierBackend")
        return Response({"user": session_user_payload(user)}, status=status.HTTP_201_CREATED)


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=254, trim_whitespace=False, allow_blank=False)
    password = serializers.CharField(trim_whitespace=False, allow_blank=False)


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"detail": "Unable to log in with provided credentials."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        identifier = serializer.validated_data["identifier"]
        password = serializer.validated_data["password"]
        user = authenticate(request, identifier=identifier, password=password)
        if user is None:
            return Response(
                {"detail": "Unable to log in with provided credentials."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        login(request, user)
        return Response({"user": session_user_payload(user)})


@method_decorator(csrf_protect, name="dispatch")
class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)


class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not request.user.check_password(serializer.validated_data["current_password"]):
            return Response(
                {"current_password": ["The current password is incorrect."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            validate_password(serializer.validated_data["new_password"], user=request.user)
        except DjangoValidationError as error:
            return Response({"new_password": error.messages}, status=status.HTTP_400_BAD_REQUEST)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password", "updated_at"])
        update_session_auth_hash(request, request.user)
        return Response({"detail": "Password updated."})


class VolunteerProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get_profile(self, request):
        try:
            return request.user.volunteer_profile
        except VolunteerProfile.DoesNotExist:
            return None

    def get(self, request):
        profile = self.get_profile(request)
        if profile is None:
            return Response({"detail": "Volunteer profile not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(VolunteerProfileSerializer(profile).data)

    def patch(self, request):
        profile = self.get_profile(request)
        if profile is None:
            return Response({"detail": "Volunteer profile not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = VolunteerProfileUpdateSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                profile = serializer.save()
        except IntegrityError:
            return Response(
                {"detail": "A phone number or email for this account is already in use."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(VolunteerProfileSerializer(profile).data)
