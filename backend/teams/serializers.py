from rest_framework import serializers

from .models import Team, TeamMembership


class TeamMembershipSerializer(serializers.ModelSerializer):
    volunteer_name = serializers.CharField(source="volunteer.user.name", read_only=True)

    class Meta:
        model = TeamMembership
        fields = ["id", "volunteer", "volunteer_name", "role", "status", "assigned_at", "ended_at"]
        read_only_fields = fields


class TeamSerializer(serializers.ModelSerializer):
    memberships = TeamMembershipSerializer(many=True, read_only=True)

    class Meta:
        model = Team
        fields = [
            "id", "organization", "name", "description", "is_active", "availability", "capabilities",
            "service_districts", "service_upazilas", "memberships", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "memberships", "created_at", "updated_at"]
