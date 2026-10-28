from django.contrib import admin

from .models import MembershipRequest, Organization, OrganizationAdmin, OrganizationMembership


@admin.register(Organization)
class OrganizationAdminView(admin.ModelAdmin):
    list_display = ["name", "registration_status", "registered_by", "office_district", "created_at"]
    list_filter = ["registration_status", "is_active", "office_district"]
    search_fields = ["name", "registered_by__name", "contact_email", "contact_phone"]
    filter_horizontal = ["service_districts", "service_upazilas"]
    readonly_fields = ["created_at", "updated_at", "reviewed_at"]


@admin.register(OrganizationAdmin)
class OrganizationAdminRoleView(admin.ModelAdmin):
    list_display = ["organization", "user", "status", "assigned_by", "assigned_at", "ended_at"]
    list_filter = ["status", "organization"]
    search_fields = ["organization__name", "user__name", "user__phone_number"]


@admin.register(MembershipRequest)
class MembershipRequestAdmin(admin.ModelAdmin):
    list_display = ["organization", "volunteer", "status", "created_at", "reviewed_by"]
    list_filter = ["status", "organization"]
    search_fields = ["organization__name", "volunteer__user__name", "volunteer__user__phone_number"]
    readonly_fields = ["created_at", "updated_at", "reviewed_at"]


@admin.register(OrganizationMembership)
class OrganizationMembershipAdmin(admin.ModelAdmin):
    list_display = ["organization", "volunteer", "status", "started_at", "ended_at"]
    list_filter = ["status", "organization"]
    search_fields = ["organization__name", "volunteer__user__name", "volunteer__user__phone_number"]
