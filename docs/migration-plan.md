# SHARA Database Migration Plan

## Existing application

SHARA is a Bengali-first humanitarian response demo for Bangladesh. The frontend is React 19, TypeScript/TSX, Vite, Tailwind CSS v4, and React Router. The repository instructions describe the Figma Make setup and the Vite server already running on port 8443. The app uses React Router's hash router; the migration must preserve those URLs.

### Existing routes and features

| Route | Existing feature |
| --- | --- |
| `/` | Public landing page and response overview |
| `/apply` | Public direct or proxy help request form |
| `/map` | Bangladesh response map and location browsing |
| `/volunteer/register` | Volunteer demo registration |
| `/organization/register` | Organization registration request |
| `/login` | Demo account switcher |
| `/track` | Public request tracking by demo tracking code |
| `/privacy`, `/access-denied` | Privacy information and access-denied page |
| `/volunteer` | Volunteer dashboard |
| `/volunteer/requests` | Requests visible to a volunteer |
| `/volunteer/profile/edit` | Volunteer profile editing |
| `/volunteer/organizations`, `/volunteer/organization`, `/volunteer/team`, `/volunteer/teams` | Organization discovery, membership, and team views; `/volunteer/teams` redirects to `/volunteer/organizations` |
| `/volunteer/missions`, `/volunteer/missions/:id` | Assigned mission list and progress detail |
| `/org` | Organization dashboard |
| `/org/memberships`, `/org/volunteers` | Membership requests and approved volunteers |
| `/org/profile` | Organization profile editing |
| `/org/teams`, `/org/teams/new`, `/org/teams/:id/edit` | Team management |
| `/org/missions`, `/org/missions/:id` | Organization mission oversight |
| `/admin` | Super Admin dashboard |
| `/admin/requests`, `/admin/requests/:id` | Help request review, clarification, and dispatch |
| `/admin/missions`, `/admin/missions/:id` | Mission oversight and reassignment |
| `/admin/organizations` | Organization registration review |
| `/admin/teams` | Team oversight |
| `/admin/suppliers` | Supplier and resource management |

### Current data sources

- `src/app/model.ts` contains the in-memory demo model, seed records, and client-side transition/permission checks.
- `src/app/store.ts` persists that demo model under `shara-demo-v1` in browser `localStorage`; app flows continue to use it during Part 1.
- `src/app/data.ts` contains sample requests, suppliers, aid categories, district/upazila labels, and translations to English.
- `src/app/bdgeo.ts` and `src/app/data.ts` provide bundled geography/map data. The map geography is broader than the initial database seed.
- `src/app/en.json` provides Bengali-to-English UI strings.
- There is no backend or package lock for npm. The existing frontend lockfile is `pnpm-lock.yaml`; preserve it and do not upgrade frontend dependencies for this migration.
- Existing validation scripts are `npm run build`, `npm run typecheck`, `npm test`, and `npm run test:browser` (the browser script is present but may require a running browser environment).

## Proposed model relationships

All persisted records use Django's ORM and timestamp fields. User-facing API serializers will be explicit about writable and exposed fields. The user model is established before its first migration.

- `accounts.User` is the custom Django user with a required normalized Bangladesh phone number, optional unique normalized email, name, password hash, active flag, and Django staff/superuser fields. Super Admin is represented by Django's `is_superuser`; it is never self-registered. `VolunteerProfile` is one-to-one with a user and has many-to-many `Skill` records.
- `locations.District` owns many `Upazila` records. The initial geographic seed is deliberately marked as a subset; the bundled frontend map/geography is not copied as if it were a verified complete database.
- `organizations.Organization` stores registration status, contact/profile fields, service-area relationships, and a required `registered_by` user. `OrganizationAdmin` records the explicit user-to-organization admin relationship granted after Super Admin approval.
- `organizations.MembershipRequest` links a volunteer profile to an organization and records its review decision. `OrganizationMembership` records approved active or historical membership. A volunteer may have at most one active organization membership.
- `teams.Team` belongs to one organization. `TeamMembership` links a volunteer to a team and stores member/leader as a relationship role. A volunteer may have at most one active team membership; active leaders are constrained per team. A team leader is not a global user role.
- `help_requests.HelpRequest` is account-optional and records direct/proxy reporter and affected-person details, location, people count, need categories, privacy-sensitive contacts, and verification status. Verification is independent from mission progress. `AssistanceCategory` is shared with team capabilities.
- `missions.Mission` can have multiple `MissionAssignment` rows, preserving assignment/reassignment history; at most one assignment can be active. `MissionUpdate` records status/progress history and actor. Missions are assigned to teams; only their assigned active team leader may post progress, with Super Admin oversight.
- `suppliers.Supplier` has many `SupplierResource` records.
- `notifications.Notification` belongs to a user and stores in-app delivery/read state. No SMS or email integration is planned.

## Four implementation phases

1. **Database foundation (this Part 1):** inspect and document the demo, add a Django/DRF monolith with all domain apps, a custom user model, schema and initial migrations, admin configuration, development-only fictional seed data, API health endpoint, environment configuration, and Vite API proxy. Keep the React app's routes and local demo behavior unchanged. Add status/permission documentation and validate schema constraints, migrations, seed idempotency, and the existing frontend build.
2. **Identity and membership workflows:** implement session-based login with one email-or-phone identifier and CSRF protection; volunteer registration/profile, accountable organization registration and Super Admin approval, organization admin authorization, membership review, team creation, and approved member/leader assignments. Reject self-registration as Super Admin.
3. **Public requests and missions:** implement account-free direct/proxy request creation and tracking, admin verification/clarification, team assignment and reassignment history, leader progress updates, and Super Admin oversight. Keep request verification and mission progress independent.
4. **Operational data and frontend integration:** integrate suppliers/resources and in-app notifications; migrate frontend flows from demo records to APIs incrementally while preserving Bengali content, existing routes, visual design, accessibility, and responsive behavior. Remove demo-only data from production paths only after feature parity and migration review.

## Unresolved assumptions

- Phone numbers are normalized as Bangladesh E.164 numbers (`+8801…`) using the existing frontend's accepted mobile-number patterns. The number and optional email are identifiers only; ownership is not verified.
- The initial database geography will contain a small named subset drawn from the existing demo, not the full geography source. A verified import and codes/official spellings remain future work.
- Organization registrations and approvals are stored on the Organization record; an explicit `OrganizationAdmin` relationship is activated during approval. Whether organizations may later have multiple administrators remains open, so the relationship model allows a history of assignments.
- Profile images currently use browser data URLs. A durable backend media-storage policy and migration of existing localStorage images are deferred; Part 1 does not change the demo image flow.
- Supplier verification currently exists in the demo Admin workflow, but the responsible role was not explicitly stated in the confirmed rules. Later workflow endpoints should preserve the existing Admin function and confirm the intended permission.
- The existing frontend uses TypeScript despite the migration request's JavaScript/JSX preference. Part 1 does not rewrite those files because that is unrelated to the database foundation; affected frontend TS/TSX migration must be planned and recorded during later API integration.
- Demo organization/account values are intentionally fictional. The seed command is allowed only when Django `DEBUG` is enabled and never creates a Super Admin.

## Frontend preservation requirements

- Preserve the existing Bengali text, font setup, colors, logo, layout, cards, buttons, icons, route paths, hash routing, form behavior, and accessibility/responsive behavior.
- Keep `src/app/store.ts` and current seed/transition behavior active during Part 1 so the existing demo remains usable without Django.
- Do not upgrade React, React Router, Vite, Tailwind, TypeScript, or other npm dependencies. Preserve `pnpm-lock.yaml`.
- Configure only the Vite development proxy for `/api/`; do not replace the router or switch production rendering behavior in Part 1.
