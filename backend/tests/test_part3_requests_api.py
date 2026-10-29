import hashlib

from rest_framework.test import APIClient, APITestCase

from accounts.models import User, VolunteerProfile
from help_requests.models import AssistanceCategory, HelpRequest
from locations.models import District, Upazila
from missions.models import Mission


class PublicHelpRequestApiTests(APITestCase):
    def setUp(self):
        self.district = District.objects.create(name_bn="ঢাকা", name_en="Dhaka")
        self.upazila = Upazila.objects.create(district=self.district, name_bn="সাভার", name_en="Savar")
        self.other_district = District.objects.create(name_bn="চট্টগ্রাম", name_en="Chattogram")
        self.other_upazila = Upazila.objects.create(
            district=self.other_district, name_bn="হাটহাজারী", name_en="Hathazari"
        )
        self.food = AssistanceCategory.objects.create(code="food", name_bn="খাদ্য", name_en="Food")
        self.water = AssistanceCategory.objects.create(code="water", name_bn="পানি", name_en="Water")
        self.admin = User.objects.create_superuser(
            phone_number="01700000901", name="Request Reviewer", password="Safe-Password-842!"
        )
        self.client = APIClient()

    def payload(self, **overrides):
        payload = {
            "reporter_type": "direct",
            "affected_person_name": "Affected Person",
            "contact_phone": "01700000902",
            "district": self.district.pk,
            "upazila": self.upazila.pk,
            "people_affected": 3,
            "assistance_categories": [self.food.pk],
            "description": "Flood water entered the home.",
            "risks": ["medical_emergency"],
        }
        payload.update(overrides)
        return payload

    def submit(self, payload=None, key="request-key-0001"):
        return self.client.post(
            "/api/help-requests/",
            payload or self.payload(),
            format="json",
            HTTP_IDEMPOTENCY_KEY=key,
        )

    def test_direct_and_proxy_requests_return_reference_and_keep_only_tracking_hash(self):
        direct = self.submit()
        self.assertEqual(direct.status_code, 201, direct.data)
        self.assertIn("request_reference", direct.data)
        direct_token = direct.data["tracking_token"]
        self.assertGreaterEqual(len(direct_token), 40)
        request = HelpRequest.objects.get(request_code=direct.data["request_reference"])
        self.assertEqual(request.tracking_token_hash, hashlib.sha256(direct_token.encode()).hexdigest())
        self.assertNotIn(direct_token, request.tracking_token_hash)
        self.assertFalse(hasattr(request, "tracking_code"))

        proxy = self.submit(
            self.payload(
                reporter_type="proxy",
                reporter_name="Applicant Name",
                reporter_phone="01800000903",
                relation_to_affected="Neighbor",
            ),
            key="request-key-0002",
        )
        self.assertEqual(proxy.status_code, 201, proxy.data)
        stored = HelpRequest.objects.get(request_code=proxy.data["request_reference"])
        self.assertEqual(stored.reporter_name, "Applicant Name")
        self.assertEqual(stored.reporter_phone, "+8801800000903")
        self.assertEqual(stored.relation_to_affected, "Neighbor")

    def test_public_submission_validates_area_people_categories_phone_and_proxy_details(self):
        cases = [
            self.payload(upazila=self.other_upazila.pk),
            self.payload(people_affected=0),
            self.payload(assistance_categories=[]),
            self.payload(contact_phone="12345"),
            self.payload(reporter_type="proxy", reporter_name="", reporter_phone="", relation_to_affected=""),
        ]
        for number, payload in enumerate(cases, start=1):
            with self.subTest(number=number):
                response = self.submit(payload, key=f"invalid-request-{number}")
                self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(HelpRequest.objects.count(), 0)

    def test_idempotency_reuses_reference_and_rejects_a_changed_payload(self):
        payload = self.payload()
        first = self.submit(payload, key="stable-request-key-001")
        duplicate = self.submit(payload, key="stable-request-key-001")
        changed = self.submit(self.payload(people_affected=4), key="stable-request-key-001")

        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(duplicate.status_code, 200, duplicate.data)
        self.assertEqual(first.data, duplicate.data)
        self.assertEqual(changed.status_code, 409, changed.data)
        self.assertEqual(HelpRequest.objects.count(), 1)

    def test_tracking_requires_reference_and_private_token_and_returns_safe_fields(self):
        submitted = self.submit(key="tracking-request-key")
        token = submitted.data["tracking_token"]
        reference = submitted.data.get("request_reference")
        self.assertEqual(submitted.status_code, 201, submitted.data)

        missing = self.client.post("/api/help-requests/track/", {"reference": reference, "token": "bad"}, format="json")
        tracked = self.client.post(
            "/api/help-requests/track/", {"reference": reference, "token": token}, format="json"
        )

        self.assertEqual(missing.status_code, 404)
        self.assertEqual(tracked.status_code, 200, tracked.data)
        for private_field in (
            "contact_phone", "reporter_phone", "reporter_name", "affected_person_name", "review_note", "team_name"
        ):
            self.assertNotIn(private_field, tracked.data)
        self.assertEqual(tracked.data["request_reference"], reference)
        self.assertEqual(tracked.data["verification_status"], "pending")

    def test_public_categories_and_map_summary_use_live_data_and_suppress_small_counts(self):
        categories = self.client.get("/api/help-requests/assistance-categories/")
        self.assertEqual(categories.status_code, 200, categories.data)
        self.assertEqual({row["id"] for row in categories.data}, {self.food.pk, self.water.pk})

        for number in range(2):
            HelpRequest.objects.create(
                district=self.district,
                upazila=self.upazila,
                contact_phone=f"+88017000001{number:02d}",
                verification_status=HelpRequest.VerificationStatus.VERIFIED,
            )
        for number in range(3):
            HelpRequest.objects.create(
                district=self.other_district,
                upazila=self.other_upazila,
                contact_phone=f"+88017000002{number:02d}",
                verification_status=HelpRequest.VerificationStatus.VERIFIED,
            )

        summary = self.client.get("/api/map/summary/")
        self.assertEqual(summary.status_code, 200, summary.data)
        by_district = {row["district_id"]: row for row in summary.data}
        self.assertIsNone(by_district[self.district.pk]["verified_requests"])
        self.assertEqual(by_district[self.district.pk]["count_label"], "not_reported")
        self.assertEqual(by_district[self.other_district.pk]["verified_requests"], 3)
        self.assertNotIn("upazila", summary.data[0])
        self.assertNotIn("contact_phone", summary.data[0])

    def test_volunteers_get_verified_safe_request_summaries_without_accept_action(self):
        submitted = self.submit(key="safe-open-request")
        record = HelpRequest.objects.get(request_code=submitted.data["request_reference"])
        self.client.force_authenticate(self.admin)
        self.client.post(f"/api/help-requests/{record.pk}/verify/", {}, format="json")
        volunteer_user = User.objects.create_user(phone_number="01700000910", name="Safe Summary Volunteer", password="Safe-Password-842!")
        VolunteerProfile.objects.create(user=volunteer_user, district=self.district, upazila=self.upazila)
        self.client.force_authenticate(volunteer_user)
        response = self.client.get("/api/help-requests/safe-open/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data[0]["request_reference"], submitted.data["request_reference"])
        for private_field in ("contact_phone", "reporter_name", "affected_person_name", "description", "tracking_token"):
            self.assertNotIn(private_field, response.data[0])

    def test_admin_review_hides_pii_from_list_and_verification_creates_awaiting_mission(self):
        submitted = self.submit(key="admin-review-request")
        reference = submitted.data.get("request_reference")
        request = HelpRequest.objects.get(request_code=reference)

        anonymous_list = self.client.get("/api/help-requests/")
        self.assertEqual(anonymous_list.status_code, 403)
        self.client.force_authenticate(self.admin)
        queue = self.client.get("/api/help-requests/")
        self.assertEqual(queue.status_code, 200, queue.data)
        self.assertNotIn("contact_phone", queue.data[0])
        self.assertNotIn("reporter_name", queue.data[0])
        detail = self.client.get(f"/api/help-requests/{request.pk}/")
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(detail.data["contact_phone"], "+8801700000902")

        verified = self.client.post(f"/api/help-requests/{request.pk}/verify/", {}, format="json")
        self.assertEqual(verified.status_code, 200, verified.data)
        request.refresh_from_db()
        self.assertEqual(request.verification_status, HelpRequest.VerificationStatus.VERIFIED)
        self.assertEqual(request.mission.status, Mission.Status.AWAITING_ASSIGNMENT)

    def test_rejection_requires_reason_and_clarification_has_a_tracking_next_step(self):
        rejected = self.submit(key="reject-request-key")
        request = HelpRequest.objects.get(request_code=rejected.data.get("request_reference"))
        self.client.force_authenticate(self.admin)
        no_reason = self.client.post(f"/api/help-requests/{request.pk}/reject/", {}, format="json")
        self.assertEqual(no_reason.status_code, 400)
        rejected_with_reason = self.client.post(
            f"/api/help-requests/{request.pk}/reject/", {"reason": "Could not verify the location."}, format="json"
        )
        self.assertEqual(rejected_with_reason.status_code, 200, rejected_with_reason.data)
        request.refresh_from_db()
        self.assertEqual(request.verification_status, HelpRequest.VerificationStatus.REJECTED)

        submitted = self.submit(key="clarification-request-key")
        token = submitted.data["tracking_token"]
        clarified = HelpRequest.objects.get(request_code=submitted.data.get("request_reference"))
        asked = self.client.post(
            f"/api/help-requests/{clarified.pk}/clarify/", {"reason": "Please confirm who needs medicine."},
            format="json",
        )
        self.assertEqual(asked.status_code, 200, asked.data)
        response = self.client.post(
            "/api/help-requests/clarification/",
            {"reference": submitted.data["request_reference"], "token": token, "message": "Two people need medicine."},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        clarified.refresh_from_db()
        self.assertEqual(clarified.verification_status, HelpRequest.VerificationStatus.PENDING)
        self.assertEqual(clarified.clarifications.latest("created_at").status, "submitted")
        reviewed = self.client.post(
            f"/api/help-requests/{clarified.pk}/resolve-clarification/",
            {"reason": "Applicant confirmed the medicine request."},
            format="json",
        )
        self.assertEqual(reviewed.status_code, 200, reviewed.data)
        self.assertEqual(reviewed.data["clarifications"][0]["status"], "resolved")


