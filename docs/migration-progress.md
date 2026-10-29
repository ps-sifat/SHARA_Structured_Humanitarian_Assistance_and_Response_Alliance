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

## Part 3 — Public requests, verification, teams and mission lifecycle: complete

### Backend and SQLite

- Connected public direct/proxy help requests to Django REST Framework. The server validates Bangladesh phone numbers, positive affected-person counts, district/upazila consistency, assistance categories, and required proxy applicant details.
- Added idempotent request creation using an `Idempotency-Key` header and canonical payload fingerprint. The request reference is stable. A private tracking token is HMAC-derived from the server secret, returned on submission/retry, and stored only as SHA-256. Tracking submits the reference and token in the request body and returns a safe status serializer.
- Migrated legacy raw tracking codes to hashes before removing the raw model field. Added clarification history and mission update actions. The Part 3 SQLite migrations are applied to the project database.
- Added Super Admin request queue/detail/review, rejection with reason, clarification request/submission/review-resolution, and eligible-team lookup. PII is kept out of queue, public map, volunteer summaries, and tracking responses.
- Added organization-admin team create/edit, approved-member selection, leader selection, service areas, capabilities and availability. Existing database constraints enforce one active team per volunteer and one active leader per team. Leader/member removal and leader changes are blocked while the team has an active assignment.
- Added deterministic team suitability reasons for area, availability, capabilities, leadership, organization approval, and workload. Only verified requests and active teams in approved organizations can be assigned. A partial unique constraint allows at most one active mission per team and per request.
- Centralized mission transitions and assignment history. Assigned leaders acknowledge, decline, start, add progress, complete, report problems, resolve problems, or report that they cannot continue. Super Admins assign/reassign and cancel/fail with reasons. Active work must be closed through an allowed path before reassignment; prior assignment rows remain in history.
- Added district-level verified-request summaries with a suppression threshold of three. No exact household locations are exposed; the drawn boundaries remain illustrative.

### Frontend

- Replaced demo-backed public request, tracking, map, volunteer request-summary, review queue/detail, team, mission, and dashboard routes with JavaScript/JSX API-backed pages. They reuse the existing SHARA components, color tokens, and layouts.
- Map selection uses current district/upazila IDs to prefill the application. Tracking never places its private token in the URL or browser storage.
- Removed the volunteer “accept request” path. Volunteers can read safe verified summaries; only Super Admins dispatch teams.
- Admin, organization, and volunteer mission/team views read the same API records. Dashboard counters use live queues and missions; persisted changes are available after reload.
- Kept `/volunteer/teams` redirecting to `/volunteer/organizations` and connected `/volunteer/team` to the current team record.

### Verification

| Check | Result |
| --- | --- |
| `python manage.py test tests` | Passed; 49 tests, including the fictional public-to-volunteer/organization/admin workflow and persisted status reads. |
| `python manage.py check` | Passed; no issues reported. |
| `python manage.py makemigrations --check --dry-run` | Passed; no model/migration drift detected. |
| Project SQLite migration state | Both Part 3 migrations applied. |
| `npm run typecheck` | Passed. |
| `npm run build` | Passed; Vite reports the existing main bundle above its 500 kB advisory threshold. |
| `npm test` | Passed; all 13 frontend flow tests. |
| Browser screenshot/network inspection | Not completed; the browser bridge could not determine the current Chrome URL. |

### Remaining limitations and Part 4

- The locations table remains a limited dataset; the map’s district geometry is approximate. Map counts include verified requests and suppress districts with fewer than three.
- The workflow does not send SMS/email, verify ownership of submitted phone numbers, or include a complete abuse-prevention system. Idempotency prevents accidental duplicates; it does not prevent intentional abuse. Production operation needs monitored, layered abuse controls.
- The public homepage overview and supplier/resource workflow remain Part 4 work. SEO review and release packaging also remain deferred.
- Durable profile image storage and a complete Bangladesh geography import remain deferred from earlier migration notes.

No commit or push was made.

See [migration plan](migration-plan.md), [domain rules](domain-rules.md), and [API documentation](api.md) for the model and endpoint contracts. Per the Part 2 request, no commit or push was made.
