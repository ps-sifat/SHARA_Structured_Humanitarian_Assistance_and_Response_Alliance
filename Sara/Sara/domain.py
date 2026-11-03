"""Shared value types for the nine SHARA domain models (no extra tables)."""
import re
import uuid

from django.core.exceptions import ValidationError
from django.db import models


class Role(models.TextChoices):
    VOLUNTEER = 'volunteer', 'স্বেচ্ছাসেবক / Volunteer'
    ORGANIZATION_ADMIN = 'organization_admin', 'সংগঠনের প্রশাসক / Organization admin'
    SUPER_ADMIN = 'super_admin', 'সুপার অ্যাডমিন / Super admin'


class Priority(models.TextChoices):
    NORMAL = 'normal', 'সাধারণ / Normal'
    HIGH = 'high', 'উচ্চ / High'
    CRITICAL = 'critical', 'জরুরি / Critical'


class Assistance(models.TextChoices):
    FOOD = 'food', 'খাদ্য / Food'
    WATER = 'water', 'বিশুদ্ধ পানি / Water'
    MEDICINE = 'medicine', 'ওষুধ / Medicine'
    RESCUE = 'rescue', 'উদ্ধার / Rescue'
    SHELTER = 'shelter', 'আশ্রয় / Shelter'


SKILLS = [('first_aid', 'প্রাথমিক চিকিৎসা / First aid'),
          ('rescue_training', 'উদ্ধার প্রশিক্ষণ / Rescue training'),
          ('cooking', 'রান্না / Cooking'), ('logistics', 'পরিবহন / Logistics')]
ACTIVE_MISSIONS = ('assigned', 'accepted', 'in_progress', 'paused')
TERMINAL_MISSIONS = ('completed', 'cancelled', 'failed')


def normalize_digits(value):
    return str(value).translate(str.maketrans('০১২৩৪৫৬৭৮৯', '0123456789'))


def normalize_phone(value):
    value = re.sub(r'[\s()-]', '', normalize_digits(value or ''))
    if not value:
        return ''
    if value.startswith('01') and len(value) == 11:
        value = '+88' + value
    elif value.startswith('880'):
        value = '+' + value
    if not re.fullmatch(r'\+?[0-9]+', value):
        raise ValidationError('সঠিক ফোন নম্বর দিন। / Enter a valid phone number.')
    return value


def validate_assistance(value):
    validate_choices_list(value, Assistance.values)


def validate_skills(value):
    validate_choices_list(value, [code for code, _ in SKILLS])


def validate_choices_list(value, allowed):
    if (not isinstance(value, list) or any(not isinstance(item, str) for item in value)
            or len(set(value)) != len(value) or not set(value).issubset(allowed)):
        raise ValidationError('অবৈধ বা পুনরাবৃত্ত নির্বাচন। / Invalid or duplicate selection.')


class DomainModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class TimestampedModel(DomainModel):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
