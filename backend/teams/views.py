from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet, ModelViewSet

from accounts.models import VolunteerProfile
from organizations.models import OrganizationAdmin, OrganizationMembership

from .models import Team, TeamMembership
from .serializers import TeamMemberCreateSerializer, TeamMembershipSerializer, TeamSerializer, TeamWriteSerializer
from .services import assign_team_member, remove_team_member, set_team_leader


def raise_service_error(error):
    if isinstance(error, DjangoPermissionDenied):
        raise PermissionDenied(str(error)) from error
    if isinstance(error, DjangoValidationError):
        messages = error.messages if hasattr(error, "messages") else [str(error)]
        raise serializers.ValidationError({"detail": messages}) from error
    raise error


def admin_organization_ids(user):
    if not user.is_authenticated:
        return []
    return OrganizationAdmin.objects.filter(user=user, status=OrganizationAdmin.Status.ACTIVE).values_list(
        "organization_id", flat=True
    )


class TeamViewSet(ModelViewSet):
    serializer_class = TeamSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Team.objects.select_related("organization").prefetch_related(
            "capabilities", "service_districts", "service_upazilas", "memberships"
        )
        user = self.request.user
        if not user.is_authenticated:
            return queryset.none()
        if user.is_superuser:
            return queryset
        try:
            profile_id = user.volunteer_profile.pk
        except VolunteerProfile.DoesNotExist:
            profile_id = None
        scope = Q(organization_id__in=admin_organization_ids(user))
        if profile_id:
            scope |= Q(memberships__volunteer_id=profile_id, memberships__status=TeamMembership.Status.ACTIVE)
        return queryset.filter(scope).distinct()

    def _require_org_admin(self, team_or_organization):
        organization = getattr(team_or_organization, "organization", team_or_organization)
        if not self.request.user.is_active or not OrganizationAdmin.objects.filter(
            organization=organization,
            user=self.request.user,
            status=OrganizationAdmin.Status.ACTIVE,
        ).exists():
            raise PermissionDenied("An active administrator of this organization is required.")

    def list(self, request, *args, **kwargs):
        if not request.user.is_superuser and not admin_organization_ids(request.user).exists():
            raise PermissionDenied("Only Super Admin or organization administrators can review team lists.")
        rows = self.get_queryset()
        organization_id = request.query_params.get("organization")
        if organization_id:
            rows = rows.filter(organization_id=organization_id)
        return Response(TeamSerializer(rows, many=True).data)

    def create(self, request, *args, **kwargs):
        serializer = TeamWriteSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        team = serializer.save()
        return Response(TeamSerializer(team).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        team = self.get_object()
        return Response(TeamSerializer(team).data)

    def partial_update(self, request, *args, **kwargs):
        team = self.get_object()
        self._require_org_admin(team)
        serializer = TeamWriteSerializer(team, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        team = serializer.save()
        return Response(TeamSerializer(team).data)

    @action(detail=False, methods=["get"], url_path="mine")
    def mine(self, request):
        try:
            profile = request.user.volunteer_profile
        except VolunteerProfile.DoesNotExist:
            return Response({"membership": None, "team": None})
        membership = TeamMembership.objects.filter(
            volunteer=profile, status=TeamMembership.Status.ACTIVE
        ).select_related("team__organization", "volunteer__user", "volunteer__upazila").first()
        if not membership:
            return Response({"membership": None, "team": None})
        return Response(
            {
                "membership": TeamMembershipSerializer(membership).data,
                "team": TeamSerializer(self.get_queryset().get(pk=membership.team_id)).data,
            }
        )

    @action(detail=False, methods=["get"], url_path="eligible-members")
    def eligible_members(self, request):
        organization_id = request.query_params.get("organization")
        if not organization_id or not OrganizationAdmin.objects.filter(
            organization_id=organization_id, user=request.user, status=OrganizationAdmin.Status.ACTIVE
        ).exists():
            raise PermissionDenied("An active administrator of the selected organization is required.")
        active_team_member_ids = TeamMembership.objects.filter(
            status=TeamMembership.Status.ACTIVE
        ).values_list("volunteer_id", flat=True)
        rows = OrganizationMembership.objects.filter(
            organization_id=organization_id,
            status=OrganizationMembership.Status.ACTIVE,
            volunteer__user__is_active=True,
        ).exclude(volunteer_id__in=active_team_member_ids).select_related("volunteer__user").order_by("volunteer__user__name")
        return Response([{"volunteer": row.volunteer_id, "volunteer_name": row.volunteer.user.name} for row in rows])

    @action(detail=True, methods=["get", "post"])
    def members(self, request, pk=None):
        team = self.get_object()
        if request.method == "GET":
            rows = team.memberships.filter(status=TeamMembership.Status.ACTIVE).select_related(
                "volunteer__user", "volunteer__upazila"
            ).prefetch_related("volunteer__skills")
            return Response(TeamMembershipSerializer(rows, many=True).data)
        self._require_org_admin(team)
        serializer = TeamMemberCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            volunteer = VolunteerProfile.objects.get(pk=serializer.validated_data["volunteer"])
            membership = assign_team_member(
                team,
                volunteer,
                request.user,
                serializer.validated_data.get("role", TeamMembership.Role.MEMBER),
            )
        except VolunteerProfile.DoesNotExist as error:
            raise NotFound("The selected volunteer profile was not found.") from error
        except (DjangoPermissionDenied, DjangoValidationError) as error:
            raise_service_error(error)
        return Response(TeamMembershipSerializer(membership).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="set-leader")
    def set_leader(self, request, pk=None):
        team = self.get_object()
        self._require_org_admin(team)
        serializer = TeamMemberCreateSerializer(data={"volunteer": request.data.get("volunteer"), "role": "leader"})
        serializer.is_valid(raise_exception=True)
        try:
            volunteer = VolunteerProfile.objects.get(pk=serializer.validated_data["volunteer"])
            set_team_leader(team, volunteer, request.user)
        except VolunteerProfile.DoesNotExist as error:
            raise NotFound("The selected volunteer profile was not found.") from error
        except (DjangoPermissionDenied, DjangoValidationError) as error:
            raise_service_error(error)
        return Response(TeamSerializer(self.get_queryset().get(pk=team.pk)).data)


class TeamMembershipViewSet(GenericViewSet):
    serializer_class = TeamMembershipSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TeamMembership.objects.filter(
            team__organization_id__in=admin_organization_ids(self.request.user)
        ).select_related("team__organization", "volunteer__user", "volunteer__upazila").prefetch_related(
            "volunteer__skills"
        )

    @action(detail=True, methods=["post"])
    def remove(self, request, pk=None):
        membership = self.get_object()
        try:
            membership = remove_team_member(membership, request.user)
        except (DjangoPermissionDenied, DjangoValidationError) as error:
            raise_service_error(error)
        return Response(TeamMembershipSerializer(membership).data)
