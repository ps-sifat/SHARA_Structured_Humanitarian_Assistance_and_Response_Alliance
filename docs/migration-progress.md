# SHARA Migration Progress

## Part 1 — Django and database foundation: complete

The Django project and all eight domain apps are in `backend/`. `accounts.User` is the custom user model configured before its initial migration. SQLite migrations, admin inspection, environment-driven settings, a development-only fictional seed command, `/api/health/`, and a Vite `/api/` proxy are present.

The schema covers users and volunteer profiles/skills, a deliberately limited district/upazila subset, organizations and explicit organization-admin relationships, organization membership history, team relationships, public help requests, mission and assignment history, suppliers/resources, and in-app notifications. Database constraints preserve membership and assignment uniqueness. Transactional services implement organization approval, organization membership approval, team assignment, mission assignment/reassignment, and leader progress. No complete Bangladesh geography import, SMS/email delivery, or usable demo credentials were created.

## Part 2 — Authentication, profiles, organization registration and membership: complete

### Backend

- Added `IdentifierBackend`, accepting one email-or-phone identifier. Bangladesh phone normalization handles Bengali digits, local and `+880` forms, and common punctuation. Email is case-normalized. Duplicate identifiers are rejected; passwords use Django hashing and configured password validators. Invalid, missing, and inactive login accounts receive the same generic error.
- Added CSRF-cookie, registration, login, logout, current-user, password-change, and current-volunteer-profile endpoints. Unsafe auth requests require CSRF. DRF uses Django `SessionAuthentication`; session cookies are HTTP-only, same-site, and secure outside development. No token auth or CORS setup was added.
- Registration creates the user and volunteer profile without accepting role, ownership, or admin fields. Profile updates validate normalized uniqueness and the current district/upazila relationship; the profile endpoint addresses only the signed-in user.
- Added database-backed district and skill option endpoints.
- Added public discovery for active, approved organizations; signed-in organization registration tied to `request.user`; applicant-only status/history; and Super Admin-only review. Approval atomically updates verification and grants the linked applicant an `OrganizationAdmin` relationship. Rejection requires and stores a reason.
- Added membership request, withdrawal, decision, and history endpoints. Organization admins can see and decide requests only for their own organizations. Volunteers can see and withdraw only their own requests. Approval is transactional; a unique database constraint enforces one active organization membership, and other pending requests are closed after approval.
- Expanded API and service tests for CSRF, normalized email/phone login, inactive accounts, password changes, profile ownership, location validation, organization review permissions, membership workflows, privacy fields, and conflicts.

### Frontend

- Added a same-origin API client with `credentials: "include"` and CSRF headers; no password, session cookie, or auth token is stored in `localStorage`.
- Replaced the demo login route with credential login and safe internal return handling. The server current-user response drives volunteer, organization-admin, and Super Admin route guards. Multi-workspace accounts can switch only among server-authorized workspaces.
- Connected volunteer registration, profile editing, password change, organization discovery/registration/status, organization profile, membership review, and Super Admin registration review to API data. API errors display explicitly; these pages do not fall back to demo records.
- Preserved the hash routes and existing color/typography tokens. Part 2 screens/API code are JavaScript/JSX; the original scaffold still has TypeScript/TSX modules.
- Removed the demo account impersonation login. Legacy demo state is still used for unfinished workflows, but persisted mock account selection is cleared and is no longer used as an auth session. Public request/map pages and unfinished portal routes display a sample-data notice. Organization registration drafts use tab-scoped `sessionStorage` if the user needs to sign in; it contains no credentials.

### Validation

| Check | Result |
| --- | --- |
| `python manage.py test tests --verbosity 1` with `DJANGO_DEBUG=true` | Passed; 30 tests, including 17 Part 2 API tests. |
| `python manage.py check` | Passed; no issues reported. |
| `python manage.py makemigrations --check --dry-run` | Passed; no new model migration is required for Part 2. |
| `npm run typecheck` | Passed. |
| `npm run build` | Passed; 2,004 modules transformed. Vite reports a 718.53 kB main JS chunk above its 500 kB warning threshold. |
| `npm test` | Passed; all 13 existing frontend flow tests. |

## Part 3 starting point

Do not recreate Parts 1 or 2. Start from the current API/session boundary and implement team creation, editing, and organization-scoped member/leader assignments using the existing `Team`/`TeamMembership` models and constraints. Then connect the matching organization team screens and volunteer team views. Team leaders remain relationship-based, not a global user role. Keep `/volunteer/teams` redirecting to `/volunteer/organizations` unless the route is deliberately repurposed with a redirect.

## Later work still deferred

- Public direct/proxy help-request creation and tracking, request review/clarification, mission assignment/reassignment, leader progress, and Super Admin mission oversight.
- Supplier/resource and in-app notification APIs and their frontend integration.
- Complete verified Bangladesh geography import and durable image storage. Current organization/profile workflow screens do not upload profile images to Django.
- Some homepage metrics, public request/map/tracking screens, and unfinished team/mission/supplier/admin screens still read local sample data; those screens show a sample-data notice.

See [migration plan](migration-plan.md), [domain rules](domain-rules.md), and [API documentation](api.md) for the model and endpoint contracts. Per the Part 2 request, no commit or push was made.
