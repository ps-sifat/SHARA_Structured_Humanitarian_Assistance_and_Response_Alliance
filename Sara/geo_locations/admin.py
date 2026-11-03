from django.contrib import admin
from Sara.admin import SharaModelAdmin
from .models import Location


@admin.register(Location)
class LocationAdmin(SharaModelAdmin):
    list_display = ('__str__','kind','division','district_code','upazila_code','union_code')
    list_filter = ('kind','division','district')
    search_fields = ('division','district','upazila','union','district_code','upazila_code','union_code','village','landmark')

    def get_changeform_initial_data(self, request):
        initial=super().get_changeform_initial_data(request)
        initial.setdefault('kind','address')
        return initial
