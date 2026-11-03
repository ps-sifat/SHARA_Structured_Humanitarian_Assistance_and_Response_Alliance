from django.contrib import admin
from Sara.admin import SharaModelAdmin
from .models import Organization


@admin.register(Organization)
class OrganizationAdmin(SharaModelAdmin):
    list_display = ('name','administrator','verification_status','contact_phone')
    list_filter = ('verification_status','organization_type')
    search_fields = ('name','contact_phone','administrator__full_name')
    filter_horizontal = ('operating_districts',)
