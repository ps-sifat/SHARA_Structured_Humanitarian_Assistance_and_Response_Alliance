from rest_framework import serializers

from .models import AssistanceCategory, HelpRequest


class AssistanceCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AssistanceCategory
        fields = ["id", "code", "name_bn", "name_en", "is_active"]
        read_only_fields = fields


class HelpRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = HelpRequest
        fields = [
            "reporter_type", "affected_person_name", "contact_phone", "reporter_name", "reporter_phone",
            "relation_to_affected", "district", "upazila", "people_affected", "assistance_categories",
            "description",
        ]

    def validate(self, attrs):
        district = attrs.get("district")
        upazila = attrs.get("upazila")
        if district and upazila and upazila.district_id != district.id:
            raise serializers.ValidationError({"upazila": "The upazila must belong to the selected district."})
        if attrs.get("reporter_type") == HelpRequest.ReporterType.PROXY and not attrs.get(
            "relation_to_affected", ""
        ).strip():
            raise serializers.ValidationError({"relation_to_affected": "This field is required for proxy requests."})
        return attrs


class HelpRequestPublicSerializer(serializers.ModelSerializer):
    assistance_categories = AssistanceCategorySerializer(many=True, read_only=True)

    class Meta:
        model = HelpRequest
        fields = [
            "request_code", "district", "upazila", "people_affected", "assistance_categories",
            "priority", "verification_status", "created_at", "updated_at",
        ]
        read_only_fields = fields


class HelpRequestDetailSerializer(HelpRequestPublicSerializer):
    class Meta(HelpRequestPublicSerializer.Meta):
        fields = HelpRequestPublicSerializer.Meta.fields + [
            "reporter_type", "affected_person_name", "contact_phone", "reporter_name", "reporter_phone",
            "relation_to_affected", "description", "risks", "review_note", "reviewed_by", "reviewed_at",
        ]
        read_only_fields = fields
