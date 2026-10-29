from django.db.models import Q
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from accounts.models import VolunteerProfile
from organizations.models import OrganizationAdmin
from teams.models import Team, TeamMembership

from .models import Mission
from .serializers import MissionSerializer, MissionTransitionSerializer
from .services import assign_mission_to_team, transition_mission


class MissionViewSet(GenericViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Mission.objects.select_related(
            "help_request__district", "help_request__upazila"
        ).prefetch_related("help_request__assistance_categories", "assignments", "updates")
        user = self.request.user
        if not user.is_authenticated:
            return queryset.none()
        if user.is_superuser:
            return queryset
        organization_ids = OrganizationAdmin.objects.filter(
            user=user, status=OrganizationAdmin.Status.ACTIVE
        ).values_list("organization_id", flat=True)
        scope = Q(assignments__team__organization_id__in=organization_ids)
        try:
            profile_id = user.volunteer_profile.pk
        except VolunteerProfile.DoesNotExist:
            profile_id = None
        if profile_id:
            scope |= Q(
                assignments__team__memberships__volunteer_id=profile_id,
                assignments__team__memberships__status=TeamMembership.Status.ACTIVE,
            )
        return queryset.filter(scope).distinct()

    def list(self, request):
        rows = self.get_queryset()
        status_filter = request.query_params.get("status")
        if status_filter:
            if status_filter == "active":
                rows = rows.exclude(status__in=[Mission.Status.DONE, Mission.Status.CANCELLED, Mission.Status.FAILED])
            elif status_filter == "history":
                rows = rows.filter(status__in=[Mission.Status.DONE, Mission.Status.CANCELLED, Mission.Status.FAILED])
            else:
                rows = rows.filter(status=status_filter)
        return Response(MissionSerializer(rows, many=True, context={"request": request}).data)

    def retrieve(self, request, pk=None):
        mission = self.get_object()
        return Response(MissionSerializer(mission, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="transition")
    def transition(self, request, pk=None):
        mission = self.get_object()
        serializer = MissionTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        try:
            if values["action"] == "assign":
                team = Team.objects.select_related("organization").filter(pk=values["team_id"]).first()
                if not team:
                    raise NotFound("The selected team was not found.")
                assign_mission_to_team(mission, team, request.user, values.get("reason", ""))
            else:
                transition_mission(mission, request.user, values["action"], values.get("reason", ""))
        except NotFound:
            raise
        except DjangoPermissionDenied as error:
            raise PermissionDenied(str(error)) from error
        except DjangoValidationError as error:
            messages = error.messages if hasattr(error, "messages") else [str(error)]
            raise serializers.ValidationError({"detail": messages}) from error
        mission.refresh_from_db()
        return Response(MissionSerializer(mission, context={"request": request}).data)
