# SHARA Part 2 API

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

## Still deferred

Team creation and member/leader assignment, public help-request and tracking endpoints, request verification, mission assignment/progress, supplier management, in-app notification APIs, full Bangladesh geography import, and durable image storage remain later migration work. Those unfinished frontend areas continue to show local sample data with an explicit notice.
