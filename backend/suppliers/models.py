from django.conf import settings
from django.db import models


class Supplier(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending review"
        VERIFIED = "verified", "Verified"
        REJECTED = "rejected", "Rejected"

    name = models.CharField(max_length=180)
    category = models.CharField(max_length=100, blank=True)
    contact_name = models.CharField(max_length=160, blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    contact_email = models.EmailField(blank=True)
    location_label = models.CharField(max_length=180, blank=True)
    upazila = models.ForeignKey(
        "locations.Upazila", on_delete=models.PROTECT, null=True, blank=True, related_name="suppliers"
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_suppliers"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["status", "name"], name="suppliers_status_name_idx")]

    def __str__(self):
        return self.name


class SupplierResource(models.Model):
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name="resources")
    name = models.CharField(max_length=160)
    category = models.CharField(max_length=100, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit = models.CharField(max_length=40, default="units")
    note = models.TextField(blank=True)
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["supplier__name", "name"]
        constraints = [models.CheckConstraint(condition=models.Q(quantity__gte=0), name="suppliers_resource_qty_nonnegative")]
        indexes = [models.Index(fields=["supplier", "is_available"], name="suppliers_resource_avail_idx")]

    def __str__(self):
        return f"{self.name} — {self.supplier.name}"
