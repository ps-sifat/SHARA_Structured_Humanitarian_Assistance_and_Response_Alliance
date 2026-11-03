from django.contrib import admin
from Sara.admin import SharaModelAdmin
from .models import VolunteerProfile


@admin.register(VolunteerProfile)
class VolunteerProfileAdmin(SharaModelAdmin):
    list_display = ('user','organization','membership_status','availability')
    list_filter = ('membership_status','availability')
    search_fields = ('user__full_name','user__phone','organization__name')
    filter_horizontal = ('operating_districts',)
