import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.db.models.functions import Lower

from Sara.domain import Role, normalize_phone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, phone, password=None, **extra):
        user = self.model(phone=normalize_phone(phone), **extra)
        user.set_password(password)
        user.full_clean(exclude=['password'])
        user.save(using=self._db)
        return user

    def create_superuser(self, phone, password, **extra):
        extra.update(role=Role.SUPER_ADMIN, is_staff=True, is_superuser=True)
        return self.create_user(phone, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=160)
    phone = models.CharField(unique=True)
    email = models.EmailField(blank=True, null=True)
    role = models.CharField(max_length=24, choices=Role.choices, default=Role.VOLUNTEER)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    must_change_password = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'phone'
    REQUIRED_FIELDS = ['full_name']
    objects = UserManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(Lower('email'), condition=models.Q(email__isnull=False), name='user_email_unique_ci'),
            models.CheckConstraint(condition=models.Q(role__in=Role.values), name='user_role_valid'),
            models.CheckConstraint(condition=~models.Q(phone=''), name='user_phone_nonempty'),
        ]

    def clean(self):
        super().clean()
        self.phone = normalize_phone(self.phone)
        self.email = self.email.strip().lower() if self.email else None

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)

    def get_full_name(self):
        return self.full_name

    def get_short_name(self):
        return self.full_name.split()[0] if self.full_name else self.phone

    def __str__(self):
        return self.full_name

# Permissions
from functools import wraps

from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied

from Sara.domain import Role


def require_role(user, *roles):
    if not user.is_authenticated or not user.is_active or user.role not in roles:
        raise PermissionDenied('এই কাজের অনুমতি নেই। / You cannot perform this action.')


def own_organization(user, approved=True):
    require_role(user, Role.ORGANIZATION_ADMIN)
    from organizations.models import Organization
    try:
        organization = Organization.objects.get(administrator=user)
    except Organization.DoesNotExist:
        raise PermissionDenied('Organization profile is missing.')
    if approved and organization.verification_status != 'approved':
        raise PermissionDenied('সংগঠনের অনুমোদন প্রয়োজন। / Organization approval is required.')
    return organization


def role_required(*roles, approved=False):
    def decorate(view):
        @login_required
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            require_role(request.user, *roles)
            portal_roles = {'/admin/':Role.SUPER_ADMIN, '/org/':Role.ORGANIZATION_ADMIN, '/volunteer/':Role.VOLUNTEER}
            for prefix, expected in portal_roles.items():
                if request.path.startswith(prefix) and request.user.role != expected:
                    raise PermissionDenied('এই পৃষ্ঠা আপনার ভূমিকার জন্য নয়। / This portal is for a different role.')
            if approved and request.user.role == Role.ORGANIZATION_ADMIN:
                own_organization(request.user)
            return view(request, *args, **kwargs)
        return wrapped
    return decorate


# Services
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.db import transaction
from django.core.exceptions import ValidationError
from Sara.domain import Role, normalize_phone


class RecoveryTokenGenerator(PasswordResetTokenGenerator):
    def _make_hash_value(self, user, timestamp):
        return super()._make_hash_value(user, timestamp) + str(user.must_change_password)


recovery_tokens = RecoveryTokenGenerator()


@transaction.atomic
def issue_recovery(actor, identifier):
    require_role(actor, Role.SUPER_ADMIN)
    try:
        user = User.objects.select_for_update().get(email=identifier.lower()) if '@' in identifier else User.objects.select_for_update().get(phone=normalize_phone(identifier))
    except User.DoesNotExist:
        raise ValidationError('অ্যাকাউন্ট খুঁজে পাওয়া যায়নি। / Account not found.')
    if not user.is_active:
        raise ValidationError('অ্যাকাউন্ট নিষ্ক্রিয়। / Account is inactive.')
    user.set_unusable_password()
    user.must_change_password = True
    user.save()
    return user, recovery_tokens.make_token(user)
