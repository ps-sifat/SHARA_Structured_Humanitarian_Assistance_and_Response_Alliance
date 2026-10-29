from rest_framework.test import APITestCase

from accounts.models import User, VolunteerProfile
from help_requests.models import AssistanceCategory, HelpRequest
from locations.models import District, Upazila
from missions.models import Mission, MissionAssignment
from organizations.models import Organization, OrganizationAdmin, OrganizationMembership
from teams.models import Team, TeamMembership


class TeamManagementApiTests(APITestCase):
    def setUp(self):
        self.district = District.objects.create(name_bn="ঢাকা", name_en="Dhaka")
        self.upazila = Upazila.objects.create(district=self.district, name_bn="সাভার", name_en="Savar")
        self.category = AssistanceCategory.objects.create(code="food", name_bn="খাদ্য", name_en="Food")
        self.admin = User.objects.create_user(phone_number="01700000801", name="Org Admin", password="Safe-Password-842!")
        self.super_admin = User.objects.create_superuser(
            phone_number="01700000802", name="Super Admin", password="Safe-Password-842!"
        )
        self.other_admin = User.objects.create_user(
            phone_number="01700000803", name="Other Admin", password="Safe-Password-842!"
        )
        self.organization = Organization.objects.create(
            registered_by=self.admin, name="Verified Team Org", registration_status=Organization.RegistrationStatus.APPROVED
        )
        self.other_organization = Organization.objects.create(
            registered_by=self.other_admin, name="Other Org", registration_status=Organization.RegistrationStatus.APPROVED
        )
        OrganizationAdmin.objects.create(organization=self.organization, user=self.admin)
        OrganizationAdmin.objects.create(organization=self.other_organization, user=self.other_admin)
        self.leader = self.make_volunteer("01700000811", "Leader")
        self.member = self.make_volunteer("01700000812", "Member")
        self.outsider = self.make_volunteer("01700000813", "Outsider")
        for profile in (self.leader, self.member):
            OrganizationMembership.objects.create(organization=self.organization, volunteer=profile)
        OrganizationMembership.objects.create(organization=self.other_organization, volunteer=self.outsider)
        self.client.force_authenticate(self.admin)

    def make_volunteer(self, phone, name):
        user = User.objects.create_user(phone_number=phone, name=name, password="Safe-Password-842!")
        return VolunteerProfile.objects.create(user=user, district=self.district, upazila=self.upazila)

    def create_team(self, **overrides):
        data = {
            "organization": self.organization.pk,
            "name": "Rapid Response",
            "availability": "ready",
            "capabilities": [self.category.pk],
            "service_districts": [self.district.pk],
            "service_upazilas": [self.upazila.pk],
        }
        data.update(overrides)
        return self.client.post("/api/teams/", data, format="json")

    def test_org_admin_can_create_edit_team_and_assign_only_approved_org_members(self):
        created = self.create_team()
        self.assertEqual(created.status_code, 201, created.data)
        team_id = created.data["id"]
        added_leader = self.client.post(
            f"/api/teams/{team_id}/members/", {"volunteer": self.leader.pk, "role": "leader"}, format="json"
        )
        added_member = self.client.post(
            f"/api/teams/{team_id}/members/", {"volunteer": self.member.pk}, format="json"
        )
        self.assertEqual(added_leader.status_code, 201, added_leader.data)
        self.assertEqual(added_member.status_code, 201, added_member.data)
        outsider = self.client.post(
            f"/api/teams/{team_id}/members/", {"volunteer": self.outsider.pk}, format="json"
        )
        self.assertEqual(outsider.status_code, 400, outsider.data)

        edited = self.client.patch(f"/api/teams/{team_id}/", {"availability": "limited"}, format="json")
        self.assertEqual(edited.status_code, 200, edited.data)
        self.assertEqual(edited.data["availability"], "limited")
        self.assertEqual(TeamMembership.objects.filter(team_id=team_id, status="active").count(), 2)

    def test_team_and_member_management_are_scoped_to_active_org_admins(self):
        team = Team.objects.create(organization=self.organization, name="Private Team")
        self.client.force_authenticate(self.other_admin)
        self.assertEqual(self.client.get(f"/api/teams/{team.pk}/").status_code, 404)
        self.assertEqual(
            self.client.post(f"/api/teams/{team.pk}/members/", {"volunteer": self.member.pk}, format="json").status_code,
            404,
        )
        self.client.force_authenticate(self.super_admin)
        self.assertEqual(self.client.post("/api/teams/", {"organization": self.organization.pk, "name": "No"}, format="json").status_code, 403)

    def test_eligible_member_roster_is_limited_to_active_org_members_not_already_on_a_team(self):
        roster = self.client.get(f"/api/teams/eligible-members/?organization={self.organization.pk}")
        self.assertEqual(roster.status_code, 200, roster.data)
        self.assertEqual({row["volunteer"] for row in roster.data}, {self.leader.pk, self.member.pk})
        team = Team.objects.create(organization=self.organization, name="Existing team")
        TeamMembership.objects.create(team=team, volunteer=self.leader)
        filtered = self.client.get(f"/api/teams/eligible-members/?organization={self.organization.pk}")
        self.assertEqual({row["volunteer"] for row in filtered.data}, {self.member.pk})
        self.client.force_authenticate(self.other_admin)
        forbidden = self.client.get(f"/api/teams/eligible-members/?organization={self.organization.pk}")
        self.assertEqual(forbidden.status_code, 403)

    def test_team_leader_must_be_an_active_member_and_removal_keeps_history(self):
        team = Team.objects.create(organization=self.organization, name="History Team")
        not_added = self.client.post(f"/api/teams/{team.pk}/set-leader/", {"volunteer": self.leader.pk}, format="json")
        self.assertEqual(not_added.status_code, 400, not_added.data)
        member = self.client.post(
            f"/api/teams/{team.pk}/members/", {"volunteer": self.leader.pk}, format="json"
        )
        membership_id = member.data["id"]
        promoted = self.client.post(
            f"/api/teams/{team.pk}/set-leader/", {"volunteer": self.leader.pk}, format="json"
        )
        self.assertEqual(promoted.status_code, 200, promoted.data)
        removed = self.client.post(f"/api/team-memberships/{membership_id}/remove/", {}, format="json")
        self.assertEqual(removed.status_code, 200, removed.data)
        self.assertEqual(TeamMembership.objects.get(pk=membership_id).status, TeamMembership.Status.REMOVED)
        self.assertIsNotNone(TeamMembership.objects.get(pk=membership_id).ended_at)

    def test_leader_or_member_cannot_be_removed_while_their_team_has_an_active_mission(self):
        team = Team.objects.create(organization=self.organization, name="Active Team")
        leader_membership = TeamMembership.objects.create(team=team, volunteer=self.leader, role=TeamMembership.Role.LEADER)
        request = HelpRequest.objects.create(
            district=self.district,
            upazila=self.upazila,
            contact_phone="+8801700000901",
            verification_status=HelpRequest.VerificationStatus.VERIFIED,
        )
        request.assistance_categories.add(self.category)
        mission = Mission.objects.create(help_request=request)
        MissionAssignment.objects.create(
            mission=mission, team=team, assigned_team_leader=self.leader.user, assigned_by=self.super_admin
        )
        blocked = self.client.post(f"/api/team-memberships/{leader_membership.pk}/remove/", {}, format="json")
        self.assertEqual(blocked.status_code, 400, blocked.data)
        leader_membership.refresh_from_db()
        self.assertEqual(leader_membership.status, TeamMembership.Status.ACTIVE)
        self.assertEqual(mission.assignments.filter(is_active=True).count(), 1)


