from rest_framework import serializers

from .models import Mission, MissionAssignment, MissionUpdate


class MissionAssignmentSerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(source="team.name", read_only=True)
    leader_name = serializers.CharField(source="assigned_team_leader.name", read_only=True)

    class Meta:
        model = MissionAssignment
        fields = [
            "id", "team", "team_name", "assigned_team_leader", "leader_name", "assigned_by",
            "is_active", "assignment_note", "assigned_at", "ended_at",
        ]
        read_only_fields = fields


class MissionUpdateSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.name", read_only=True)

    class Meta:
        model = MissionUpdate
        fields = ["id", "actor", "actor_name", "status", "note", "created_at"]
        read_only_fields = fields


class MissionSerializer(serializers.ModelSerializer):
    assignments = MissionAssignmentSerializer(many=True, read_only=True)
    updates = MissionUpdateSerializer(many=True, read_only=True)

    class Meta:
        model = Mission
        fields = ["id", "help_request", "created_by", "status", "assignments", "updates", "created_at", "updated_at"]
        read_only_fields = fields
