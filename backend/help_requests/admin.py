from django.contrib import admin

from .models import AssistanceCategory, HelpRequest, HelpRequestCategory


class HelpRequestCategoryInline(admin.TabularInline):
    model = HelpRequestCategory
    extra = 0


@admin.register(AssistanceCategory)
class AssistanceCategoryAdmin(admin.ModelAdmin):
    list_display = ["name_en", "name_bn", "code", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["name_en", "name_bn", "code"]


@admin.register(HelpRequest)
class HelpRequestAdmin(admin.ModelAdmin):
    list_display = ["request_code", "reporter_type", "district", "upazila", "priority", "verification_status", "created_at"]
    list_filter = ["verification_status", "priority", "reporter_type", "district"]
    search_fields = ["request_code", "contact_phone", "reporter_name", "affected_person_name"]
    readonly_fields = ["request_code", "tracking_code", "created_at", "updated_at", "reviewed_at"]
    inlines = [HelpRequestCategoryInline]
