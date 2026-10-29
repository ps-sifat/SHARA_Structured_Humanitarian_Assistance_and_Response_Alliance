from rest_framework import serializers

from accounts.models import VolunteerProfile
from help_requests.models import HelpRequest
from teams.models import TeamMembership

from .models import Mission, MissionAssignment, MissionUpdate


class MissionRequestSummarySerializer(serializers.ModelSerializer):
    district = serializers.CharField(source="district.name_en", read_only=True)
    upazila = serializers.CharField(source="upazila.name_en", read_only=True)
    assistance_categories = serializers.SerializerMethodField()

    class Meta:
        model = HelpRequest
        fields = ["id", "request_code", "district", "upazila", "people_affected", "assistance_categories", "priority"]
        read_only_fields = fields

    def get_assistance_categories(self, obj):
        return list(obj.assistance_categories.values_list("name_en", flat=True))


class MissionAssignmentSerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(source="team.name", read_only=True)
    organization_name = serializers.CharField(source="team.organization.name", read_only=True)
    leader_name = serializers.CharField(source="assigned_team_leader.name", read_only=True)
    assigned_by_name = serializers.CharField(source="assigned_by.name", read_only=True)

    class Meta:
        model = MissionAssignment
        fields = [
            "id", "team", "team_name", "organization_name", "assigned_team_leader", "leader_name",
            "assigned_by", "assigned_by_name", "is_active", "assignment_note", "assigned_at", "ended_at",
        ]
        read_only_fields = fields


class MissionUpdateSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.name", read_only=True)

    class Meta:
        model = MissionUpdate
        fields = ["id", "actor", "actor_name", "status", "action", "note", "created_at"]
        read_only_fields = fields


class MissionSerializer(serializers.ModelSerializer):
    help_request = MissionRequestSummarySerializer(read_only=True)
    assignments = serializers.SerializerMethodField()
    updates = MissionUpdateSerializer(many=True, read_only=True)
    is_assigned_leader = serializers.SerializerMethodField()

    class Meta:
        model = Mission
        fields = [
            "id", "help_request", "status", "assignments", "updates", "is_assigned_leader", "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_assignments(self, obj):
        user = self.context["request"].user
        rows = obj.assignments.select_related(
            "team__organization", "assigned_team_leader", "assigned_by"
        ).all()
        if user.is_superuser:
            allowed = rows
        else:
            organization_ids = set(
                user.organization_admin_roles.filter(status="active").values_list("organization_id", flat=True)
            )
            try:
                profile = user.volunteer_profile
            except VolunteerProfile.DoesNotExist:
                team_ids = set()
            else:
                team_ids = set(
                    TeamMembership.objects.filter(
                        volunteer=profile, status=TeamMembership.Status.ACTIVE
                    ).values_list("team_id", flat=True)
                )
            allowed = [row for row in rows if row.team.organization_id in organization_ids or row.team_id in team_ids]
        return MissionAssignmentSerializer(allowed, many=True).data

    def get_is_assigned_leader(self, obj):
        active = obj.assignments.filter(is_active=True).first()
        return bool(active and active.assigned_team_leader_id == self.context["request"].user.pk)


class MissionTransitionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(
        choices=[
            "assign", "acknowledge", "decline", "start", "progress", "complete", "report_problem",
            "unable_to_continue", "resolve_problem", "cancel", "fail",
        ]
    )
    team_id = serializers.IntegerField(min_value=1, required=False)
    reason = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")

    def validate(self, attrs):
        if attrs["action"] == "assign" and not attrs.get("team_id"):
            raise serializers.ValidationError({"team_id": "Choose an eligible team for assignment."})
        return attrs
