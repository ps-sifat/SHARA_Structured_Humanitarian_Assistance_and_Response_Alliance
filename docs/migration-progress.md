# SHARA Migration Progress

## Part 1 — Django and database foundation: complete

The initial Django project and all eight requested domain apps are in `backend/`. `accounts.User` is the custom user model configured before the first database migration. The initial migrations are present for accounts, locations, organizations, teams, help requests, missions, suppliers, and notifications.

Added:

- Custom user with normalized unique Bangladesh phone number, optional case-normalized unique email, Django password hashing, account status, and Django admin fields. Phone/email are identifiers only; ownership is not verified.
- Volunteer profiles and skills; district/upazila relationships marked as a demo subset; organizations with a required registration owner and explicit organization-admin history; pending/approved/rejected membership workflow models; team membership history with relationship-based leaders; public direct/proxy requests; separate verification and mission states; mission assignment/update history; suppliers/resources; and in-app notifications.
- SQLite conditional unique constraints for active memberships, pending membership requests, active team leader, active mission assignment, and active team assignment.
- Small transactional services for organization approval, organization membership approval, team membership assignment, mission assignment/reassignment, and leader progress updates. No workflow HTTP APIs or frontend API integration were added.
- Explicit serializers and permission classes, Django admin inspection, `/api/health/`, environment-driven settings, `.env.example`, a development-only idempotent `seed_demo` command, and a Vite development proxy for `/api/`.
- `docs/migration-plan.md` and `docs/domain-rules.md` document the current app, model relationships, phases, preserved UI requirements, status transitions, and permission rules.

Demo seed records are fictional and limited to two explicitly marked district/upazila subsets. They cover users/profiles/skills, a pending organization and membership request, direct and proxy help requests, categories, a supplier/resource, and an in-app notification. The command refuses to run unless `DJANGO_DEBUG` is enabled, creates accounts with unusable passwords, and does not create a Super Admin or delivery integration.

## Validation

| Check | Result |
| --- | --- |
| `python manage.py check` with `DJANGO_DEBUG=true` | Passed; no issues reported. |
| `python manage.py makemigrations --check --dry-run` | Passed; no model changes missing from migrations. |
| `python manage.py migrate --noinput` on a new temporary SQLite database | Passed; all Django and SHARA migrations applied. |
| `python manage.py seed_demo` twice on that clean database | Passed; both runs completed and the Django test asserts row counts stay stable. |
| `python manage.py test tests -v 1` | Passed; 13 tests cover normalized identifiers, SQLite constraints/history, services, health endpoint, and seed safety/idempotency. |
| `npm run build` | Passed; 2,000 modules transformed. Vite reported the main JS chunk is 701.31 kB, above its 500 kB warning threshold. |
| `corepack pnpm@10.34.3 install --frozen-lockfile` | Passed from the repository-pinned pnpm version; lockfile was up to date and no frontend dependency versions were changed. |

The frontend's localStorage demo behavior, routes, colors, Bengali content, fonts, and components remain intact. Only `vite.config.ts` changed on the frontend side, adding the development proxy. No TypeScript files were converted because Part 1 does not alter UI components or application flows.

Remaining TypeScript files:

- Entrypoints: `src/App.tsx`, `src/main.tsx`, `src/vite-env.d.ts`.
- Application: `src/app/Admin.tsx`, `src/app/Apply.tsx`, `src/app/BangladeshMap.tsx`, `src/app/HelpRequests.tsx`, `src/app/Home.tsx`, `src/app/MapPage.tsx`, `src/app/Missions.tsx`, `src/app/Org.tsx`, `src/app/OrgManagement.tsx`, `src/app/ProfileImage.tsx`, `src/app/PublicFlow.tsx`, `src/app/Volunteer.tsx`, `src/app/i18n.ts`, `src/app/layouts.tsx`, `src/app/locale.ts`, `src/app/model.ts`, `src/app/profile-image.ts`, `src/app/routes.tsx`, `src/app/store.ts`, `src/app/ui.tsx`, `src/app/geo.ts`, `src/app/data.ts`, `src/app/bdgeo.ts`.
- Existing project configuration: `vite.config.ts` and `tsconfig.json`.

The workspace does not contain `.git`, so Git status/diff could not be read and no commit was created. The existing `pnpm-lock.yaml` remains the frontend lockfile.

## Exact starting point for Part 2

1. Keep `AUTH_USER_MODEL = "accounts.User"` and the initial migrations; the custom user must not be replaced after migration. Create a real local Super Admin through Django's `createsuperuser` command.
2. Add a Django authentication backend that accepts one `identifier` value, normalizes phone input, and also matches the optional normalized email. `USERNAME_FIELD` is currently `phone_number`, so the default backend alone does not provide email login.
3. Add session login/logout/current-user and CSRF-cookie endpoints. Enable DRF `SessionAuthentication` and retain CSRF checks. Part 1 currently configures no DRF authentication classes and defaults protected API views to `IsAuthenticated`.
4. Connect the existing `/login`, volunteer registration, and organization registration views to these endpoints while preserving the current hash routes and local demo fallback until parity is reviewed. Organization registration must bind to `request.user`; approval must call `approve_organization_registration` so only a Super Admin approval grants the linked user's organization-admin relationship.
5. Add organization-admin-scoped membership and team endpoints using the existing transactional services and permissions. Do not add a global team-leader role.

No commit was made. Suggested commit message: `chore: add Django foundation and SHARA data models`.
