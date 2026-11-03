from django.contrib import admin


class SharaModelAdmin(admin.ModelAdmin):
    """Use Django's standard model permissions and superuser CRUD authority.

    Portal workflow permissions do not restrict the native administration site.
    Normal model validation and database constraints still apply.
    """

    def get_readonly_fields(self, request, obj=None):
        # Automatically managed identity/timestamps are inspectable. All normal
        # editable model fields retain Django's default add/change behavior.
        return tuple(field.name for field in self.model._meta.fields if not field.editable)

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        from geo_locations.models import Location
        if db_field.remote_field.model is Location:
            kwargs['queryset'] = Location.objects.filter(kind='address')
        return super().formfield_for_foreignkey(db_field,request,**kwargs)
