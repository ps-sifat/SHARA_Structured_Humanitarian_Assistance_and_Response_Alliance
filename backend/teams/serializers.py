from rest_framework import serializers

from help_requests.models import AssistanceCategory
from locations.models import District, Upazila
from organizations.models import Organization, OrganizationAdmin

from .models import Team, TeamMembership


class TeamMembershipSerializer(serializers.ModelSerializer):
    volunteer_name = serializers.CharField(source="volunteer.user.name", read_only=True)
    volunteer_is_active = serializers.BooleanField(source="volunteer.user.is_active", read_only=True)
    volunteer_availability = serializers.CharField(source="volunteer.availability", read_only=True)
    volunteer_skills = serializers.SlugRelatedField(source="volunteer.skills", many=True, slug_field="name", read_only=True)
    volunteer_upazila = serializers.CharField(source="volunteer.upazila.name_en", read_only=True, allow_null=True)

    class Meta:
        model = TeamMembership
        fields = [
            "id", "volunteer", "volunteer_name", "volunteer_is_active", "volunteer_availability",
            "volunteer_skills", "volunteer_upazila", "role", "status", "assigned_at", "ended_at",
        ]
        read_only_fields = fields


class TeamSerializer(serializers.ModelSerializer):
    memberships = serializers.SerializerMethodField()
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    capability_names = serializers.SlugRelatedField(source="capabilities", many=True, slug_field="name_en", read_only=True)
    service_district_names = serializers.SlugRelatedField(
        source="service_districts", many=True, slug_field="name_en", read_only=True
    )
    service_upazila_names = serializers.SlugRelatedField(
        source="service_upazilas", many=True, slug_field="name_en", read_only=True
    )

    class Meta:
        model = Team
        fields = [
            "id", "organization", "organization_name", "name", "description", "is_active", "availability",
            "capabilities", "capability_names", "service_districts", "service_district_names", "service_upazilas",
            "service_upazila_names", "memberships", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "organization_name", "capability_names", "service_district_names", "service_upazila_names", "memberships", "created_at", "updated_at"]

    def get_memberships(self, obj):
        rows = obj.memberships.filter(status=TeamMembership.Status.ACTIVE).select_related(
            "volunteer__user", "volunteer__upazila"
        ).prefetch_related("volunteer__skills")
        return TeamMembershipSerializer(rows, many=True).data


class TeamWriteSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(queryset=Organization.objects.all(), required=True)
    capabilities = serializers.PrimaryKeyRelatedField(
        many=True, queryset=AssistanceCategory.objects.filter(is_active=True), required=False
    )
    service_districts = serializers.PrimaryKeyRelatedField(many=True, queryset=District.objects.all(), required=False)
    service_upazilas = serializers.PrimaryKeyRelatedField(many=True, queryset=Upazila.objects.all(), required=False)

    class Meta:
        model = Team
        fields = [
            "organization", "name", "description", "is_active", "availability", "capabilities",
            "service_districts", "service_upazilas",
        ]

    def validate_organization(self, organization):
        user = self.context["request"].user
        if not organization.is_active or organization.registration_status != Organization.RegistrationStatus.APPROVED:
            raise serializers.ValidationError("Only approved, active organizations can manage response teams.")
        if not OrganizationAdmin.objects.filter(
            organization=organization, user=user, status=OrganizationAdmin.Status.ACTIVE
        ).exists():
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("An active administrator of this organization is required.")
        if self.instance and self.instance.organization_id != organization.pk:
            raise serializers.ValidationError("A team cannot be moved to a different organization.")
        return organization

    def validate(self, attrs):
        districts = attrs.get("service_districts", list(self.instance.service_districts.all()) if self.instance else [])
        upazilas = attrs.get("service_upazilas", list(self.instance.service_upazilas.all()) if self.instance else [])
        if districts:
            district_ids = {district.pk for district in districts}
            if any(upazila.district_id not in district_ids for upazila in upazilas):
                raise serializers.ValidationError(
                    {"service_upazilas": "Each selected upazila must belong to a selected service district."}
                )
        return attrs

    def create(self, validated_data):
        capabilities = validated_data.pop("capabilities", [])
        service_districts = validated_data.pop("service_districts", [])
        service_upazilas = validated_data.pop("service_upazilas", [])
        team = Team.objects.create(**validated_data)
        team.capabilities.set(capabilities)
        team.service_districts.set(service_districts)
        team.service_upazilas.set(service_upazilas)
        return team

    def update(self, instance, validated_data):
        capabilities = validated_data.pop("capabilities", None)
        service_districts = validated_data.pop("service_districts", None)
        service_upazilas = validated_data.pop("service_upazilas", None)
        validated_data.pop("organization", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if capabilities is not None:
            instance.capabilities.set(capabilities)
        if service_districts is not None:
            instance.service_districts.set(service_districts)
        if service_upazilas is not None:
            instance.service_upazilas.set(service_upazilas)
        return instance


class TeamMemberCreateSerializer(serializers.Serializer):
    volunteer = serializers.IntegerField(min_value=1)
    role = serializers.ChoiceField(choices=TeamMembership.Role.choices, required=False, default=TeamMembership.Role.MEMBER)
