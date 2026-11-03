from django import forms
from django.db import transaction
from .models import catalogue, union_choices
from .models import Location


class AddressForm(forms.Form):
    district_code = forms.ChoiceField(label='জেলা / District')
    upazila_code = forms.ChoiceField(label='উপজেলা / Upazila')
    directions = forms.CharField(label='স্থানীয় দিকনির্দেশনা / Local directions (optional)', required=False, max_length=3000, widget=forms.Textarea)
    union_code = forms.ChoiceField(label='ইউনিয়ন / Union (optional)', required=False)
    union = forms.CharField(label='তালিকায় না থাকলে ইউনিয়ন বা ওয়ার্ড / Union or ward if not listed (optional)', required=False, max_length=120)
    village = forms.CharField(label='গ্রাম / Village (optional)', required=False, max_length=160)
    landmark = forms.CharField(label='চেনা স্থান / Landmark (optional)', required=False, max_length=200)

    def __init__(self, *args, location=None, directions_required=False, optional=False, **kwargs):
        self.location = location
        initial = kwargs.setdefault('initial', {})
        if location:
            initial.update({name: getattr(location, name) for name in self.base_fields})
        super().__init__(*args, **kwargs)
        areas = catalogue()
        self.fields['district_code'].choices = [('', 'জেলা বাছুন / Select district')] + [(code, item['name']) for code, item in areas.items()]
        district = self.data.get(self.add_prefix('district_code')) if self.is_bound else self.initial.get('district_code')
        choices = list(areas.get(district, {}).get('upazilas', {}).items()) if district else [(code, f"{label} — {area['name']}") for area in areas.values() for code,label in area['upazilas'].items()]
        self.fields['upazila_code'].choices = [('', 'উপজেলা বাছুন / Select upazila')] + choices
        upazila = self.data.get(self.add_prefix('upazila_code')) if self.is_bound else self.initial.get('upazila_code')
        self.fields['union_code'].choices = [('', 'ইউনিয়ন বাছুন / Select union (optional)')] + list(union_choices(district,upazila).items())
        if directions_required:
            self.fields['directions'].required = True
            self.fields['directions'].label = 'স্থানীয় দিকনির্দেশনা / Local directions'
        if optional:
            for name in ['district_code','upazila_code']:
                self.fields[name].required = False
                self.fields[name].label += ' (optional)'
        self.optional = optional

    def clean(self):
        data = super().clean()
        district, upazila = data.get('district_code'), data.get('upazila_code')
        if district and upazila and upazila not in catalogue()[district]['upazilas']:
            self.add_error('upazila_code', 'জেলার সাথে উপজেলা মেলেনি। / Upazila does not match the district.')
        union_code = data.get('union_code')
        if union_code:
            name = union_choices(district,upazila).get(union_code)
            if data.get('union') and data['union'] != name:
                self.add_error('union','তালিকা থেকে বাছুন অথবা নিজে লিখুন। / Choose a listed union or enter a name, not both.')
            else:
                data['union'] = name
        if self.optional and any(data.values()) and not (district and upazila):
            raise forms.ValidationError('ঠিকানার জন্য জেলা ও উপজেলা বাছুন। / Select both district and upazila for an address.')
        return data

    def save(self):
        if not self.cleaned_data.get('district_code'):
            return None
        values = dict(self.cleaned_data)
        area = catalogue()[values['district_code']]
        values.update(kind='address', district=area['name'], upazila=area['upazilas'][values['upazila_code']])
        # Always create an owner-specific immutable replacement, never mutate a
        # potentially shared address used by a historical request.
        return Location.objects.create(**values)


def district_choices():
    return [(code, item['name']) for code, item in catalogue().items()]


class CoverageForm(forms.Form):
    districts = forms.MultipleChoiceField(label='সেবার জেলা / Service districts', choices=district_choices, widget=forms.CheckboxSelectMultiple)


def save_districts(codes):
    areas = catalogue()
    return [Location.objects.get_or_create(kind='district', district_code=code, defaults={'district':areas[code]['name']})[0] for code in codes]
