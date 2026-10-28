from rest_framework import serializers

from .models import Supplier, SupplierResource


class SupplierResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierResource
        fields = ["id", "name", "category", "quantity", "unit", "note", "is_available", "updated_at"]
        read_only_fields = fields


class SupplierSerializer(serializers.ModelSerializer):
    resources = SupplierResourceSerializer(many=True, read_only=True)

    class Meta:
        model = Supplier
        fields = [
            "id", "name", "category", "location_label", "upazila", "status", "resources", "created_at", "updated_at",
        ]
        read_only_fields = fields


class SupplierDetailSerializer(SupplierSerializer):
    class Meta(SupplierSerializer.Meta):
        fields = SupplierSerializer.Meta.fields + ["contact_name", "contact_phone", "contact_email", "reviewed_by", "reviewed_at"]
