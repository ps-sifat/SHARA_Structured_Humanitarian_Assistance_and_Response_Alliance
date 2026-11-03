from django import forms
from Sara.domain import Assistance, Priority
from Sara.forms import PhoneField, PersonCountField
from .models import HelpRequest


class HelpRequestForm(forms.Form):
    is_proxy = forms.BooleanField(label='অন্যের পক্ষে আবেদন / Apply on behalf of someone else', required=False)
    need_categories = forms.MultipleChoiceField(label='কী সহায়তা প্রয়োজন / Assistance needed', choices=Assistance.choices, widget=forms.CheckboxSelectMultiple)
    person_count = PersonCountField(label='মানুষের সংখ্যা / Number of people', min_value=1, max_value=1000000)
    contact_phone = PhoneField(label='যোগাযোগের ফোন / Reachable phone')
    victim_name = forms.CharField(label='সাহায্যপ্রার্থীর নাম / Affected person name (optional)', max_length=160, required=False)
    reporter_name = forms.CharField(label='প্রতিবেদকের নাম / Reporter name (optional)', max_length=160, required=False)
    reporter_phone = PhoneField(label='প্রতিবেদকের ফোন / Reporter phone (optional)', required=False)
    reporter_relationship = forms.CharField(label='সম্পর্ক / Relationship (optional)', max_length=100, required=False)
    immediate_rescue_required = forms.BooleanField(label='তাৎক্ষণিক উদ্ধার প্রয়োজন / Immediate rescue required', required=False)
    trapped_person = forms.BooleanField(label='কেউ আটকা / Someone trapped', required=False)
    critical_medical_emergency = forms.BooleanField(label='গুরুতর চিকিৎসা জরুরি / Critical medical emergency', required=False)
    injured_person = forms.BooleanField(label='আহত ব্যক্তি / Injured person', required=False)
    child_in_danger = forms.BooleanField(label='শিশু বিপদে / Child in danger', required=False)
    elderly_in_danger = forms.BooleanField(label='বয়স্ক ব্যক্তি বিপদে / Elderly person in danger', required=False)
    emergency_condition = forms.CharField(label='জরুরি পরিস্থিতি / Emergency description (optional)', required=False, max_length=5000, widget=forms.Textarea)
    submission_token = forms.CharField(widget=forms.HiddenInput)


class TrackingForm(forms.Form):
    phone = PhoneField(
        label='ফোন নম্বর / Phone number',
        help_text='আবেদনে দেওয়া ফোন নম্বর লিখুন। / Enter the phone number used in your request.',
        widget=forms.TextInput(attrs={'type': 'tel', 'autocomplete': 'tel'}),
    )


class ClarificationForm(forms.Form):
    question = forms.CharField(label='ব্যক্তিগত তথ্য ছাড়া প্রশ্ন লিখুন / Clarification question without private contact details', max_length=3000, widget=forms.Textarea)


class ResponseForm(forms.Form):
    response = forms.CharField(label='ব্যাখ্যার উত্তর / Clarification response', max_length=3000, widget=forms.Textarea)


class PriorityForm(forms.Form):
    priority = forms.ChoiceField(label='অগ্রাধিকার / Priority', choices=[('', 'প্রস্তাবিত মানে ফিরুন / Restore suggested')] + Priority.choices, required=False)
    reason = forms.CharField(label='পরিবর্তনের কারণ / Override reason (required for override)', required=False, max_length=3000, widget=forms.Textarea)
