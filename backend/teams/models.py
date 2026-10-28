from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Team(models.Model):
    class Availability(models.TextChoices):
        READY = "ready", "Ready"
        LIMITED = "limited", "Limited"
        UNAVAILABLE = "unavailable", "Unavailable"

    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="teams")
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    availability = models.CharField(max_length=16, choices=Availability.choices, default=Availability.READY)
    capabilities = models.ManyToManyField("help_requests.AssistanceCategory", blank=True, related_name="teams")
    service_districts = models.ManyToManyField("locations.District", blank=True, related_name="response_teams")
    service_upazilas = models.ManyToManyField("locations.Upazila", blank=True, related_name="response_teams")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["organization__name", "name"]
        constraints = [
            models.UniqueConstraint(fields=["organization", "name"], name="teams_org_name_uniq"),
        ]
        indexes = [models.Index(fields=["organization", "is_active"], name="teams_org_active_idx")]

    def __str__(self):
        return f"{self.name} — {self.organization.name}"


class TeamMembership(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ENDED = "ended", "Ended"
        REMOVED = "removed", "Removed"

    class Role(models.TextChoices):
        MEMBER = "member", "Member"
        LEADER = "leader", "Team leader"

    team = models.ForeignKey(Team, on_delete=models.PROTECT, related_name="memberships")
    volunteer = models.ForeignKey("accounts.VolunteerProfile", on_delete=models.PROTECT, related_name="team_memberships")
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="team_assignments"
    )
    assigned_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["team", "role", "volunteer__user__name"]
        constraints = [
            models.UniqueConstraint(
                fields=["volunteer"], condition=Q(status="active"), name="teams_one_active_team_per_volunteer"
            ),
            models.UniqueConstraint(
                fields=["team"], condition=Q(status="active", role="leader"), name="teams_one_active_leader_per_team"
            ),
        ]
        indexes = [
            models.Index(fields=["team", "status"], name="teams_member_team_status_idx"),
            models.Index(fields=["volunteer", "status"], name="teams_member_vol_status_idx"),
        ]

    def __str__(self):
        return f"{self.volunteer} — {self.team} ({self.role})"
