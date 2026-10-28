from rest_framework import serializers

from .models import District, Upazila


class UpazilaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Upazila
        fields = ["id", "district", "name_bn", "name_en", "code", "is_demo_subset"]
        read_only_fields = fields


class DistrictSerializer(serializers.ModelSerializer):
    upazilas = UpazilaSerializer(many=True, read_only=True)

    class Meta:
        model = District
        fields = ["id", "name_bn", "name_en", "code", "is_demo_subset", "upazilas"]
        read_only_fields = fields
