from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Skill, User, VolunteerProfile


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ["phone_number"]
    list_display = ["name", "phone_number", "email", "is_active", "is_staff", "is_superuser"]
    search_fields = ["name", "phone_number", "email"]
    fieldsets = (
        (None, {"fields": ("phone_number", "password")}),
        ("Personal info", {"fields": ("name", "email", "first_name", "last_name")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined", "updated_at")}),
    )
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("phone_number", "name", "email", "password1", "password2")} ),)
    readonly_fields = ["date_joined", "updated_at"]


@admin.register(VolunteerProfile)
class VolunteerProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "district", "upazila", "availability"]
    list_filter = ["availability", "district"]
    search_fields = ["user__name", "user__phone_number"]
    filter_horizontal = ["skills", "service_upazilas"]


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ["name", "is_active", "updated_at"]
    list_filter = ["is_active"]
    search_fields = ["name"]
