from django import forms
from django.db.models import Q
from Sara.domain import Assistance
from geo_locations.forms import CoverageForm
from volunteers.models import VolunteerProfile
from .models import VolunteerTeam


class TeamForm(CoverageForm):
    name = forms.CharField(label='দলের নাম / Team name', max_length=160)
    assistance_capabilities = forms.MultipleChoiceField(label='সহায়তা সক্ষমতা / Assistance capabilities', choices=Assistance.choices, widget=forms.CheckboxSelectMultiple)
    availability = forms.ChoiceField(label='প্রস্তুতি / Readiness', choices=VolunteerTeam.AVAILABILITY)
    members = forms.ModelMultipleChoiceField(label='সদস্য / Members', queryset=VolunteerProfile.objects.none(), widget=forms.CheckboxSelectMultiple, required=False)
    leader = forms.ModelChoiceField(label='দলনেতা / Team leader', queryset=VolunteerProfile.objects.none(), required=False)

    def __init__(self, *args, organization, team=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['districts'].choices = list(organization.operating_districts.values_list('district_code','district'))
        members = organization.membership_profiles.filter(membership_status='approved', user__is_active=True).select_related('user')
        self.fields['members'].queryset = members
        self.fields['leader'].queryset = members
        if team and team.busy:
            self.fields['districts'].disabled = True
            self.fields['assistance_capabilities'].disabled = True
            self.fields['districts'].help_text = 'সক্রিয় মিশনে স্থির / Locked during active mission'
