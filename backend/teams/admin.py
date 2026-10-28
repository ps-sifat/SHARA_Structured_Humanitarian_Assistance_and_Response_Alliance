from django.contrib import admin

from .models import Team, TeamMembership


class TeamMembershipInline(admin.TabularInline):
    model = TeamMembership
    extra = 0
    readonly_fields = ["assigned_at", "ended_at", "created_at", "updated_at"]


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ["name", "organization", "availability", "is_active", "updated_at"]
    list_filter = ["is_active", "availability", "organization"]
    search_fields = ["name", "organization__name"]
    filter_horizontal = ["capabilities", "service_districts", "service_upazilas"]
    inlines = [TeamMembershipInline]


@admin.register(TeamMembership)
class TeamMembershipAdmin(admin.ModelAdmin):
    list_display = ["team", "volunteer", "role", "status", "assigned_at", "ended_at"]
    list_filter = ["status", "role", "team__organization"]
    search_fields = ["team__name", "volunteer__user__name", "volunteer__user__phone_number"]
