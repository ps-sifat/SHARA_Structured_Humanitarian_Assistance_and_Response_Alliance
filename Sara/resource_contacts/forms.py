from django import forms
from Sara.forms import PhoneField
from .models import ResourceContact


class ResourceContactForm(forms.ModelForm):
    phone = PhoneField(label='ফোন / Phone (optional)', required=False)
    class Meta:
        model = ResourceContact
        fields = ['title','contact_category','services_description','phone','email','person_name','institution_name','designation','operating_hours','availability','notes','is_published']
        labels = dict(zip(fields, ['শিরোনাম / Title','ধরন / Category','সেবা / Services (optional)','ফোন / Phone (optional)','ইমেইল / Email (optional)','ব্যক্তি / Person (optional)','প্রতিষ্ঠান / Institution (optional)','পদবি / Designation (optional)','সময় / Hours (optional)','প্রাপ্যতা / Availability','নোট / Notes (optional)','প্রকাশ করুন / Publish']))
