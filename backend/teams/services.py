from django.core.exceptions import ValidationError
from django.db import transaction

from organizations.models import Organization, OrganizationAdmin, OrganizationMembership

from .models import TeamMembership


@transaction.atomic
def assign_team_member(team, volunteer, assigned_by, role=TeamMembership.Role.MEMBER):
    if not assigned_by.is_active or not OrganizationAdmin.objects.filter(
        organization=team.organization, user=assigned_by, status=OrganizationAdmin.Status.ACTIVE
    ).exists():
        raise ValidationError("An active administrator of this organization is required.")
    if (
        not team.is_active
        or not team.organization.is_active
        or team.organization.registration_status != Organization.RegistrationStatus.APPROVED
    ):
        raise ValidationError("Members can only be assigned to an active team in an approved organization.")
    is_member = OrganizationMembership.objects.filter(
        organization=team.organization,
        volunteer=volunteer,
        status=OrganizationMembership.Status.ACTIVE,
    ).exists()
    if not is_member:
        raise ValidationError("The volunteer must be an approved member of this organization.")
    if TeamMembership.objects.filter(volunteer=volunteer, status=TeamMembership.Status.ACTIVE).exists():
        raise ValidationError("The volunteer already has an active team membership.")
    if role == TeamMembership.Role.LEADER and TeamMembership.objects.filter(
        team=team, status=TeamMembership.Status.ACTIVE, role=TeamMembership.Role.LEADER
    ).exists():
        raise ValidationError("This team already has an active leader.")
    return TeamMembership.objects.create(team=team, volunteer=volunteer, assigned_by=assigned_by, role=role)
