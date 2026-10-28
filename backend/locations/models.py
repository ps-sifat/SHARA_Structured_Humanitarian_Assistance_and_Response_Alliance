from django.db import models


class District(models.Model):
    name_bn = models.CharField(max_length=120)
    name_en = models.CharField(max_length=120, blank=True)
    code = models.CharField(max_length=20, blank=True, null=True, unique=True)
    is_demo_subset = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name_en", "name_bn"]
        indexes = [models.Index(fields=["name_en"], name="locations_dist_name_idx")]

    def __str__(self):
        return self.name_en or self.name_bn


class Upazila(models.Model):
    district = models.ForeignKey(District, on_delete=models.PROTECT, related_name="upazilas")
    name_bn = models.CharField(max_length=120)
    name_en = models.CharField(max_length=120, blank=True)
    code = models.CharField(max_length=20, blank=True, null=True, unique=True)
    is_demo_subset = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["district__name_en", "name_en", "name_bn"]
        constraints = [
            models.UniqueConstraint(fields=["district", "name_bn"], name="locations_upazila_dist_bn_uniq"),
        ]
        indexes = [models.Index(fields=["district", "name_en"], name="locations_upazila_name_idx")]

    def __str__(self):
        return f"{self.name_en or self.name_bn}, {self.district}"
