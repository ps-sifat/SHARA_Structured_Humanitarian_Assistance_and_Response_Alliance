from django.contrib import admin

from .models import Mission, MissionAssignment, MissionUpdate


class MissionAssignmentInline(admin.TabularInline):
    model = MissionAssignment
    extra = 0
    readonly_fields = ["assigned_at", "ended_at", "created_at", "updated_at"]


class MissionUpdateInline(admin.TabularInline):
    model = MissionUpdate
    extra = 0
    readonly_fields = ["created_at"]


@admin.register(Mission)
class MissionAdmin(admin.ModelAdmin):
    list_display = ["help_request", "status", "created_by", "updated_at"]
    list_filter = ["status", "created_at"]
    search_fields = ["help_request__request_code", "help_request__district__name_en"]
    readonly_fields = ["created_at", "updated_at"]
    inlines = [MissionAssignmentInline, MissionUpdateInline]


@admin.register(MissionAssignment)
class MissionAssignmentAdmin(admin.ModelAdmin):
    list_display = ["mission", "team", "assigned_team_leader", "assigned_by", "is_active", "assigned_at", "ended_at"]
    list_filter = ["is_active", "team__organization"]
    search_fields = ["mission__help_request__request_code", "team__name", "assigned_team_leader__name"]


@admin.register(MissionUpdate)
class MissionUpdateAdmin(admin.ModelAdmin):
    list_display = ["mission", "status", "actor", "created_at"]
    list_filter = ["status", "created_at"]
    search_fields = ["mission__help_request__request_code", "actor__name", "note"]
