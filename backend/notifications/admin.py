from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["user", "title", "category", "read_at", "created_at"]
    list_filter = ["category", "read_at", "created_at"]
    search_fields = ["user__name", "user__phone_number", "title", "body"]
    readonly_fields = ["created_at", "updated_at"]
