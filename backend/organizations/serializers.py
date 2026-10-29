from rest_framework import serializers

from locations.models import District, Upazila
from accounts.phone import normalize_bd_phone
from django.core.exceptions import ValidationError as DjangoValidationError

from .models import MembershipRequest, Organization, OrganizationAdmin, OrganizationMembership


class OrganizationSerializer(serializers.ModelSerializer):
    service_district_names = serializers.SerializerMethodField()
    service_upazila_labels = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            "id", "name", "description", "organization_type", "contact_email", "contact_phone",
            "office_district", "office_upazila", "service_districts", "service_upazilas",
            "registration_status", "review_note", "profile_image_url", "created_at", "updated_at",
            "service_district_names", "service_upazila_labels",
        ]
        read_only_fields = fields

    def get_service_district_names(self, organization):
        return [district.name_en or district.name_bn for district in organization.service_districts.all()]

    def get_service_upazila_labels(self, organization):
        return [
            f"{upazila.name_en or upazila.name_bn}, {upazila.district.name_en or upazila.district.name_bn}"
            for upazila in organization.service_upazilas.select_related("district").all()
        ]


class OrganizationPublicSerializer(serializers.ModelSerializer):
    service_district_names = serializers.SerializerMethodField()
    service_upazila_labels = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            "id", "name", "description", "organization_type", "service_districts", "service_upazilas",
            "registration_status", "service_district_names", "service_upazila_labels",
        ]
        read_only_fields = fields

    def get_service_district_names(self, organization):
        return [district.name_en or district.name_bn for district in organization.service_districts.all()]

    def get_service_upazila_labels(self, organization):
        return [
            f"{upazila.name_en or upazila.name_bn}, {upazila.district.name_en or upazila.district.name_bn}"
            for upazila in organization.service_upazilas.select_related("district").all()
        ]


class OrganizationReviewSerializer(OrganizationSerializer):
    registered_by_name = serializers.CharField(source="registered_by.name", read_only=True)

    class Meta(OrganizationSerializer.Meta):
        fields = [*OrganizationSerializer.Meta.fields, "registered_by_name"]
        read_only_fields = fields


class OrganizationRegistrationSerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=180, allow_blank=False)
    description = serializers.CharField(allow_blank=False)
    service_districts = serializers.PrimaryKeyRelatedField(
        queryset=District.objects.all(), many=True, allow_empty=False
    )
    service_upazilas = serializers.PrimaryKeyRelatedField(
        queryset=Upazila.objects.all(), many=True, allow_empty=False
    )
    office_district = serializers.PrimaryKeyRelatedField(queryset=District.objects.all(), required=False, allow_null=True)
    office_upazila = serializers.PrimaryKeyRelatedField(queryset=Upazila.objects.all(), required=False, allow_null=True)
    contact_email = serializers.EmailField(required=True, allow_blank=False)
    contact_phone = serializers.CharField(required=True, allow_blank=False, max_length=20)
    organization_type = serializers.CharField(required=True, allow_blank=False, max_length=120)

    def validate_contact_phone(self, value):
        try:
            return normalize_bd_phone(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages) from error

    def validate_contact_email(self, value):
        return value.strip().lower()

    def validate_name(self, value):
        return value.strip()

    def validate_description(self, value):
        return value.strip()

    class Meta:
        model = Organization
        fields = [
            "name", "description", "organization_type", "contact_email", "contact_phone",
            "office_district", "office_upazila", "service_districts", "service_upazilas",
        ]

    def validate(self, attrs):
        office_district = attrs.get("office_district")
        office_upazila = attrs.get("office_upazila")
        if office_upazila and (not office_district or office_upazila.district_id != office_district.pk):
            raise serializers.ValidationError({"office_upazila": "Choose an upazila in the selected district."})
        service_district_ids = {district.pk for district in attrs.get("service_districts", [])}
        invalid_upazilas = [
            upazila.pk
            for upazila in attrs.get("service_upazilas", [])
            if upazila.district_id not in service_district_ids
        ]
        if invalid_upazilas:
            raise serializers.ValidationError(
                {"service_upazilas": "Each service upazila must belong to a selected service district."}
            )
        return attrs


class OrganizationProfileUpdateSerializer(serializers.ModelSerializer):
    contact_phone = serializers.CharField(max_length=20, required=False, allow_blank=False)

    class Meta:
        model = Organization
        fields = [
            "name", "description", "organization_type", "contact_email", "contact_phone",
            "office_district", "office_upazila", "service_districts", "service_upazilas",
        ]

    def validate_contact_phone(self, value):
        try:
            return normalize_bd_phone(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages) from error

    def validate_contact_email(self, value):
        return value.strip().lower()

    def validate_name(self, value):
        return value.strip()

    def validate(self, attrs):
        office_district = attrs.get("office_district", self.instance.office_district)
        office_upazila = attrs.get("office_upazila", self.instance.office_upazila)
        if office_upazila and (not office_district or office_upazila.district_id != office_district.pk):
            raise serializers.ValidationError({"office_upazila": "Choose an upazila in the selected district."})
        service_districts = attrs.get("service_districts")
        service_upazilas = attrs.get("service_upazilas")
        if service_districts is None:
            service_districts = list(self.instance.service_districts.all())
        if service_upazilas is None:
            service_upazilas = list(self.instance.service_upazilas.select_related("district").all())
        service_district_ids = {district.pk for district in service_districts}
        if any(upazila.district_id not in service_district_ids for upazila in service_upazilas):
            raise serializers.ValidationError(
                {"service_upazilas": "Each service upazila must belong to a selected service district."}
            )
        return attrs


class OrganizationAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganizationAdmin
        fields = ["id", "organization", "user", "status", "assigned_at", "ended_at"]
        read_only_fields = fields


class MembershipRequestSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    volunteer_name = serializers.CharField(source="volunteer.user.name", read_only=True)
    volunteer_phone = serializers.CharField(source="volunteer.user.phone_number", read_only=True)
    district_name = serializers.CharField(source="volunteer.district.name_en", read_only=True, allow_null=True)
    upazila_name = serializers.CharField(source="volunteer.upazila.name_en", read_only=True, allow_null=True)
    skill_names = serializers.SerializerMethodField()

    class Meta:
        model = MembershipRequest
        fields = [
            "id", "organization", "organization_name", "volunteer", "volunteer_name", "volunteer_phone",
            "district_name", "upazila_name", "skill_names", "request_note", "status", "decision_note",
            "reviewed_by", "reviewed_at", "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_skill_names(self, membership_request):
        return list(membership_request.volunteer.skills.filter(is_active=True).values_list("name", flat=True))


class OrganizationMembershipSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    volunteer_name = serializers.CharField(source="volunteer.user.name", read_only=True)

    class Meta:
        model = OrganizationMembership
        fields = [
            "id", "organization", "organization_name", "volunteer", "volunteer_name", "request",
            "approved_by", "status", "started_at", "ended_at",
        ]
        read_only_fields = fields


class MembershipRequestCreateSerializer(serializers.Serializer):
    request_note = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class MembershipDecisionSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=2000)
