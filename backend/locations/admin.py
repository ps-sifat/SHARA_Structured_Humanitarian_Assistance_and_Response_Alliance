from django.contrib import admin

from .models import District, Upazila


@admin.register(District)
class DistrictAdmin(admin.ModelAdmin):
    list_display = ["name_en", "name_bn", "code", "is_demo_subset"]
    list_filter = ["is_demo_subset"]
    search_fields = ["name_en", "name_bn", "code"]


@admin.register(Upazila)
class UpazilaAdmin(admin.ModelAdmin):
    list_display = ["name_en", "district", "name_bn", "code", "is_demo_subset"]
    list_filter = ["district", "is_demo_subset"]
    search_fields = ["name_en", "name_bn", "district__name_en"]
