from django import forms
from django.conf import settings
from .domain import normalize_phone, normalize_digits


class PhoneField(forms.CharField):
    def clean(self, value):
        return normalize_phone(super().clean(value))


class PersonCountField(forms.IntegerField):
    def to_python(self, value):
        return super().to_python(normalize_digits(value or ''))


def validate_image(upload):
    if upload and getattr(upload, 'size', 0) > settings.SHARA_UPLOAD_MAX_BYTES:
        raise forms.ValidationError('ছবিটি বড়। সর্বোচ্চ ৫ MB। / Image too large; maximum 5 MB.')
    if upload and getattr(upload, 'image', None):
        if upload.image.format not in ['JPEG','PNG','WEBP'] or upload.image.width * upload.image.height > 20000000:
            raise forms.ValidationError('JPEG, PNG বা WebP; সর্বোচ্চ ২০ মেগাপিক্সেল। / JPEG, PNG or WebP, at most 20 megapixels.')


class ReasonForm(forms.Form):
    reason = forms.CharField(label='কারণ / Reason', max_length=3000, widget=forms.Textarea)


def add_service_error(form, error):
    # Domain clean() can return errors for fields outside the current action.
    for message in error.messages:
        form.add_error(None, message)
