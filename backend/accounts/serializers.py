from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from locations.models import District, Upazila

from .models import Skill, User, VolunteerProfile
from .phone import normalize_bd_phone


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


class SkillReferenceField(serializers.PrimaryKeyRelatedField):
    def to_representation(self, value):
        return {"id": value.pk, "name": value.name}


class VolunteerProfileSerializer(serializers.ModelSerializer):
    user = UserSummarySerializer(read_only=True)
    district_name_bn = serializers.CharField(source="district.name_bn", read_only=True)
    district_name_en = serializers.CharField(source="district.name_en", read_only=True)
    upazila_name_bn = serializers.CharField(source="upazila.name_bn", read_only=True)
    upazila_name_en = serializers.CharField(source="upazila.name_en", read_only=True)
    skills = SkillReferenceField(many=True, read_only=True)
    service_upazilas = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = VolunteerProfile
        fields = [
            "id", "user", "district", "district_name_bn", "district_name_en", "upazila",
            "upazila_name_bn", "upazila_name_en", "service_upazilas", "skills", "availability",
            "vehicle_access", "swimming_capability", "profile_image_url",
        ]
        read_only_fields = fields


class VolunteerRegistrationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    phone_number = serializers.CharField(max_length=40)
    email = serializers.EmailField(max_length=254, required=False, allow_blank=True, allow_null=True)
    password = serializers.CharField(write_only=True, trim_whitespace=False, style={"input_type": "password"})
    district = serializers.PrimaryKeyRelatedField(queryset=District.objects.all())
    upazila = serializers.PrimaryKeyRelatedField(queryset=Upazila.objects.all())
    service_upazilas = serializers.PrimaryKeyRelatedField(
        queryset=Upazila.objects.all(), many=True, required=False
    )
    skills = serializers.PrimaryKeyRelatedField(queryset=Skill.objects.filter(is_active=True), many=True)
    availability = serializers.ChoiceField(choices=VolunteerProfile.Availability.choices, required=False)
    vehicle_access = serializers.BooleanField(required=False)
    swimming_capability = serializers.BooleanField(required=False)

    def validate_phone_number(self, value):
        try:
            phone_number = normalize_bd_phone(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages) from error
        if User.objects.filter(phone_number=phone_number).exists():
            raise serializers.ValidationError("An account with this phone number already exists.")
        return phone_number

    def validate_email(self, value):
        email = value.strip().lower() if value else None
        if email and User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return email

    def validate(self, attrs):
        if attrs["upazila"].district_id != attrs["district"].pk:
            raise serializers.ValidationError({"upazila": "Choose an upazila in the selected district."})
        try:
            validate_password(
                attrs["password"],
                user=User(name=attrs["name"], email=attrs.get("email")),
            )
        except DjangoValidationError as error:
            raise serializers.ValidationError({"password": error.messages}) from error
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        skills = validated_data.pop("skills")
        service_upazilas = validated_data.pop("service_upazilas", [])
        user_fields = {
            "name": validated_data.pop("name").strip(),
            "phone_number": validated_data.pop("phone_number"),
            "email": validated_data.pop("email", None),
        }
        user = User.objects.create_user(password=password, **user_fields)
        profile = VolunteerProfile.objects.create(user=user, **validated_data)
        profile.skills.set(skills)
        profile.service_upazilas.set(service_upazilas)
        return user


class VolunteerProfileUpdateSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="user.name", max_length=150, required=False)
    phone_number = serializers.CharField(source="user.phone_number", max_length=40, required=False)
    email = serializers.EmailField(
        source="user.email", max_length=254, required=False, allow_blank=True, allow_null=True
    )
    district = serializers.PrimaryKeyRelatedField(queryset=District.objects.all(), required=False, allow_null=True)
    upazila = serializers.PrimaryKeyRelatedField(queryset=Upazila.objects.all(), required=False, allow_null=True)
    service_upazilas = serializers.PrimaryKeyRelatedField(
        queryset=Upazila.objects.all(), many=True, required=False
    )
    skills = serializers.PrimaryKeyRelatedField(
        queryset=Skill.objects.filter(is_active=True), many=True, required=False
    )

    class Meta:
        model = VolunteerProfile
        fields = [
            "id", "name", "phone_number", "email", "district", "upazila", "service_upazilas", "skills",
            "availability", "vehicle_access", "swimming_capability",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        user_data = attrs.get("user", {})
        phone_number = user_data.get("phone_number")
        if phone_number is not None:
            try:
                normalized_phone = normalize_bd_phone(phone_number)
            except DjangoValidationError as error:
                raise serializers.ValidationError({"phone_number": error.messages}) from error
            if User.objects.filter(phone_number=normalized_phone).exclude(pk=self.instance.user_id).exists():
                raise serializers.ValidationError({"phone_number": "An account with this phone number already exists."})
            user_data["phone_number"] = normalized_phone

        if "email" in user_data:
            email = user_data["email"]
            user_data["email"] = email.strip().lower() or None if email else None
            if user_data["email"] and User.objects.filter(email__iexact=user_data["email"]).exclude(
                pk=self.instance.user_id
            ).exists():
                raise serializers.ValidationError({"email": "An account with this email already exists."})

        district = attrs.get("district", self.instance.district)
        upazila = attrs.get("upazila", self.instance.upazila)
        if upazila and (not district or upazila.district_id != district.pk):
            raise serializers.ValidationError({"upazila": "Choose an upazila in the selected district."})
        return attrs

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        many_to_many = {}
        for field in ("skills", "service_upazilas"):
            if field in validated_data:
                many_to_many[field] = validated_data.pop(field)
        for field, value in user_data.items():
            setattr(instance.user, field, value)
        if user_data:
            instance.user.save()
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        for field, values in many_to_many.items():
            getattr(instance, field).set(values)
        return instance
