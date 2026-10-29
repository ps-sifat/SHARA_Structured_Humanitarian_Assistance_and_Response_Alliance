# SHARA API — Parts 2 and 3

All endpoints are under `/api/`. The browser uses the same origin and the Vite development proxy forwards `/api/` to Django. Authentication uses Django's session cookie; there are no bearer tokens.

## Session and CSRF

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/auth/csrf/` | Public | Sets the CSRF cookie and returns a CSRF token. |
| `POST` | `/api/auth/register/` | CSRF required | Creates a volunteer account and profile, then starts a session. |
| `POST` | `/api/auth/login/` | CSRF required | Signs in with `identifier` and `password`. `identifier` accepts normalized email or Bangladesh phone input. |
| `POST` | `/api/auth/logout/` | CSRF required | Ends the current session. |
| `GET` | `/api/auth/me/` | Public | Returns `{ "user": null }` or the current user and authorized workspaces. |
| `POST` | `/api/auth/password/` | Signed-in user, CSRF required | Changes the password with `current_password` and `new_password`. |

The frontend calls `/api/auth/csrf/` before unsafe requests, reads the `csrftoken` cookie, and sends `X-CSRFToken` with the request. Django also checks CSRF on authenticated `SessionAuthentication` requests. The session cookie is HTTP-only, same-site, and secure outside development. Passwords, session cookies, and auth tokens are not written to browser storage.

Registration accepts `name`, `phone_number`, optional `email`, `password`, `district`, `upazila`, `service_upazilas`, `skills`, `availability`, `vehicle_access`, and `swimming_capability`. The server normalizes identifiers, validates password policy and the district/upazila pair, hashes the password, and creates the volunteer profile in one transaction. Client-supplied role or owner fields are ignored.

The current-user response contains `is_super_admin`, `is_volunteer`, `is_organization_admin`, `organizations`, `organization_applications`, and authorized `workspaces`. Super Admin comes only from Django `is_superuser`; organization workspaces come only from active `OrganizationAdmin` relationships.

## Profile and form options

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET`, `PATCH` | `/api/profile/` | Signed-in user | Read or update only the current user's volunteer profile and account contact identifiers. |
| `GET` | `/api/locations/districts/` | Public | Database-backed district and upazila options. |
| `GET` | `/api/skills/` | Public | Active skill options. |

The profile endpoint has no user ID parameter, so callers cannot select another account's profile. Phone and email changes are normalized and checked for uniqueness. The server validates that the selected current upazila belongs to the selected district.

## Organizations

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/organizations/` | Public | Discover active, approved organizations only. |
| `POST` | `/api/organizations/` | Signed-in user, CSRF required | Submit a pending registration linked to the current user. |
| `GET` | `/api/organizations/mine/` | Signed-in user | Read the user's own applications and organization-admin workspaces. |
| `GET` | `/api/organizations/{id}/` | Public for approved organizations | Read a verified organization's public profile. |
| `PATCH` | `/api/organizations/{id}/` | That organization's active admin | Update allowed profile/contact fields. Identity, owner, review, and verification fields are read-only. |
| `GET` | `/api/organizations/review-queue/` | Active Super Admin | List pending registrations. |
| `POST` | `/api/organizations/{id}/approve/` | Active Super Admin, CSRF required | Atomically approve and grant the linked applicant organization-admin access. |
| `POST` | `/api/organizations/{id}/reject/` | Active Super Admin, CSRF required | Reject a pending registration with a required `reason`. |

`POST /api/organizations/` accepts `name`, `description`, `organization_type`, `contact_email`, `contact_phone`, optional office location IDs, `service_districts`, and `service_upazilas`. The applicant is always `request.user`; status, owner, and admin relationships cannot be supplied by the client. Pending and rejected registrations are visible to their applicant through `/mine/` and cannot be retrieved through the public organization detail endpoint.

## Organization membership

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/organizations/{id}/membership-requests/` | Signed-in volunteer, CSRF required | Request membership in an active, approved organization. Optional body: `request_note`. |
| `GET` | `/api/membership-requests/mine/` | Signed-in volunteer | Read only the current volunteer's request history. |
| `POST` | `/api/membership-requests/{id}/withdraw/` | Request owner, CSRF required | Withdraw an owned pending request. |
| `GET` | `/api/organizations/{id}/membership-requests/` | That organization's active admin | Review requests scoped to the selected organization. |
| `POST` | `/api/membership-requests/{id}/approve/` | That organization's active admin, CSRF required | Approve a pending request and create an active membership. |
| `POST` | `/api/membership-requests/{id}/reject/` | That organization's active admin, CSRF required | Reject a pending request with a required `reason`. |
| `GET` | `/api/organizations/{id}/memberships/` | That organization's active admin | Read its membership history. |
| `GET` | `/api/memberships/mine/` | Signed-in volunteer | Read the current volunteer's membership history. |

Approvals run transactionally. The database permits at most one active organization membership per volunteer. After approval, any other pending requests for that volunteer are closed as rejected with a recorded explanation. Duplicate pending requests are prevented by both API validation and a database constraint. A Super Admin without an active admin relationship for that organization cannot review its membership requests.

## Errors and authorization

Validation failures return HTTP `400` with field errors or `detail`. Invalid credentials use the same generic message whether the account is missing, inactive, or the password is wrong. Anonymous access to protected APIs is rejected; requests for objects outside a volunteer's or organization's scope return no record or a permission error. Frontend route guards mirror these checks for navigation, while Django permissions and scoped querysets enforce access on the server.

## Public locations, categories and map summary

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/locations/districts/` | Public | Current database-backed districts and their upazilas. |
| `GET` | `/api/help-requests/assistance-categories/` | Public | Active assistance categories used by the application form. |
| `GET` | `/api/map/summary/` | Public | Verified request counts by district, generalized for privacy. |

Map summaries never return household coordinates or upazila counts. A district with at least three verified requests returns the aggregate count; smaller groups return `verified_requests: null` and `count_label: "not_reported"`. The current location dataset is a limited subset and the drawn district boundaries are illustrative.

## Help requests and review

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/help-requests/` | Public or signed-in user, CSRF if authenticated | Create a direct/proxy request. Requires an `Idempotency-Key` header (8–128 characters). |
| `GET` | `/api/help-requests/` | Active Super Admin | Safe review queue; supports `?verification=pending`, `verified`, `clarification`, or `rejected`. No contact PII is returned. |
| `GET` | `/api/help-requests/{id}/` | Active Super Admin | Protected request detail with names, contact numbers, review history, and mission ID/status. |
| `POST` | `/api/help-requests/track/` | Public | Private tracking lookup with JSON `{ "reference": "…", "token": "…" }`. |
| `POST` | `/api/help-requests/clarification/` | Public | Submit applicant clarification using `{ "reference": "…", "token": "…", "message": "…" }`. |
| `GET` | `/api/help-requests/safe-open/` | Signed-in volunteer | Safe summaries of verified requests awaiting assignment. No accept/claim action exists. |
| `POST` | `/api/help-requests/{id}/verify/` | Active Super Admin | Verify a pending request and create its awaiting-assignment mission. |
| `POST` | `/api/help-requests/{id}/reject/` | Active Super Admin | Reject a pending request with `{ "reason": "…" }`. |
| `POST` | `/api/help-requests/{id}/clarify/` | Active Super Admin | Ask for clarification with `{ "reason": "…" }`. |
| `POST` | `/api/help-requests/{id}/resolve-clarification/` | Active Super Admin | Mark a submitted clarification reviewed with `{ "reason": "…" }`; the request returns to pending review. |
| `GET` | `/api/help-requests/{id}/eligible-teams/` | Active Super Admin | List teams eligible for this verified request with a deterministic score and match reasons. |

Create body fields are `reporter_type` (`direct` or `proxy`), `affected_person_name`, `contact_phone`, optional `reporter_name`/`reporter_phone`/`relation_to_affected`, `district`, `upazila`, `people_affected`, `assistance_categories` (one or more category IDs), optional `description`, and optional `risks`. Proxy requests require applicant name, applicant phone, and relationship. The server checks the district/upazila pair, Bangladesh phone values, and `people_affected >= 1`.

Creation returns `request_reference`, the private `tracking_token`, verification status and generalized district/upazila labels. The token is generated server-side using HMAC-SHA256 with `SECRET_KEY`, the idempotency key and request reference, while only its SHA-256 hash is stored. Repeating a key with the same canonical payload returns the same reference and token; reusing it with changed details returns HTTP `409`. Invalid reference/token pairs receive a generic not-found response. The private token must not be placed in a URL, browser storage, logs, map data, or volunteer summaries.

Tracking returns only request reference, district/upazila, people affected, assistance categories, verification status, mission status, a currently requested clarification note, and timestamps. It does not return names, phone numbers, descriptions, internal review notes, or team details. Verification and mission status remain separate fields.

## Teams and memberships

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/teams/` | Active organization admin or Super Admin | List scoped teams; organization admins may pass `?organization={id}`. |
| `POST` | `/api/teams/` | Active admin of the selected approved organization | Create a team. |
| `GET` | `/api/teams/{id}/` | Scoped organization admin, Super Admin, or current team member | Read team details and safe active member summaries. |
| `PATCH` | `/api/teams/{id}/` | Active admin of that team’s organization | Edit team details, availability, capabilities, and operating areas. Teams cannot move organizations. |
| `GET` | `/api/teams/mine/` | Signed-in volunteer | Read the current volunteer’s one active team, if any. |
| `GET` | `/api/teams/eligible-members/?organization={id}` | Active admin of that organization | List active organization members not already on a team. Names only; no phone fields. |
| `GET`, `POST` | `/api/teams/{id}/members/` | Scoped read; active organization admin for add | Read active members or add `{ "volunteer": profile_id, "role": "member" }`. |
| `POST` | `/api/teams/{id}/set-leader/` | Active organization admin | Select an active team member with `{ "volunteer": profile_id }`. |
| `POST` | `/api/team-memberships/{id}/remove/` | Active admin of the membership’s organization | End membership while retaining history. |

Teams require an active, approved organization. Members must be active volunteers with an active membership in that organization. Database constraints enforce one active team per volunteer and at most one active leader per team. Leader changes or removals are rejected while the team has an active mission; reassign or close the mission first.

## Missions and transitions

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/missions/` | Super Admin, assigned organization admin, or active member of an assigned team | List scoped missions; supports `?status=active`, `history`, or an exact status. |
| `GET` | `/api/missions/{id}/` | Same scoped access | Read safe request summary, authorized assignment history, updates, and leader-action capability. |
| `POST` | `/api/missions/{id}/transition/` | Active Super Admin or the leader captured on the active assignment, depending on action | Apply one centralized transition and return the refreshed mission. |

Use `{ "action": "assign", "team_id": 42, "reason": "…" }` to assign/reassign. Other action values are `acknowledge`, `decline`, `start`, `progress`, `complete`, `report_problem`, `unable_to_continue`, `resolve_problem`, `cancel`, and `fail`. A reason/progress/completion note is required for `decline`, `progress`, `complete`, `report_problem`, `unable_to_continue`, `resolve_problem`, `cancel`, and `fail`. Only the assigned team leader can acknowledge or report progress; only Super Admin can assign, cancel, or fail.

The normal state path is `awaiting_assignment → assigned → acknowledged → ongoing → done`. Decline or inability to continue closes the active assignment and returns the mission to `awaiting_assignment`. A reported problem can be resolved back to its previous normal stage. Super Admin cancellation/failure closes the assignment. Reassignment is allowed from `awaiting_assignment` or `failed`, retains the old assignment row, and records the actor, time, action, and reason. Completed and cancelled missions cannot be reassigned. Database constraints enforce at most one active assignment per mission and one active mission per team.

Eligibility uses deterministic rules: exact upazila or district service area, team availability, overlap between requested categories and team capabilities, an active leader who remains an organization member, no other active mission, and an active approved organization. The API returns a numeric score and human-readable reasons; these are rules-based matches, not AI predictions. If none qualify, the mission stays awaiting assignment.

## Remaining Part 4 work

Supplier/resource and in-app notification APIs, full verified Bangladesh geography data, durable image storage, the public homepage overview, final SEO review, and release packaging remain deferred. No SMS/email delivery or complete abuse-prevention system is implemented; idempotency prevents accidental duplicate submits but is not an anti-abuse system.
