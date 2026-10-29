from django.contrib.auth.backends import ModelBackend
from django.core.exceptions import ValidationError
from django.db.models import Q

from .models import User
from .phone import normalize_bd_phone


class IdentifierBackend(ModelBackend):
    """Authenticate one normalized email-or-phone identifier using Django sessions."""

    def authenticate(self, request, username=None, password=None, identifier=None, **kwargs):
        identifier = identifier if identifier is not None else username
        if not isinstance(identifier, str) or not identifier.strip() or not isinstance(password, str):
            return None

        normalized_identifier = identifier.strip().lower()
        lookup = Q(email=normalized_identifier)
        try:
            lookup |= Q(phone_number=normalize_bd_phone(identifier))
        except ValidationError:
            pass

        try:
            user = User.objects.get(lookup)
        except User.DoesNotExist:
            # Preserve Django's timing-resistant password behavior for unknown identifiers.
            User().set_password(password)
            return None
        except User.MultipleObjectsReturned:
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
