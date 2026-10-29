from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError

from accounts.phone import normalize_bd_phone
from .models import AssistanceCategory, HelpRequest, RequestClarification


class AssistanceCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AssistanceCategory
        fields = ["id", "code", "name_bn", "name_en", "is_active"]
        read_only_fields = fields


class HelpRequestCreateSerializer(serializers.ModelSerializer):
    people_affected = serializers.IntegerField(min_value=1)
    assistance_categories = serializers.ListField(
        child=serializers.PrimaryKeyRelatedField(queryset=AssistanceCategory.objects.filter(is_active=True)),
        min_length=1,
    )
    risks = serializers.ListField(
        child=serializers.CharField(max_length=120, allow_blank=False), required=False, default=list, max_length=12
    )

    class Meta:
        model = HelpRequest
        fields = [
            "reporter_type", "affected_person_name", "contact_phone", "reporter_name", "reporter_phone",
            "relation_to_affected", "district", "upazila", "people_affected", "assistance_categories",
            "description", "risks",
        ]

    def validate_contact_phone(self, value):
        try:
            return normalize_bd_phone(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError("Enter a valid Bangladesh mobile number.") from error

    def validate_reporter_phone(self, value):
        if not value:
            return ""
        try:
            return normalize_bd_phone(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError("Enter a valid Bangladesh mobile number.") from error

    def validate(self, attrs):
        district = attrs.get("district")
        upazila = attrs.get("upazila")
        if district and upazila and upazila.district_id != district.id:
            raise serializers.ValidationError({"upazila": "The upazila must belong to the selected district."})
        if attrs.get("reporter_type") == HelpRequest.ReporterType.PROXY:
            required = {
                "reporter_name": attrs.get("reporter_name", "").strip(),
                "reporter_phone": attrs.get("reporter_phone", "").strip(),
                "relation_to_affected": attrs.get("relation_to_affected", "").strip(),
            }
            missing = [field for field, value in required.items() if not value]
            if missing:
                raise serializers.ValidationError({field: "This field is required for proxy requests." for field in missing})
        attrs["affected_person_name"] = attrs.get("affected_person_name", "").strip()
        attrs["reporter_name"] = attrs.get("reporter_name", "").strip()
        attrs["relation_to_affected"] = attrs.get("relation_to_affected", "").strip()
        return attrs


class HelpRequestQueueSerializer(serializers.ModelSerializer):
    district_name = serializers.CharField(source="district.name_en", read_only=True)
    upazila_name = serializers.CharField(source="upazila.name_en", read_only=True)
    assistance_categories = AssistanceCategorySerializer(many=True, read_only=True)

    class Meta:
        model = HelpRequest
        fields = [
            "id", "request_code", "reporter_type", "district", "district_name", "upazila", "upazila_name",
            "people_affected", "assistance_categories", "risks", "priority", "verification_status", "created_at",
        ]
        read_only_fields = fields


class SafeOpenRequestSerializer(serializers.ModelSerializer):
    request_reference = serializers.CharField(source="request_code", read_only=True)
    district = serializers.CharField(source="district.name_en", read_only=True)
    upazila = serializers.CharField(source="upazila.name_en", read_only=True)
    assistance_categories = serializers.SerializerMethodField()

    class Meta:
        model = HelpRequest
        fields = ["request_reference", "district", "upazila", "people_affected", "assistance_categories", "priority", "created_at"]
        read_only_fields = fields

    def get_assistance_categories(self, obj):
        return list(obj.assistance_categories.values_list("name_en", flat=True))


class RequestClarificationSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source="requested_by.name", read_only=True)

    class Meta:
        model = RequestClarification
        fields = [
            "id", "request_note", "applicant_message", "review_note", "status", "requested_by_name",
            "created_at", "submitted_at", "reviewed_at",
        ]
        read_only_fields = fields


class HelpRequestDetailSerializer(HelpRequestQueueSerializer):
    clarifications = RequestClarificationSerializer(many=True, read_only=True)
    mission_id = serializers.SerializerMethodField()
    mission_status = serializers.SerializerMethodField()

    class Meta(HelpRequestQueueSerializer.Meta):
        fields = HelpRequestQueueSerializer.Meta.fields + [
            "affected_person_name", "contact_phone", "reporter_name", "reporter_phone", "relation_to_affected",
            "description", "review_note", "reviewed_by", "reviewed_at", "clarifications", "mission_id", "mission_status",
        ]
        read_only_fields = fields

    def get_mission_id(self, obj):
        try:
            return obj.mission.pk
        except obj._meta.get_field("mission").related_model.DoesNotExist:
            return None

    def get_mission_status(self, obj):
        try:
            return obj.mission.status
        except obj._meta.get_field("mission").related_model.DoesNotExist:
            return None


class RequestTrackingSerializer(serializers.ModelSerializer):
    request_reference = serializers.CharField(source="request_code", read_only=True)
    district = serializers.CharField(source="district.name_en", read_only=True)
    upazila = serializers.CharField(source="upazila.name_en", read_only=True)
    assistance_categories = serializers.SerializerMethodField()
    mission_status = serializers.SerializerMethodField()
    clarification = serializers.SerializerMethodField()

    class Meta:
        model = HelpRequest
        fields = [
            "request_reference", "district", "upazila", "people_affected", "assistance_categories",
            "verification_status", "mission_status", "clarification", "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_assistance_categories(self, obj):
        return list(obj.assistance_categories.values_list("name_en", flat=True))

    def get_mission_status(self, obj):
        return getattr(getattr(obj, "mission", None), "status", None)

    def get_clarification(self, obj):
        item = obj.clarifications.filter(status=RequestClarification.Status.REQUESTED).order_by("-created_at").first()
        if item:
            return {"request_note": item.request_note, "status": item.status}
        return None


class TrackingAccessSerializer(serializers.Serializer):
    reference = serializers.CharField(max_length=16)
    token = serializers.CharField(min_length=1, max_length=128, trim_whitespace=False)


class ClarificationSubmissionSerializer(TrackingAccessSerializer):
    message = serializers.CharField(min_length=1, max_length=4000)

    def validate_message(self, value):
        if not value.strip():
            raise serializers.ValidationError("Add the requested information.")
        return value.strip()


class ReviewReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=1, max_length=2000)

    def validate_reason(self, value):
        if not value.strip():
            raise serializers.ValidationError("A reason is required.")
        return value.strip()
