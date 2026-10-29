from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import Skill, User, VolunteerProfile
from locations.models import District, Upazila
from organizations.models import MembershipRequest, Organization, OrganizationAdmin, OrganizationMembership


class PartTwoApiTestCase(TestCase):
    def setUp(self):
        self.district = District.objects.create(name_bn="ঢাকা", name_en="Dhaka", is_demo_subset=True)
        self.upazila = Upazila.objects.create(
            district=self.district, name_bn="সাভার", name_en="Savar", is_demo_subset=True
        )
        self.other_district = District.objects.create(name_bn="চট্টগ্রাম", name_en="Chattogram", is_demo_subset=True)
        self.other_upazila = Upazila.objects.create(
            district=self.other_district, name_bn="হাটহাজারী", name_en="Hathazari", is_demo_subset=True
        )
        self.skill = Skill.objects.create(name="First aid")
        self.other_skill = Skill.objects.create(name="Water rescue")
        self.client = APIClient()

    def make_user(self, phone, name, email=None, password="Safe-Password-842!"):
        return User.objects.create_user(phone_number=phone, name=name, email=email, password=password)

    def make_profile(self, user):
        profile = VolunteerProfile.objects.create(user=user, district=self.district, upazila=self.upazila)
        profile.skills.add(self.skill)
        return profile

    def register_payload(self, **overrides):
        payload = {
            "name": "নতুন স্বেচ্ছাসেবক",
            "phone_number": "০১৭০০-০০০০০১",
            "email": "Volunteer@Example.test",
            "password": "Long-safe-password-842!",
            "district": self.district.pk,
            "upazila": self.upazila.pk,
            "service_upazilas": [self.upazila.pk],
            "skills": [self.skill.pk],
            "availability": "available",
            "vehicle_access": False,
            "swimming_capability": True,
        }
        payload.update(overrides)
        return payload


class AuthenticationApiTests(PartTwoApiTestCase):
    def test_registration_normalizes_identifiers_hashes_password_and_creates_profile(self):
        response = self.client.post("/api/auth/register/", self.register_payload(), format="json")

        self.assertEqual(response.status_code, 201, response.data)
        user = User.objects.get(email="volunteer@example.test")
        self.assertEqual(user.phone_number, "+8801700000001")
        self.assertTrue(user.check_password("Long-safe-password-842!"))
        self.assertNotEqual(user.password, "Long-safe-password-842!")
        profile = VolunteerProfile.objects.get(user=user)
        self.assertEqual(list(profile.skills.values_list("pk", flat=True)), [self.skill.pk])
        self.assertEqual(response.data["user"]["id"], user.pk)
        self.assertTrue(response.data["user"]["is_volunteer"])
        self.assertNotIn("password", response.data["user"])
        self.assertTrue(self.client.get("/api/auth/me/").data["user"])

    def test_registration_rejects_duplicate_normalized_phone_or_email(self):
        self.make_user("01700000001", "Existing", "person@example.test")

        phone_response = self.client.post(
            "/api/auth/register/", self.register_payload(email="new@example.test"), format="json"
        )
        email_response = self.client.post(
            "/api/auth/register/", self.register_payload(phone_number="01700000002", email="PERSON@example.test"), format="json"
        )

        self.assertEqual(phone_response.status_code, 400)
        self.assertEqual(email_response.status_code, 400)
        self.assertEqual(User.objects.count(), 1)

    def test_registration_enforces_password_validation_and_district_upazila_match(self):
        weak_password = self.client.post(
            "/api/auth/register/", self.register_payload(password="password"), format="json"
        )
        wrong_location = self.client.post(
            "/api/auth/register/",
            self.register_payload(phone_number="01700000002", upazila=self.other_upazila.pk),
            format="json",
        )

        self.assertEqual(weak_password.status_code, 400)
        self.assertEqual(wrong_location.status_code, 400)
        self.assertFalse(User.objects.exists())

    def test_login_accepts_normalized_email_or_phone_and_uses_generic_errors(self):
        user = self.make_user("01700000011", "Existing", "person@example.test")
        self.make_profile(user)

        email_login = self.client.post(
            "/api/auth/login/", {"identifier": " PERSON@example.test ", "password": "Safe-Password-842!"}, format="json"
        )
        self.assertEqual(email_login.status_code, 200, email_login.data)
        self.assertEqual(email_login.data["user"]["id"], user.pk)
        self.client.post("/api/auth/logout/", {}, format="json")

        phone_login = self.client.post(
            "/api/auth/login/", {"identifier": "০১৭-০০০০০০১১", "password": "Safe-Password-842!"}, format="json"
        )
        self.assertEqual(phone_login.status_code, 200, phone_login.data)
        self.client.post("/api/auth/logout/", {}, format="json")

        invalid_login = self.client.post(
            "/api/auth/login/", {"identifier": "person@example.test", "password": "wrong"}, format="json"
        )
        self.assertEqual(invalid_login.status_code, 400)
        self.assertEqual(invalid_login.data["detail"], "Unable to log in with provided credentials.")

        user.is_active = False
        user.save(update_fields=["is_active", "updated_at"])
        inactive_login = self.client.post(
            "/api/auth/login/", {"identifier": "01700000011", "password": "Safe-Password-842!"}, format="json"
        )
        self.assertEqual(inactive_login.status_code, 400)
        self.assertEqual(inactive_login.data["detail"], invalid_login.data["detail"])

    def test_login_logout_and_unsafe_session_requests_enforce_csrf(self):
        self.make_user("01700000021", "Existing", "person@example.test")
        client = APIClient(enforce_csrf_checks=True)
        csrf_response = client.get("/api/auth/csrf/")
        token = client.cookies["csrftoken"].value
        self.assertEqual(csrf_response.status_code, 200)

        rejected_login = client.post(
            "/api/auth/login/", {"identifier": "person@example.test", "password": "Safe-Password-842!"}, format="json"
        )
        self.assertEqual(rejected_login.status_code, 403)

        login = client.post(
            "/api/auth/login/",
            {"identifier": "person@example.test", "password": "Safe-Password-842!"},
            format="json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(login.status_code, 200, login.data)
        self.assertEqual(client.get("/api/auth/me/").data["user"]["name"], "Existing")
        self.assertEqual(client.post("/api/auth/logout/", {}, format="json").status_code, 403)

        token = client.cookies["csrftoken"].value
        logout = client.post("/api/auth/logout/", {}, format="json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(logout.status_code, 204)
        self.assertIsNone(client.get("/api/auth/me/").data["user"])

    def test_password_change_requires_current_password_and_updates_session_hash(self):
        user = self.make_user("01700000031", "Existing", "person@example.test")
        self.client.force_authenticate(user)

        wrong = self.client.post(
            "/api/auth/password/", {"current_password": "wrong", "new_password": "Another-Safe-997!"}, format="json"
        )
        self.assertEqual(wrong.status_code, 400)

        changed = self.client.post(
            "/api/auth/password/",
            {"current_password": "Safe-Password-842!", "new_password": "Another-Safe-997!"},
            format="json",
        )
        self.assertEqual(changed.status_code, 200, changed.data)
        user.refresh_from_db()
        self.assertTrue(user.check_password("Another-Safe-997!"))


class VolunteerProfileApiTests(PartTwoApiTestCase):
    def test_profile_endpoint_only_reads_and_updates_the_signed_in_volunteer(self):
        owner = self.make_user("01700000101", "Profile Owner")
        profile = self.make_profile(owner)
        other = self.make_user("01700000102", "Other User")
        other_profile = self.make_profile(other)
        self.client.force_authenticate(owner)

        response = self.client.get("/api/profile/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["id"], owner.pk)
        self.assertEqual(response.data["skills"][0]["id"], self.skill.pk)

        updated = self.client.patch(
            "/api/profile/",
            {"name": "Updated Owner", "skills": [self.other_skill.pk], "vehicle_access": True},
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        owner.refresh_from_db()
        other_profile.refresh_from_db()
        self.assertEqual(owner.name, "Updated Owner")
        self.assertEqual(list(profile.skills.values_list("pk", flat=True)), [self.other_skill.pk])
        self.assertFalse(other_profile.vehicle_access)
        self.assertEqual(self.client.get(f"/api/profiles/{other_profile.pk}/").status_code, 404)

    def test_profile_update_validates_normalized_unique_identifiers_and_location_relationship(self):
        owner = self.make_user("01700000111", "Owner")
        self.make_profile(owner)
        self.make_user("01700000112", "Other", "taken@example.test")
        self.client.force_authenticate(owner)

        duplicate_phone = self.client.patch("/api/profile/", {"phone_number": "০১৭০০০০০১১২"}, format="json")
        duplicate_email = self.client.patch("/api/profile/", {"email": "TAKEN@example.test"}, format="json")
        mismatched_location = self.client.patch(
            "/api/profile/", {"upazila": self.other_upazila.pk}, format="json"
        )

        self.assertEqual(duplicate_phone.status_code, 400)
        self.assertEqual(duplicate_email.status_code, 400)
        self.assertEqual(mismatched_location.status_code, 400)


class OrganizationApiTests(PartTwoApiTestCase):
    def setUp(self):
        super().setUp()
        self.applicant = self.make_user("01700000201", "Applicant")
        self.applicant_profile = self.make_profile(self.applicant)
        self.super_admin = User.objects.create_superuser(
            phone_number="01700000202", name="Super Admin", password="Safe-Password-842!"
        )
        self.other_user = self.make_user("01700000203", "Other Organization Admin")
        self.other_profile = self.make_profile(self.other_user)
        self.organization = Organization.objects.create(
            registered_by=self.applicant, name="Verified Response Group", registration_status="approved"
        )
        self.other_organization = Organization.objects.create(
            registered_by=self.other_user, name="Other Response Group", registration_status="approved"
        )
        OrganizationAdmin.objects.create(organization=self.organization, user=self.applicant)
        OrganizationAdmin.objects.create(organization=self.other_organization, user=self.other_user)

    def test_registration_requires_login_binds_owner_and_applicant_can_see_pending_status(self):
        payload = {
            "name": "New Response Group",
            "description": "Volunteer response organization",
            "organization_type": "community",
            "contact_email": "contact@example.test",
            "contact_phone": "01700000301",
            "service_districts": [self.district.pk],
            "service_upazilas": [self.upazila.pk],
            "registration_status": "approved",
            "registered_by": self.super_admin.pk,
        }
        anonymous = self.client.post("/api/organizations/", payload, format="json")
        self.assertEqual(anonymous.status_code, 403)

        self.client.force_authenticate(self.applicant)
        response = self.client.post("/api/organizations/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        organization = Organization.objects.get(pk=response.data["id"])
        self.assertEqual(organization.registered_by, self.applicant)
        self.assertEqual(organization.registration_status, Organization.RegistrationStatus.PENDING)
        self.assertFalse(organization.administrators.filter(status="active").exists())
        mine = self.client.get("/api/organizations/mine/")
        self.assertEqual(mine.status_code, 200)
        self.assertEqual(mine.data[0]["registration_status"], "pending")
        public_ids = [item["id"] for item in self.client.get("/api/organizations/").data]
        self.assertNotIn(organization.pk, public_ids)

    def test_public_organization_detail_hides_private_review_and_contact_fields(self):
        self.organization.contact_email = "private@example.test"
        self.organization.contact_phone = "+8801700000001"
        self.organization.review_note = "Internal reviewer note"
        self.organization.save(update_fields=["contact_email", "contact_phone", "review_note", "updated_at"])

        public = self.client.get(f"/api/organizations/{self.organization.pk}/")
        self.assertEqual(public.status_code, 200)
        self.assertNotIn("contact_email", public.data)
        self.assertNotIn("contact_phone", public.data)
        self.assertNotIn("review_note", public.data)

        self.client.force_authenticate(self.applicant)
        admin = self.client.get(f"/api/organizations/{self.organization.pk}/")
        self.assertEqual(admin.data["contact_email"], "private@example.test")

    def test_only_super_admin_can_approve_or_reject_and_rejection_needs_a_reason(self):
        pending = Organization.objects.create(registered_by=self.applicant, name="Pending Group")
        self.client.force_authenticate(self.applicant)
        forbidden = self.client.post(f"/api/organizations/{pending.pk}/approve/", {}, format="json")
        self.assertEqual(forbidden.status_code, 403)
        self.assertFalse(pending.administrators.filter(status="active").exists())

        self.client.force_authenticate(self.super_admin)
        approved = self.client.post(f"/api/organizations/{pending.pk}/approve/", {}, format="json")
        self.assertEqual(approved.status_code, 200, approved.data)
        pending.refresh_from_db()
        self.assertEqual(pending.registration_status, Organization.RegistrationStatus.APPROVED)
        self.assertTrue(pending.administrators.filter(user=self.applicant, status="active").exists())
        self.assertFalse(self.applicant.is_superuser)

        another = Organization.objects.create(registered_by=self.applicant, name="Another Pending Group")
        missing_reason = self.client.post(f"/api/organizations/{another.pk}/reject/", {}, format="json")
        self.assertEqual(missing_reason.status_code, 400)
        rejected = self.client.post(
            f"/api/organizations/{another.pk}/reject/", {"reason": "Could not verify registration."}, format="json"
        )
        self.assertEqual(rejected.status_code, 200, rejected.data)
        another.refresh_from_db()
        self.assertEqual(another.registration_status, Organization.RegistrationStatus.REJECTED)
        self.assertEqual(another.review_note, "Could not verify registration.")
        self.assertFalse(another.administrators.filter(status="active").exists())

    def test_pending_applicant_cannot_access_verified_organization_management(self):
        pending = Organization.objects.create(registered_by=self.applicant, name="Pending Group")
        self.client.force_authenticate(self.applicant)

        self.assertEqual(self.client.patch(f"/api/organizations/{pending.pk}/", {"name": "Changed"}, format="json").status_code, 404)
        self.assertEqual(self.client.get(f"/api/organizations/{pending.pk}/membership-requests/").status_code, 404)

    def test_membership_request_withdrawal_approval_and_conflicting_pending_closure(self):
        volunteer = self.make_user("01700000211", "Volunteer")
        volunteer_profile = self.make_profile(volunteer)
        another_volunteer = self.make_user("01700000212", "Second Volunteer")
        another_profile = self.make_profile(another_volunteer)
        second_org = Organization.objects.create(
            registered_by=self.other_user, name="Second Verified Group", registration_status="approved"
        )
        OrganizationAdmin.objects.create(organization=second_org, user=self.other_user)

        self.client.force_authenticate(volunteer)
        first_request = self.client.post(f"/api/organizations/{self.organization.pk}/membership-requests/", {}, format="json")
        duplicate = self.client.post(f"/api/organizations/{self.organization.pk}/membership-requests/", {}, format="json")
        second_request = self.client.post(f"/api/organizations/{second_org.pk}/membership-requests/", {}, format="json")
        self.assertEqual(first_request.status_code, 201, first_request.data)
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(second_request.status_code, 201, second_request.data)

        self.client.force_authenticate(another_volunteer)
        withdrawal_request = self.client.post(
            f"/api/organizations/{self.organization.pk}/membership-requests/", {}, format="json"
        )
        withdrawn = self.client.post(
            f"/api/membership-requests/{withdrawal_request.data['id']}/withdraw/", {}, format="json"
        )
        self.assertEqual(withdrawn.status_code, 200, withdrawn.data)
        self.assertEqual(withdrawn.data["status"], "withdrawn")

        self.client.force_authenticate(self.applicant)
        requests = self.client.get(f"/api/organizations/{self.organization.pk}/membership-requests/")
        self.assertEqual(requests.status_code, 200, requests.data)
        self.assertEqual(len(requests.data), 2)
        approved = self.client.post(f"/api/membership-requests/{first_request.data['id']}/approve/", {}, format="json")
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertTrue(
            OrganizationMembership.objects.filter(
                organization=self.organization, volunteer=volunteer_profile, status=OrganizationMembership.Status.ACTIVE
            ).exists()
        )
        conflicting = MembershipRequest.objects.get(pk=second_request.data["id"])
        self.assertEqual(conflicting.status, MembershipRequest.Status.REJECTED)
        self.assertIn("joined", conflicting.decision_note.lower())

    def test_only_the_correct_organization_admin_can_review_and_volunteers_cannot_read_others_requests(self):
        volunteer = self.make_user("01700000221", "Volunteer")
        volunteer_profile = self.make_profile(volunteer)
        request = MembershipRequest.objects.create(organization=self.organization, volunteer=volunteer_profile)
        self.client.force_authenticate(self.other_user)
        cross_organization_review = self.client.post(f"/api/membership-requests/{request.pk}/approve/", {}, format="json")
        self.assertEqual(cross_organization_review.status_code, 404)

        self.client.force_authenticate(self.other_profile.user)
        cross_user_withdrawal = self.client.post(f"/api/membership-requests/{request.pk}/withdraw/", {}, format="json")
        self.assertEqual(cross_user_withdrawal.status_code, 404)

        self.client.force_authenticate(self.applicant)
        rejection = self.client.post(
            f"/api/membership-requests/{request.pk}/reject/", {"reason": "Please update your profile."}, format="json"
        )
        self.assertEqual(rejection.status_code, 200, rejection.data)
        request.refresh_from_db()
        self.assertEqual(request.status, MembershipRequest.Status.REJECTED)
        self.assertEqual(request.decision_note, "Please update your profile.")

    def test_super_admin_without_an_organization_admin_relationship_cannot_review_memberships(self):
        volunteer = self.make_user("01700000231", "Volunteer")
        volunteer_profile = self.make_profile(volunteer)
        request = MembershipRequest.objects.create(organization=self.organization, volunteer=volunteer_profile)
        self.client.force_authenticate(self.super_admin)

        response = self.client.post(f"/api/membership-requests/{request.pk}/approve/", {}, format="json")

        self.assertEqual(response.status_code, 404)
        self.assertFalse(OrganizationMembership.objects.filter(volunteer=volunteer_profile).exists())

    def test_membership_requests_require_a_verified_organization_and_no_active_membership(self):
        volunteer = self.make_user("01700000241", "Volunteer")
        volunteer_profile = self.make_profile(volunteer)
        pending = Organization.objects.create(registered_by=self.applicant, name="Pending Group")
        another_approved = Organization.objects.create(
            registered_by=self.other_user, name="Another Verified Group", registration_status="approved"
        )
        self.client.force_authenticate(volunteer)

        pending_response = self.client.post(f"/api/organizations/{pending.pk}/membership-requests/", {}, format="json")
        self.assertEqual(pending_response.status_code, 404)

        OrganizationMembership.objects.create(organization=self.organization, volunteer=volunteer_profile)
        active_response = self.client.post(
            f"/api/organizations/{another_approved.pk}/membership-requests/", {}, format="json"
        )
        self.assertEqual(active_response.status_code, 400)
        self.assertEqual(
            OrganizationMembership.objects.filter(volunteer=volunteer_profile, status=OrganizationMembership.Status.ACTIVE).count(),
            1,
        )

    def test_organization_profile_updates_cannot_change_identity_verification_or_owner(self):
        self.client.force_authenticate(self.applicant)
        response = self.client.patch(
            f"/api/organizations/{self.organization.pk}/",
            {
                "name": "Updated Response Group",
                "registration_status": "rejected",
                "registered_by": self.other_user.pk,
                "review_note": "Changed by client",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.organization.refresh_from_db()
        self.assertEqual(self.organization.name, "Updated Response Group")
        self.assertEqual(self.organization.registration_status, Organization.RegistrationStatus.APPROVED)
        self.assertEqual(self.organization.registered_by, self.applicant)
        self.assertEqual(self.organization.review_note, "")
