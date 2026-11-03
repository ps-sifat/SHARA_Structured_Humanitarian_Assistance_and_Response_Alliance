from django.contrib import admin
from Sara.admin import SharaModelAdmin
from .models import VolunteerTeam, TeamMember


@admin.register(VolunteerTeam)
class VolunteerTeamAdmin(SharaModelAdmin):
    list_display = ('name','organization','leader','availability')
    list_filter = ('availability','organization')
    search_fields = ('name','organization__name')
    filter_horizontal = ('operating_districts',)


@admin.register(TeamMember)
class TeamMemberAdmin(SharaModelAdmin):
    list_display = ('volunteer','team','is_active','joined_at','left_at')
    list_filter = ('is_active','team__organization')
    search_fields = ('volunteer__user__full_name','team__name')
