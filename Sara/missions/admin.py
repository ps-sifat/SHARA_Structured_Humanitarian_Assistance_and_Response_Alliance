from django.contrib import admin
from Sara.admin import SharaModelAdmin
from .models import Mission


@admin.register(Mission)
class MissionAdmin(SharaModelAdmin):
    list_display = ('help_request','attempt_number','assigned_team','assigned_volunteer','status','priority')
    list_filter = ('status','priority')
    search_fields = ('help_request__reference','assignee_label_snapshot')

    def get_changeform_initial_data(self, request):
        initial = super().get_changeform_initial_data(request)
        initial.setdefault('assigned_by', request.user.pk)
        return initial
