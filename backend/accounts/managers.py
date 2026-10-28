from django.contrib.auth.base_user import BaseUserManager

from .phone import normalize_bd_phone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, phone_number, password, **extra_fields):
        if not phone_number:
            raise ValueError("A phone number is required.")
        if not extra_fields.get("name"):
            raise ValueError("A name is required.")
        email = extra_fields.get("email")
        extra_fields["email"] = email.strip().lower() or None if email else None
        user = self.model(phone_number=normalize_bd_phone(phone_number), **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_user(self, phone_number, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(phone_number, password, **extra_fields)

    def create_superuser(self, phone_number, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Super Admin users must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Super Admin users must have is_superuser=True.")
        return self._create_user(phone_number, password, **extra_fields)
