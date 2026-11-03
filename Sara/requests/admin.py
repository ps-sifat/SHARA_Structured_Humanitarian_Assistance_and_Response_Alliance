from django.contrib import admin
from django import forms
from django.contrib.auth.hashers import make_password
from Sara.admin import SharaModelAdmin
from .models import HelpRequest


class HelpRequestAdminForm(forms.ModelForm):
    tracking_code = forms.CharField(
        label='Private tracking code', required=False, max_length=100,
        widget=forms.PasswordInput,
        help_text='Required for a new request. On edit, leave blank to keep the existing code; enter a new code to replace it. Only a hash is stored.',
    )

    class Meta:
        model = HelpRequest
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['tracking_code'].required = self.instance._state.adding

    def clean(self):
        cleaned = super().clean()
        if cleaned.get('tracking_code'):
            self.instance.tracking_code_hash = make_password(cleaned['tracking_code'])
        return cleaned


@admin.register(HelpRequest)
class HelpRequestAdmin(SharaModelAdmin):
    form = HelpRequestAdminForm
    list_display = ('reference','person_count','priority','status','created_at')
    list_filter = ('priority','status')
    search_fields = ('reference','victim_name','contact_phone')

    def get_readonly_fields(self, request, obj=None):
        return tuple(name for name in super().get_readonly_fields(request,obj) if name != 'tracking_code_hash')
