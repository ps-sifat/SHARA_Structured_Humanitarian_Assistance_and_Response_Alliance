from django.contrib import admin

from .models import Supplier, SupplierResource


class SupplierResourceInline(admin.TabularInline):
    model = SupplierResource
    extra = 0
    readonly_fields = ["created_at", "updated_at"]


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "location_label", "status", "updated_at"]
    list_filter = ["status", "category", "upazila__district"]
    search_fields = ["name", "contact_name", "contact_phone", "location_label"]
    inlines = [SupplierResourceInline]


@admin.register(SupplierResource)
class SupplierResourceAdmin(admin.ModelAdmin):
    list_display = ["name", "supplier", "category", "quantity", "unit", "is_available"]
    list_filter = ["is_available", "category", "supplier"]
    search_fields = ["name", "supplier__name"]
