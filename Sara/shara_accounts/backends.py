from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db.models import Q

from Sara.domain import normalize_phone


class PhoneEmailBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        identifier = (username or kwargs.get('phone') or '').strip()
        if password is None:
            return None
        User = get_user_model()
        try:
            query = Q(email__iexact=identifier) if '@' in identifier else Q(phone=normalize_phone(identifier))
            user = User.objects.get(query)
        except (User.DoesNotExist, ValidationError):
            User().set_password(password)
            return None
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
