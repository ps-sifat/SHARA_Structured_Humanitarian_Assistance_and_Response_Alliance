from django.contrib import admin
from Sara.admin import SharaModelAdmin
from .models import ResourceContact


@admin.register(ResourceContact)
class ResourceContactAdmin(SharaModelAdmin):
    list_per_page = 50
    list_display = ('title','contact_category','phone','availability','is_published')
    list_filter = ('contact_category','availability','is_published')
    search_fields = ('title','person_name','institution_name','phone')

    def get_changeform_initial_data(self, request):
        initial = super().get_changeform_initial_data(request)
        initial.setdefault('created_by', request.user.pk)
        initial.setdefault('updated_by', request.user.pk)
        return initial
