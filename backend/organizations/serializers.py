from rest_framework import serializers

from .models import MembershipRequest, Organization, OrganizationAdmin, OrganizationMembership


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = [
            "id", "name", "description", "organization_type", "contact_email", "contact_phone",
            "office_district", "office_upazila", "service_districts", "service_upazilas",
            "registration_status", "review_note", "profile_image_url", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "registration_status", "review_note", "created_at", "updated_at"]


class OrganizationRegistrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = [
            "name", "description", "organization_type", "contact_email", "contact_phone",
            "office_district", "office_upazila", "service_districts", "service_upazilas",
        ]


class OrganizationAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganizationAdmin
        fields = ["id", "organization", "user", "status", "assigned_at", "ended_at"]
        read_only_fields = fields


class MembershipRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = MembershipRequest
        fields = [
            "id", "organization", "volunteer", "request_note", "status", "decision_note",
            "reviewed_by", "reviewed_at", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "status", "decision_note", "reviewed_by", "reviewed_at", "created_at", "updated_at"]


class OrganizationMembershipSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganizationMembership
        fields = ["id", "organization", "volunteer", "request", "approved_by", "status", "started_at", "ended_at"]
        read_only_fields = fields
