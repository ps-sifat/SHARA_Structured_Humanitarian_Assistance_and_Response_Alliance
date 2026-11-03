from django import forms
from geo_locations.forms import CoverageForm
from Sara.forms import PhoneField, validate_image
from .models import Organization


class OrganizationForm(CoverageForm):
    name = forms.CharField(label='সংগঠনের নাম / Organization name', max_length=180)
    organization_type = forms.ChoiceField(label='ধরন / Type', choices=Organization.TYPES)
    description = forms.CharField(label='বিবরণ / Description (optional)', required=False, max_length=5000, widget=forms.Textarea)
    contact_phone = PhoneField(label='সংগঠনের ফোন / Organization phone')
    contact_email = forms.EmailField(label='সংগঠনের ইমেইল / Organization email (optional)', required=False)
    logo = forms.ImageField(label='লোগো / Logo (optional)', required=False, validators=[validate_image])
    remove_photo = forms.BooleanField(label='বর্তমান লোগো সরান / Remove current logo', required=False)
