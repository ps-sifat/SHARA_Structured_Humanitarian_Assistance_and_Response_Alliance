from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .forms import AdminUserCreationForm, AdminUserChangeForm
from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    add_form = AdminUserCreationForm
    form = AdminUserChangeForm
    list_display = ('full_name','phone','email','role','is_staff','is_superuser','is_active')
    list_filter = ('role','is_active','is_staff','is_superuser','groups')
    search_fields = ('full_name','phone','email')
    ordering = ('full_name',)
    readonly_fields = ('id','created_at','updated_at')
    fieldsets = (
        (None, {'fields': ('phone','password')}),
        ('Personal information', {'fields': ('full_name','email','role')}),
        ('Permissions', {'fields': ('is_active','is_staff','is_superuser','must_change_password','groups','user_permissions')}),
        ('Dates and identity', {'fields': ('id','last_login','created_at','updated_at')}),
    )
    add_fieldsets = (
        (None, {'classes': ('wide',), 'fields': ('phone','full_name','email','role','password1','password2','is_active','is_staff','is_superuser','groups','user_permissions')}),
    )
