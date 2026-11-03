from django import forms
from django.contrib.auth import password_validation
from django.contrib.auth.forms import AuthenticationForm, BaseUserCreationForm, UserChangeForm
from Sara.forms import PhoneField
from .models import User


class LoginForm(AuthenticationForm):
    username = forms.CharField(label='ফোন অথবা ইমেইল / Phone or email')
    password = forms.CharField(label='পাসওয়ার্ড / Password', widget=forms.PasswordInput, strip=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].max_length = None
        self.fields['username'].widget.attrs.pop('maxlength', None)


class AccountForm(forms.ModelForm):
    phone = PhoneField(label='ফোন / Phone')
    class Meta:
        model = User
        fields = ['full_name','phone','email']
        labels = {'full_name':'পূর্ণ নাম / Full name', 'email':'ইমেইল / Email (optional)'}


class RegistrationForm(AccountForm):
    password1 = forms.CharField(label='পাসওয়ার্ড / Password', widget=forms.PasswordInput, strip=False)
    password2 = forms.CharField(label='পাসওয়ার্ড নিশ্চিত করুন / Confirm password', widget=forms.PasswordInput, strip=False)

    def clean(self):
        data = super().clean()
        if data.get('password1') != data.get('password2'):
            self.add_error('password2', 'পাসওয়ার্ড মেলেনি। / Passwords do not match.')
        password_validation.validate_password(data.get('password1',''), self.instance)
        return data

    def save(self, role):
        user = super().save(commit=False)
        user.role = role
        user.set_password(self.cleaned_data['password1'])
        user.save()
        return user


class RecoveryIssueForm(forms.Form):
    identifier = forms.CharField(label='যাচাইকৃত অ্যাকাউন্টের ফোন অথবা ইমেইল / Verified account phone or email')
    identity_verified = forms.BooleanField(label='বাইরে পরিচয় যাচাই সম্পন্ন করেছি / I have completed identity verification outside this system')


class AdminUserCreationForm(BaseUserCreationForm):
    phone = PhoneField(label='Phone')

    class Meta(BaseUserCreationForm.Meta):
        model = User
        fields = ('phone','full_name','email','role')
        field_classes = {}


class AdminUserChangeForm(UserChangeForm):
    phone = PhoneField(label='Phone')

    class Meta(UserChangeForm.Meta):
        model = User
        fields = '__all__'
        field_classes = {}
