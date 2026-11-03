from django import forms
from geo_locations.forms import CoverageForm
from Sara.domain import Assistance, SKILLS
from Sara.forms import validate_image
from .models import VolunteerProfile


class VolunteerForm(CoverageForm):
    skills = forms.MultipleChoiceField(label='দক্ষতা / Skills (optional)', choices=SKILLS, required=False, widget=forms.CheckboxSelectMultiple)
    assistance_capabilities = forms.MultipleChoiceField(label='সহায়তা দেওয়ার সক্ষমতা / Assistance capabilities', choices=Assistance.choices, widget=forms.CheckboxSelectMultiple)
    availability = forms.ChoiceField(label='প্রাপ্যতা / Availability', choices=VolunteerProfile.AVAILABILITY)
    vehicle_access = forms.BooleanField(label='যানবাহন আছে / Vehicle access', required=False)
    swimming_capability = forms.BooleanField(label='সাঁতার জানি / Can swim', required=False)
    profile_photo = forms.ImageField(label='ছবি / Photo (optional)', required=False, validators=[validate_image])
    remove_photo = forms.BooleanField(label='বর্তমান ছবি সরান / Remove current photo', required=False)
