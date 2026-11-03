from django import forms
from volunteers.models import VolunteerProfile
from response_teams.models import VolunteerTeam
from .models import candidate_reasons


class AssignmentForm(forms.Form):
    target = forms.ChoiceField(label='দল অথবা ব্যক্তি / Team or individual', widget=forms.RadioSelect)

    def __init__(self, *args, actor, help_request, **kwargs):
        super().__init__(*args, **kwargs)
        self.can_assign = help_request.status in ['pending', 'clarification_needed']
        teams = VolunteerTeam.objects.select_related('organization','leader__user')
        people = VolunteerProfile.objects.select_related('user','organization')
        if actor.role == 'organization_admin':
            org = actor.managed_organization
            teams = teams.filter(organization=org)
            people = people.filter(organization=org, membership_status='approved')
        self.candidates, choices = [], []
        for kind, targets in [('team', teams), ('individual', people)]:
            for target in targets:
                reasons = candidate_reasons(actor, help_request, target)
                self.candidates.append({'label':str(target), 'kind':kind, 'reasons':reasons})
                if not reasons:
                    choices.append((f'{kind}:{target.pk}', f'{kind} — {target}'))
        self.fields['target'].choices = choices


class MissionActionForm(forms.Form):
    action = forms.ChoiceField(choices=[(v,v) for v in ['accept','start','complete','cancel','fail']], widget=forms.HiddenInput)
    reason = forms.CharField(label='বাতিল/ব্যর্থ হলে কারণ / Reason (required to cancel or fail)', max_length=3000, required=False, widget=forms.Textarea)
    all_needs_fulfilled = forms.BooleanField(label='সব প্রয়োজন পূরণ করেছি; আবেদন বন্ধ হবে / All needs fulfilled; close request', required=False)
    delivered_assistance = forms.CharField(label='দেওয়া সহায়তা / Delivered assistance (optional)', max_length=5000, required=False, widget=forms.Textarea)
    completion_debrief = forms.CharField(label='সমাপনী বিবরণ / Completion debrief (optional)', max_length=5000, required=False, widget=forms.Textarea)
    issues_encountered = forms.CharField(label='বাধা / Issues encountered (optional)', max_length=5000, required=False, widget=forms.Textarea)
