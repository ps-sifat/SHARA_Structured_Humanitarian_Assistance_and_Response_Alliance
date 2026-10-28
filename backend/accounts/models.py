from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.db import models

from .managers import UserManager
from .phone import normalize_bd_phone


class User(AbstractUser):
    username = None
    name = models.CharField(max_length=150)
    phone_number = models.CharField(
        max_length=14,
        unique=True,
        validators=[RegexValidator(r"^\+8801[3-9]\d{8}$", "Use a normalized Bangladesh mobile number.")],
    )
    email = models.EmailField(max_length=254, unique=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "phone_number"
    REQUIRED_FIELDS = ["name"]

    objects = UserManager()

    class Meta:
        indexes = [models.Index(fields=["is_active", "date_joined"], name="accounts_user_active_idx")]

    def clean(self):
        super().clean()
        if self.phone_number:
            self.phone_number = normalize_bd_phone(self.phone_number)
        self.email = self.email.strip().lower() or None if self.email else None

    def save(self, *args, **kwargs):
        if self.phone_number:
            self.phone_number = normalize_bd_phone(self.phone_number)
        self.email = self.email.strip().lower() or None if self.email else None
        return super().save(*args, **kwargs)

    def get_full_name(self):
        return self.name

    def get_short_name(self):
        return self.name

    def __str__(self):
        return self.name


class Skill(models.Model):
    name = models.CharField(max_length=120, unique=True)
    description = models.CharField(max_length=240, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["is_active", "name"], name="accounts_skill_active_idx")]

    def __str__(self):
        return self.name


class VolunteerProfile(models.Model):
    class Availability(models.TextChoices):
        AVAILABLE = "available", "Available"
        LIMITED = "limited", "Limited"
        UNAVAILABLE = "unavailable", "Unavailable"

    user = models.OneToOneField("accounts.User", on_delete=models.CASCADE, related_name="volunteer_profile")
    district = models.ForeignKey(
        "locations.District", on_delete=models.PROTECT, related_name="volunteer_profiles", null=True, blank=True
    )
    upazila = models.ForeignKey(
        "locations.Upazila", on_delete=models.PROTECT, related_name="volunteer_profiles", null=True, blank=True
    )
    service_upazilas = models.ManyToManyField("locations.Upazila", blank=True, related_name="volunteers_serving")
    skills = models.ManyToManyField(Skill, blank=True, related_name="volunteers")
    availability = models.CharField(max_length=16, choices=Availability.choices, default=Availability.AVAILABLE)
    vehicle_access = models.BooleanField(default=False)
    swimming_capability = models.BooleanField(default=False)
    profile_image_url = models.URLField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["district", "upazila"], name="accounts_vol_area_idx"),
            models.Index(fields=["availability"], name="accounts_vol_avail_idx"),
        ]

    def __str__(self):
        return f"Volunteer profile: {self.user.name}"
