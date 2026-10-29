from rest_framework.test import APITestCase

from accounts.models import User, VolunteerProfile
from help_requests.models import AssistanceCategory, HelpRequest
from locations.models import District, Upazila
from missions.models import Mission, MissionAssignment
from organizations.models import Organization, OrganizationAdmin, OrganizationMembership
from teams.models import Team, TeamMembership


class MissionDispatchApiTests(APITestCase):
    def setUp(self):
        self.district = District.objects.create(name_bn="ঢাকা", name_en="Dhaka")
        self.upazila = Upazila.objects.create(district=self.district, name_bn="সাভার", name_en="Savar")
        self.other_upazila = Upazila.objects.create(district=self.district, name_bn="ধামরাই", name_en="Dhamrai")
        self.food = AssistanceCategory.objects.create(code="food", name_bn="খাদ্য", name_en="Food")
        self.water = AssistanceCategory.objects.create(code="water", name_bn="পানি", name_en="Water")
        self.super_admin = User.objects.create_superuser(
            phone_number="01700000701", name="Super Admin", password="Safe-Password-842!"
        )
        self.org_admin = User.objects.create_user(
            phone_number="01700000702", name="Organization Admin", password="Safe-Password-842!"
        )
        self.other_admin = User.objects.create_user(
            phone_number="01700000703", name="Other Admin", password="Safe-Password-842!"
        )
        self.leader = self.make_volunteer("01700000711", "Team Leader")
        self.member = self.make_volunteer("01700000712", "Ordinary Member")
        self.other_volunteer = self.make_volunteer("01700000713", "Unrelated Volunteer")
        self.organization = Organization.objects.create(
            registered_by=self.org_admin, name="Verified Response Org", registration_status=Organization.RegistrationStatus.APPROVED
        )
        self.other_organization = Organization.objects.create(
            registered_by=self.other_admin, name="Other Verified Org", registration_status=Organization.RegistrationStatus.APPROVED
        )
        OrganizationAdmin.objects.create(organization=self.organization, user=self.org_admin)
        OrganizationAdmin.objects.create(organization=self.other_organization, user=self.other_admin)
        for volunteer in (self.leader, self.member):
            OrganizationMembership.objects.create(organization=self.organization, volunteer=volunteer)
        OrganizationMembership.objects.create(organization=self.other_organization, volunteer=self.other_volunteer)
        self.team = self.make_team("Dispatch Team", upazila=self.upazila)
        TeamMembership.objects.create(team=self.team, volunteer=self.leader, role=TeamMembership.Role.LEADER)
        TeamMembership.objects.create(team=self.team, volunteer=self.member)
        self.client.force_authenticate(self.super_admin)

    def make_volunteer(self, phone, name):
        user = User.objects.create_user(phone_number=phone, name=name, password="Safe-Password-842!")
        return VolunteerProfile.objects.create(user=user, district=self.district, upazila=self.upazila)

    def make_team(self, name, upazila=None, capabilities=None, organization=None, availability=Team.Availability.READY):
        team = Team.objects.create(
            organization=organization or self.organization,
            name=name,
            availability=availability,
        )
        team.service_districts.add(self.district)
        if upazila:
            team.service_upazilas.add(upazila)
        team.capabilities.add(*(capabilities or [self.food]))
        return team

    def make_request(self, number, verified=False, categories=None, upazila=None):
        record = HelpRequest.objects.create(
            request_code=f"SH-DISPATCH-{number:03d}",
            district=self.district,
            upazila=upazila or self.upazila,
            contact_phone="+8801700000901",
            tracking_token_hash="hash" + str(number),
            verification_status=HelpRequest.VerificationStatus.VERIFIED if verified else HelpRequest.VerificationStatus.PENDING,
        )
        record.assistance_categories.set(categories or [self.food])
        return record

    def verify_and_dispatch(self, record, team=None):
        self.client.post(f"/api/help-requests/{record.pk}/verify/", {}, format="json")
        mission = Mission.objects.get(help_request=record)
        response = self.client.post(
            f"/api/missions/{mission.pk}/transition/",
            {"action": "assign", "team_id": (team or self.team).pk, "reason": "Best available area match."},
            format="json",
        )
        return mission, response

    def test_dispatch_requires_verification_and_team_suitability_is_explained(self):
        pending = self.make_request(1)
        unavailable = self.make_team("Unavailable Team", availability=Team.Availability.UNAVAILABLE)
        TeamMembership.objects.create(team=unavailable, volunteer=self.make_volunteer("01700000714", "Unavailable Leader"), role="leader")
        before = self.client.get(f"/api/help-requests/{pending.pk}/eligible-teams/")
        self.assertEqual(before.status_code, 400, before.data)
        self.client.post(f"/api/help-requests/{pending.pk}/verify/", {}, format="json")
        mission = Mission.objects.get(help_request=pending)
        eligible = self.client.get(f"/api/help-requests/{pending.pk}/eligible-teams/")
        self.assertEqual(eligible.status_code, 200, eligible.data)
        self.assertEqual([row["id"] for row in eligible.data], [self.team.pk])
        self.assertIn("area", " ".join(eligible.data[0]["reasons"]).lower())
        self.assertIn("capability", " ".join(eligible.data[0]["reasons"]).lower())
        self.assertEqual(mission.status, Mission.Status.AWAITING_ASSIGNMENT)
        assigned = self.client.post(
            f"/api/missions/{mission.pk}/transition/",
            {"action": "assign", "team_id": self.team.pk, "reason": "Best available area match."},
            format="json",
        )
        self.assertEqual(assigned.status_code, 200, assigned.data)

    def test_ordinary_member_cannot_transition_but_leader_can_complete_and_history_persists(self):
        request = self.make_request(2)
        mission, assigned = self.verify_and_dispatch(request)
        self.assertEqual(assigned.status_code, 200, assigned.data)

        self.client.force_authenticate(self.member.user)
        member_attempt = self.client.post(
            f"/api/missions/{mission.pk}/transition/", {"action": "acknowledge"}, format="json"
        )
        self.assertEqual(member_attempt.status_code, 403)
        member_list = self.client.get("/api/missions/")
        self.assertEqual(member_list.status_code, 200)
        self.assertEqual([item["id"] for item in member_list.data], [mission.pk])

        self.client.force_authenticate(self.leader.user)
        for action, reason in (("acknowledge", ""), ("start", ""), ("progress", "Water delivery started."), ("complete", "Food and water delivered.")):
            response = self.client.post(
                f"/api/missions/{mission.pk}/transition/", {"action": action, "reason": reason}, format="json"
            )
            self.assertEqual(response.status_code, 200, response.data)
        mission.refresh_from_db()
        self.assertEqual(mission.status, Mission.Status.DONE)
        self.assertEqual(mission.assignments.filter(is_active=True).count(), 0)
        self.assertEqual(mission.updates.count(), 6)
        self.assertEqual(mission.updates.latest("created_at").note, "Food and water delivered.")

    def test_decline_releases_team_and_reassignment_preserves_assignment_history(self):
        request = self.make_request(3)
        mission, assigned = self.verify_and_dispatch(request)
        self.assertEqual(assigned.status_code, 200, assigned.data)
        self.client.force_authenticate(self.leader.user)
        no_reason = self.client.post(
            f"/api/missions/{mission.pk}/transition/", {"action": "decline"}, format="json"
        )
        self.assertEqual(no_reason.status_code, 400)
        declined = self.client.post(
            f"/api/missions/{mission.pk}/transition/", {"action": "decline", "reason": "Team transport is unavailable."}, format="json"
        )
        self.assertEqual(declined.status_code, 200, declined.data)
        mission.refresh_from_db()
        self.assertEqual(mission.status, Mission.Status.AWAITING_ASSIGNMENT)
        old_assignment = mission.assignments.get(team=self.team)
        self.assertFalse(old_assignment.is_active)
        self.assertIsNotNone(old_assignment.ended_at)

        next_team = self.make_team("Replacement Team", upazila=self.upazila, capabilities=[self.food, self.water])
        next_leader = self.make_volunteer("01700000715", "Replacement Leader")
        OrganizationMembership.objects.create(organization=self.organization, volunteer=next_leader)
        TeamMembership.objects.create(team=next_team, volunteer=next_leader, role=TeamMembership.Role.LEADER)
        self.client.force_authenticate(self.super_admin)
        reassigned = self.client.post(
            f"/api/missions/{mission.pk}/transition/", {"action": "assign", "team_id": next_team.pk, "reason": "Replacement team selected after decline."}, format="json"
        )
        self.assertEqual(reassigned.status_code, 200, reassigned.data)
        mission.refresh_from_db()
        self.assertEqual(mission.assignments.count(), 2)
        self.assertEqual(mission.assignments.filter(is_active=True).get().team_id, next_team.pk)
        self.assertEqual(mission.updates.filter(action="decline").count(), 1)

    def test_team_workload_and_capability_prevent_conflicting_or_unsuitable_assignment(self):
        first = self.make_request(4, verified=True)
        first_mission = Mission.objects.create(help_request=first)
        MissionAssignment.objects.create(
            mission=first_mission, team=self.team, assigned_team_leader=self.leader.user, assigned_by=self.super_admin
        )
        second = self.make_request(5, verified=True)
        second_mission = Mission.objects.create(help_request=second)
        busy = self.client.post(
            f"/api/missions/{second_mission.pk}/transition/", {"action": "assign", "team_id": self.team.pk}, format="json"
        )
        self.assertEqual(busy.status_code, 400, busy.data)
        no_capability = self.make_team("No Match Team", upazila=self.upazila, capabilities=[self.water])
        self.assertFalse(self.client.get(f"/api/help-requests/{second.pk}/eligible-teams/").data)
        unsuitable = self.client.post(
            f"/api/missions/{second_mission.pk}/transition/", {"action": "assign", "team_id": no_capability.pk}, format="json"
        )
        self.assertEqual(unsuitable.status_code, 400, unsuitable.data)

    def test_unrelated_users_and_organizations_cannot_read_missions(self):
        request = self.make_request(6)
        mission, assigned = self.verify_and_dispatch(request)
        self.assertEqual(assigned.status_code, 200, assigned.data)
        self.client.force_authenticate(self.other_admin)
        self.assertEqual(self.client.get(f"/api/missions/{mission.pk}/").status_code, 404)
        self.client.force_authenticate(self.other_volunteer.user)
        self.assertEqual(self.client.get(f"/api/missions/{mission.pk}/").status_code, 404)
        self.client.force_authenticate(self.leader.user)
        detail = self.client.get(f"/api/missions/{mission.pk}/")
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertNotIn("contact_phone", detail.data["help_request"])

    def test_complete_fictional_public_to_portal_scenario_persists_shared_records(self):
        self.client.force_authenticate(None)
        submitted = self.client.post(
            "/api/help-requests/",
            {
                "reporter_type": "direct",
                "affected_person_name": "Fictional Applicant",
                "contact_phone": "01700000991",
                "district": self.district.pk,
                "upazila": self.upazila.pk,
                "people_affected": 4,
                "assistance_categories": [self.food.pk],
                "description": "Fictional flooding scenario for integration verification.",
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="fictional-end-to-end-request",
        )
        self.assertEqual(submitted.status_code, 201, submitted.data)
        reference = submitted.data["request_reference"]
        request = HelpRequest.objects.get(request_code=reference)

        scenario_leader = self.make_volunteer("01700000992", "Fictional Scenario Leader")
        OrganizationMembership.objects.create(organization=self.organization, volunteer=scenario_leader)
        self.client.force_authenticate(self.org_admin)
        team_response = self.client.post(
            "/api/teams/",
            {
                "organization": self.organization.pk,
                "name": "Fictional Flood Support Team",
                "availability": "ready",
                "capabilities": [self.food.pk],
                "service_districts": [self.district.pk],
                "service_upazilas": [self.upazila.pk],
            },
            format="json",
        )
        self.assertEqual(team_response.status_code, 201, team_response.data)
        scenario_team_id = team_response.data["id"]
        member_response = self.client.post(
            f"/api/teams/{scenario_team_id}/members/", {"volunteer": scenario_leader.pk}, format="json"
        )
        self.assertEqual(member_response.status_code, 201, member_response.data)
        leader_response = self.client.post(
            f"/api/teams/{scenario_team_id}/set-leader/", {"volunteer": scenario_leader.pk}, format="json"
        )
        self.assertEqual(leader_response.status_code, 200, leader_response.data)
        self.assertIn(scenario_team_id, [row["id"] for row in self.client.get("/api/teams/").data])

        self.client.force_authenticate(self.super_admin)
        verified = self.client.post(f"/api/help-requests/{request.pk}/verify/", {}, format="json")
        self.assertEqual(verified.status_code, 200, verified.data)
        mission_id = verified.data["mission_id"]
        eligible = self.client.get(f"/api/help-requests/{request.pk}/eligible-teams/")
        self.assertEqual(eligible.status_code, 200, eligible.data)
        self.assertIn(scenario_team_id, [row["id"] for row in eligible.data])
        assigned = self.client.post(
            f"/api/missions/{mission_id}/transition/",
            {"action": "assign", "team_id": scenario_team_id, "reason": "Best exact area and capability match."},
            format="json",
        )
        self.assertEqual(assigned.status_code, 200, assigned.data)

        self.client.force_authenticate(scenario_leader.user)
        for action, reason in (
            ("acknowledge", ""),
            ("start", ""),
            ("progress", "Fictional delivery began."),
            ("complete", "Fictional delivery completed."),
        ):
            update = self.client.post(
                f"/api/missions/{mission_id}/transition/", {"action": action, "reason": reason}, format="json"
            )
            self.assertEqual(update.status_code, 200, update.data)
        mission = Mission.objects.get(pk=mission_id)
        self.assertEqual(mission.status, Mission.Status.DONE)
        self.assertEqual(mission.updates.latest("created_at").note, "Fictional delivery completed.")

        volunteer_team = self.client.get("/api/teams/mine/")
        self.assertEqual(volunteer_team.status_code, 200, volunteer_team.data)
        self.assertEqual(volunteer_team.data["team"]["id"], scenario_team_id)
        volunteer_missions = self.client.get("/api/missions/")
        self.assertIn(mission_id, [row["id"] for row in volunteer_missions.data])

        self.client.force_authenticate(self.org_admin)
        organization_missions = self.client.get("/api/missions/")
        self.assertIn(mission_id, [row["id"] for row in organization_missions.data])
        organization_teams = self.client.get(f"/api/teams/?organization={self.organization.pk}")
        self.assertIn(scenario_team_id, [row["id"] for row in organization_teams.data])

        self.client.force_authenticate(self.super_admin)
        admin_detail = self.client.get(f"/api/help-requests/{request.pk}/")
        self.assertEqual(admin_detail.data["mission_status"], "done")
        self.assertEqual(admin_detail.data["mission_id"], mission_id)
        self.assertIn(reference, [row["request_code"] for row in self.client.get("/api/help-requests/?verification=verified").data])

        self.client.force_authenticate(None)
        tracking = self.client.post(
            "/api/help-requests/track/",
            {"reference": reference, "token": submitted.data["tracking_token"]},
            format="json",
        )
        self.assertEqual(tracking.status_code, 200, tracking.data)
        self.assertEqual(tracking.data["mission_status"], "done")
        self.assertNotIn("contact_phone", tracking.data)
        self.assertEqual(self.client.get(f"/api/missions/{mission_id}/").status_code, 403)


