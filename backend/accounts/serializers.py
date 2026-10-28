from rest_framework import serializers

from .models import Skill, User, VolunteerProfile


class UserSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "name", "phone_number", "email"]
        read_only_fields = fields


class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ["id", "name", "description", "is_active"]
        read_only_fields = fields


class VolunteerProfileSerializer(serializers.ModelSerializer):
    user = UserSummarySerializer(read_only=True)
    skills = SkillSerializer(many=True, read_only=True)

    class Meta:
        model = VolunteerProfile
        fields = [
            "id", "user", "district", "upazila", "service_upazilas", "skills",
            "availability", "vehicle_access", "swimming_capability", "profile_image_url",
        ]
        read_only_fields = fields
