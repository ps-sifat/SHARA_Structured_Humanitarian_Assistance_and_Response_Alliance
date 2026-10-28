# SHARA — Connected frontend demo flows

## Scope

This is an improvement to the existing frontend, not a visual redesign. The Bengali interface, SHARA logo, original forest/leaf/mint palette, fonts, existing button/card/field patterns, React 19, Vite, Tailwind v4 and hash router remain. The existing map geometry, zoom, markers, selection and demo error/loading/empty states remain.

The pre-edit findings and classifications are in [UX_AUDIT.md](UX_AUDIT.md).

### Bengali and English

- A Bengali/English selector appears at the top of public pages and each role's dashboard.
- Bengali remains the default. The selected language updates the interface immediately, including navigation, forms, validation, map controls, tracking, status labels, dialogs and dashboard actions.
- The choice is stored separately under `shara-language`, survives refresh and navigation, and synchronizes between tabs. Switching still works for the current session if storage is unavailable.
- Switching does not remount forms, reset the demo or translate stored records. Canonical district, upazila, aid and skill option values remain unchanged; names and free-text submissions remain in their original language.
- Area searches accept both Bengali and English names. English mode uses English date formatting and Latin digits for display.
- `src/app/en.json` is the static translation catalog; `locale.ts` handles translation and browser-local language state; `i18n.ts` exposes the React subscription.
- Language coverage is included in the existing `pnpm test` and `pnpm test:browser` commands.

### Follow-up audit: existing flows retained

The current code was re-audited rather than rebuilt. Role navigation, the shared localStorage store, direct/proxy forms, map prefilling, tracking, membership, team creation, dispatch, suppliers, profile editing and ownership guards already existed and were kept.

Focused refinements:

- The public menu now includes the existing help-application action, so it remains available inside the open menu.
- Volunteer request summaries reuse the accessible dialog instead of opening above the visible card list. Area filters remain in the URL, and closing the dialog restores focus.
- Resolving a mission problem returns to the stage where it occurred. An unacknowledged assignment cannot jump to ongoing. Recovery requires a note, and the progress display preserves the actual last stage. Cancelled/failed missions have no active progress step.
- Organization profile changes cannot remove an operating area still used by one of its teams; the edit dialog explains the existing team-area rule.
- Tracking feedback clears when the reference or code changes.
- Pending organization status works at both `/org` and `/org/`, without granting operational permissions.
- No new routes, backend, runtime dependencies, theme changes or map changes were needed for this follow-up.

## Shared data

- `src/app/model.ts`: typed records, seed relationships, status selectors, eligibility, ownership and transition rules.
- `src/app/store.ts`: subscribed React state with versioned localStorage (`shara-demo-v1`) and storage-error feedback.
- `src/app/data.ts`: geographical options and legacy fictional records used only to initialize the demo. UI pages read operational records from the store, not separate local arrays.
- No backend, auth provider, API, password storage, dependency on a new UI system or change to the color tokens.
- Demo accounts, registrations, organization verification, membership decisions, team rosters, request review, dispatch, mission updates, profiles, suppliers and resources persist in the same browser.
- Demo controls expose account switching, a developer page index and a confirmed reset action separately from normal navigation.

## Navigation

### Public

| Route | Purpose |
|---|---|
| `/` | Existing homepage, help as primary action, tracking and map actions, nonduplicated registration CTAs |
| `/apply` | Existing direct/proxy help application; map-prefilled district/upazila |
| `/map` | Existing approximate demo map |
| `/track` | Reference plus simulated private code; safe progress and update time |
| `/volunteer/register` | Volunteer registration, optional **membership request**, not instant membership |
| `/organization/register` | Organization registration and linked accountable demo administrator |
| `/login` | Explicit demo account chooser, not silent dashboard login |
| `/privacy` | Frontend demo data and security explanation |
| `/access-denied` | Role mismatch with return to own portal |

Hash URLs are `/#/route`. Public users do not need an account to submit or track a request.

### Volunteer

| Route | Purpose |
|---|---|
| `/volunteer` | State-dependent next action and shared profile summary |
| `/volunteer/missions` | Current and historical missions for the volunteer's team |
| `/volunteer/missions/:id` | Shared mission detail; assigned members read, assigned leader acts |
| `/volunteer/organization` | Own membership requests, approval/rejection and next step |
| `/volunteer/organizations` | Organization discovery, search and duplicate-safe membership requests |
| `/volunteer/teams` | Legacy URL redirected to organization discovery |
| `/volunteer/team` | Distinct small-team assignment, leader, members, areas and capabilities |
| `/volunteer/requests` | Area-filtered privacy-safe cards; view summary only |
| `/volunteer/profile/edit` | Existing editing task connected to all profile summaries |

The volunteer dashboard chooses its primary action from: discover organization → view pending request → await team assignment → view team → view active mission.

### Organization administrator

| Route | Purpose |
|---|---|
| `/org` | Short overview, pending status and next actions |
| `/org/memberships` | Membership request review, approval and reasoned rejection |
| `/org/volunteers` | Approved members and team eligibility; reasoned removal where permitted |
| `/org/teams` | Own small teams and availability |
| `/org/teams/new` | Working team creation form |
| `/org/teams/:id/edit` | Shared team details/edit form; active rosters locked |
| `/org/missions` | Own organization's missions only |
| `/org/missions/:id` | Shared read-only monitoring detail |
| `/org/profile` | Existing short organization profile dialog, with persisted changes |

Pending or rejected organization applicants can see registration status and their profile, but not verified operational screens.

### Super administrator

| Route | Purpose |
|---|---|
| `/admin` | Priority overview: review queue, dispatch queue, acknowledgement, problems, organization verification |
| `/admin/requests` | Search and filters kept in URL |
| `/admin/requests/:id` | Review, protected contact reveal, clarification/rejection, eligible-team dispatch and assignment history |
| `/admin/missions` | All missions and history |
| `/admin/missions/:id` | Shared detail, cancel/fail and return to reassignment context |
| `/admin/organizations` | Registration-linked verification queue, administrator/contact review |
| `/admin/teams` | Teams, organization, capability, area and workload overview |
| `/admin/suppliers` | Existing supplier/resource browsing with functional add dialogs |

## Connected journeys

### Help application

1. Select map area (optional) → application receives district/upazila query values.
2. Existing direct/proxy validation preserves entered fields on errors.
3. Submit → unique reference and demo tracking code saved.
4. Confirmation says **received, not assigned**.
5. The same record appears in the admin queue.
6. Verify, reject or request clarification → tracking progress changes. A holder of the simulated tracking code can send additional non-contact information for a clarification request, returning it to review.
7. Verified request → eligible team confirmation → mission record.

### Organization

1. Registration captures organization fields plus responsible demo administrator name.
2. The linked account initially has pending-only access.
3. The submitted record appears in the admin verification queue.
4. Approval changes the directory and operational access.
5. Profile edits are reflected wherever the organization is displayed.

### Volunteer membership and team

1. Registration creates a demo volunteer account.
2. Optional organization choice creates a pending request only.
3. Discovery prevents another pending/approved request.
4. Organization approves/rejects; the volunteer's status changes immediately.
5. Approved members become eligible for team creation.
6. Organization selects members, a leader from those members, areas, availability and aid capabilities.
7. The volunteer's team view and dashboard use that roster.

### Team dispatch and mission

1. Only verified requests may be dispatched.
2. Eligibility explains organization verification, matching area, relevant aid capabilities, readiness, valid approved members/leader and active workload.
3. No suitable team produces an explicit waiting state.
4. Confirmation creates one active mission for the request.
5. The assigned team leader acknowledges → starts → updates progress or reports a problem → completes with a note.
6. Team members and organization admins monitor but cannot perform leader actions.
7. Admin can cancel/fail with a reason, then reassign from the request context.
8. Previous assignments and status history are retained; duplicate active/completed dispatch is blocked.
9. Tracking and all relevant dashboards derive their status from the same mission records.

## Interaction and permission details

- Individual volunteer request acceptance was removed; browsing does not create missions.
- Public request cards and tracking exclude private names/phones and free-text operational descriptions.
- Request contact information remains in admin-only views.
- Role layout guards redirect to demo login/access-denied.
- Mission details check the current team/organization relationship, not just the URL.
- Store transitions repeat ownership/role checks so hidden buttons are not the only guard.
- Active mission rosters cannot be edited; approved organization membership is required for every team member.
- One current approved organization and one small team per volunteer; one active mission per team. These are explicitly labelled demo constraints.
- Rejected memberships remain visible and may be reapplied for; duplicate pending/approved records are blocked.
- Long forms remain forms, short decisions remain confirmations, and existing profile editing remains a dialog.
- Dialogs render outside headers, lock page scroll, wrap keyboard focus, close with Escape and restore trigger focus.
- URL filters survive returning from request details; back/cancel links point to predictable lists.

## Verification commands

```sh
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

`pnpm test` runs pure domain-flow and permission tests with Node's built-in test runner and the already-installed TypeScript compiler.

Optional browser suite against the **already-running** preview:

```sh
PLAYWRIGHT_MODULE=/path/to/installed/playwright \
SHARA_PREVIEW_URL=http://localhost:3000 \
pnpm test:browser
```

Playwright is a test-environment dependency, not an added application dependency. The suite uses installed Chromium and never starts another development server.

Browser coverage includes map prefilling, submission/tracking, admin review/dispatch, leader versus member/organization permissions, completion/refresh, organization registration/verification, volunteer membership/team/profile, legacy redirect, suppliers/resources, mobile overflow and menu focus/Escape.

### Recorded results

- `pnpm typecheck`: passed.
- `pnpm test`: all 10 tests passed, including translation, bilingual search, language switching without record changes, clarification-code checks, duplicate prevention, ownership, active roster locks, reassignment history, stage-aware problem recovery and organization/team area consistency.
- `PLAYWRIGHT_MODULE=/tmp/shara-browser/node_modules/playwright pnpm test:browser`: passed against the host-supervised preview.
- `pnpm build`: passed; the existing large-chunk warning remains.
- `git diff --check`: passed.
- Mobile menu verified at 390 × 844 with viewport bounds, Tab wrapping, Escape, restored trigger focus and no horizontal overflow.
- No application runtime errors were recorded during browser journeys.
- The expanded browser suite also covers clarification feedback reset, problem recovery before acknowledgement, request-summary dialog focus, the public menu's help action and pending-organization trailing-slash navigation.
- Original Hind Siliguri and Noto Serif Bengali font loading and the menu appearance were separately verified in Chromium with test-environment certificate handling; application font wiring was not changed.
- No standalone lint command exists in the repository.

## Remaining limitations

- This is intentionally a frontend-only demo. Client guards, demo login and tracking codes are **not production authentication, authorization or secure storage**.
- localStorage is readable/editable by anyone with access to the browser. Only fictional information is appropriate. It is not a multi-user backend.
- No real email, SMS, geolocation, rescue dispatch or background notifications are sent.
- The map's approximate geometry and flood/request overlay remain a separately labelled geographic simulation, not a live operational or flood feed.
- Availability and workload rules are simplified demo rules, not an emergency-routing algorithm.
- The current geographic option list is a subset of Bangladesh, not a complete official district/upazila registry.
- There is no lint configuration/script in the project. TypeScript, domain tests, browser journeys, formatting and Vite build are the available checks.
- Vite's existing large-bundle warning is not addressed by this UX-flow change.
- The installed `oxfmt` 0.2 formatter was run, but it removed separators from compact TypeScript object types and parentheses from a nested readonly type. Those declarations were repaired; TypeScript, tests and Vite are used to verify the final source. Do not blindly rerun this formatter across these declarations without typechecking afterward.
