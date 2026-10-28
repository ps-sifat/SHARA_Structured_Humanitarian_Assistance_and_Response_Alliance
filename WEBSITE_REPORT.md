# SHARA Website — Current Pages, Navigation and Workflows

> Current repository-based report, including Bengali/English support, the language selector inside the public navbar, and the compact mobile language dialog. This replaces the historical pre-integration snapshot. Source was reviewed; this documentation refresh does not claim a new live-site, accessibility, performance or browser-test pass.

Related documents: [UX_AUDIT.md](UX_AUDIT.md) contains current findings and resolved historical issues; [FLOW_IMPLEMENTATION.md](FLOW_IMPLEMENTATION.md) describes implementation decisions and previously recorded checks.

## 1. Product overview

SHARA means **Structured Humanitarian Assistance and Response Alliance**. It is a Bangladesh-focused humanitarian assistance **frontend demonstration** with four user areas:

1. Public users submit direct or proxy help requests without accounts.
2. Volunteers register, request organization membership, view their team and follow team missions.
3. Organization administrators approve memberships, manage approved-member teams and monitor missions.
4. Super administrators verify requests/organizations, assign eligible teams, manage reassignment and add suppliers/resources.

Missions belong to **teams**, not individual volunteers. Only the assigned team leader acknowledges, starts, updates, reports problems or completes a mission. Other members and organization administrators monitor. Super admins can cancel/fail missions but do not perform leader progress actions.

| Area | Current implementation |
|---|---|
| Frontend | React 19 and TypeScript |
| Routing | React Router `createHashRouter` |
| Build/styles | Vite and Tailwind CSS v4 |
| Icons/components | Lucide React and existing local `src/app/ui.tsx` primitives |
| Typography | Hind Siliguri and Noto Serif Bengali, with existing fallbacks |
| Brand | Existing SHARA logo and forest/leaf/mint palette; red help CTA |
| Languages | Bengali default, plus English interface translations |
| State | Shared subscribed state with browser-local persistence |

No backend, database, production authentication provider, real dispatch integration or notification service is connected. The existing map, branding and frontend stack remain.

## 2. Navigation and language controls

### Public navbar

- The logo links Home; wide desktop navigation includes Home, Flood situation and Track a request.
- Language selection sits **inside the navbar** beside existing actions. There is no separate language strip above it.
- From the `sm` breakpoint upward, Bengali/English buttons are visible; demo login also appears inline.
- Below `sm`, a compact language icon opens the shared dialog. Its two language options indicate selection; choosing one updates the interface and closes the dialog.
- The help-application action and public-menu button remain available. The public menu includes Home, help application, flood situation, tracking, volunteer registration, organization registration and demo login.
- Layout permits narrow-screen wrapping; a single row at every width is not guaranteed.

Tailwind's default `sm` is 640 pixels; inline public navigation uses `xl` (1280 pixels). Mobile navigation and language selection use separate dialogs.

### Role navigation and demo controls

Each portal has a role-specific sidebar on large screens and a horizontally scrollable role menu on smaller screens. Its existing full language selector remains unchanged, including on mobile; only the public navbar uses the compact language control.

Account switching, developer page links and confirmed sample-data reset are under **Demo controls**, not ordinary navigation. Role layouts also provide Public Home and Log out.

### Language behavior

- The interface updates without replacing the route or remounting the active form.
- `shara-language` stores the preference separately from operational records. Refresh/navigation retain it; same-origin tabs synchronize changes.
- Switching still works for the current session if preference storage is blocked.
- Document `lang` follows the selection; option buttons declare their languages and pressed state.
- Common interface labels, instructions, statuses, feedback, map controls, dialogs and role actions have translation wiring. English mode uses English date formatting and Latin digits for translated display text.
- Geographic search accepts Bengali/English names. Canonical district/upazila/aid/skill values stay unchanged.
- The catalog is static, not an automatic translation service. Stored records are not rewritten. Some displayed user-authored mission history passes through the phrase translator; the UX audit flags this limitation.

## 3. Current route inventory

Preview URLs use hashes, such as `/#/apply`. The tables omit `/#` for readability.

### Public

| Route | Purpose |
|---|---|
| `/` | Homepage, help/tracking actions, embedded map, demo totals and process explanation |
| `/apply` | Direct/proxy application; optional district/upazila query prefilling |
| `/map` | Larger view of the existing approximate demonstration map |
| `/track` | Reference plus simulated code, progress and clarification response |
| `/volunteer/register` | Volunteer registration and optional membership request |
| `/organization/register` | Organization registration and linked responsible demo administrator |
| `/login` | Explicit demo account chooser, not password authentication |
| `/privacy` | Browser-local data and prototype/privacy limitations |
| `/access-denied` | Restricted access with a return to the user's portal |

Unknown public URLs redirect Home rather than showing a separate not-found page.

### Volunteer

| Route | Purpose |
|---|---|
| `/volunteer` | State-dependent dashboard and next action |
| `/volunteer/missions` | Team missions and history |
| `/volunteer/missions/:id` | Shared detail with team-membership and leader checks |
| `/volunteer/requests` | Privacy-safe browsing and summary dialogs |
| `/volunteer/organization` | Own membership requests and approval/rejection state |
| `/volunteer/organizations` | Organization discovery and membership requests |
| `/volunteer/team` | Own small-team roster, leader, capabilities and areas |
| `/volunteer/profile/edit` | Profile, skills, working areas and availability |
| `/volunteer/teams` | Legacy redirect to `/volunteer/organizations`, not team creation |

### Organization administrator

| Route | Purpose |
|---|---|
| `/org` | Registration status, operational overview and next actions |
| `/org/memberships` | Incoming membership requests and decisions |
| `/org/volunteers` | Approved volunteers, current team and removal constraints |
| `/org/profile` | Organization details and existing edit dialog |
| `/org/teams` | Own small teams, capabilities, areas and availability |
| `/org/teams/new` | Create a team from approved, eligible members |
| `/org/teams/:id/edit` | Edit a team; locked during active missions |
| `/org/missions` | Own organization's missions |
| `/org/missions/:id` | Read-only operational monitoring |

Pending/rejected organization accounts are restricted to organization status and profile. The restriction normalizes trailing slashes, treating `/org/` like `/org`.

### Super administrator

| Route | Purpose |
|---|---|
| `/admin` | Overview of review, assignment, acknowledgement, problems and organization verification |
| `/admin/requests` | Shared queue; reference/upazila search, district and verification filters |
| `/admin/requests/:id` | Review, contact reveal, clarification/rejection, assignment and history |
| `/admin/missions` | All mission records and history |
| `/admin/missions/:id` | Monitoring, cancellation/failure and return to reassignment |
| `/admin/organizations` | Organization registration verification/rejection |
| `/admin/teams` | Cross-organization team readiness, areas, capabilities and workload |
| `/admin/suppliers` | Supplier browsing and working supplier/resource add dialogs |

## 4. Public pages and forms

### Home

The homepage contains account-free help messaging, a primary help CTA, tracking/map links, the existing flood photograph, an embedded map, sample operational totals, a four-step explanation and volunteer/organization registration actions. The final registration block has one organization-registration CTA, not duplicate buttons.

Homepage totals derive from shared requests/missions. They are labelled sample rather than live statistics. Process copy is not evidence of automatic nearest-team routing or a priority editor: current dispatch is manual after eligibility checks, and priority is displayed from existing records.

### Help application — `/apply`

| Field/group | Current requirement |
|---|---|
| Type | Self/direct or on someone else's behalf |
| District/upazila | Required, dependent searchable choices |
| Number of people | Required and positive; Bengali/Latin digits accepted by validation |
| Assistance | At least one of food, clean water, medicine, rescue or shelter |
| Primary contact phone | Required; Bangladesh mobile-number validation |
| Emergency description | Optional |
| Proxy reporter name/relationship | Required in proxy mode |
| Affected person's name | Optional in proxy mode |
| Proxy reporter phone | Optional; the primary affected-location/contact phone remains required |

The map passes encoded district/upazila values. The form accepts known valid selections, and changing district clears upazila. Validation preserves entries and displays summary/field feedback.

Submission creates a shared pending request with a unique reference and simulated tracking code. Confirmation says **received, not yet assigned**, and offers tracking, submit another request, Home and map actions. Users must keep the displayed credentials; dedicated copy controls are not present.

Language switching preserves the mounted form, but route departure or reload does not preserve an unfinished draft.

### Flood map — `/map` and homepage embed

The existing SVG supports bilingual geographic search, area selection, zoom/reset, district hover, request markers, a legend, area counts, assistance/status summaries and loading/error/empty demo states. Selecting an area links to a prefilled application.

**Map `PLACES` counts are separate static sample data.** They do not update when shared requests/missions change. Geometry is approximate; flood-verification labels are demonstration states, not an authoritative feed. Desktop demo-state controls remain available.

### Tracking — `/track`

Reference matching ignores letter case; the trimmed simulated code must match. Results show area, assistance, timestamps and derived progress, not private names/phones or free-text operational descriptions.

Clarification requests expose an additional-information form. Submission appends information for admin review and returns the request to pending. Changing either credential or submitting a new lookup clears stale results/feedback.

The administrator's specific clarification/rejection note is not displayed. The audit recommends an explicitly public-safe explanation, not publication of private internal notes.

### Demo login, privacy and access denied

Demo login selects a sample or newly registered demo account without a password. Protected routes redirect missing sessions to login and mismatched roles to access denied; permitted return paths are retained. Privacy notices explain local storage and prohibit real sensitive information. This is a simulated user journey, not production account security.

## 5. Volunteer experience

### Registration and profile

Registration captures full name, validated mobile, current district/upazila, at least one working area and skill, availability, vehicle access and swimming capability. Skills include boat operation, first aid, cooking/food distribution, swimming, communication coordination and driving.

There is **no password field**. Registration creates a volunteer and linked demo account, selects that account and, if a verified organization was chosen, creates a **pending membership request**, not immediate membership.

Profile editing uses the same form and updates shared profile/account-name records. Membership cannot be changed through the profile; users are directed to the organization flow. Changing district clears dependent location/area selections.

### Dashboard and membership

The dashboard derives its next action from shared state:

```text
No organization → discover an organization
Pending request → follow approval status
Approved member → await/view small-team assignment
Team member → view the team
Team with mission → view the current mission
```

Organization discovery searches names, types and operating areas. Pending requests or approved membership block another concurrent request. Rejected applicants can apply again. Volunteers cannot directly create small teams or bypass organization approval.

### Safe request browsing and team view

- District/upazila filters and selected-summary state are stored in the URL; rejected requests are excluded.
- Cards show reference, priority, assistance, area, people, time, derived progress and recorded risk indicators.
- Details use the shared dialog. Names, phones, exact addresses and free-text operational details are omitted.
- There is **no individual “Accept request” action**. Browsing does not create a mission.
- The team view shows organization-managed members, leader, areas and capabilities. Only the assigned leader has operational mission controls.

## 6. Organization administrator experience

### Registration and verification

The form collects responsible demo administrator name, organization name/type, description, contact email/phone, operating districts and at least one specific upazila location. IDs, creation time and pending verification are generated automatically.

A linked organization-administrator account is created and selected. The organization enters the super-admin review queue. There is no real email or verification service. Operational team management remains unavailable until verification.

### Dashboard, memberships and approved volunteers

Verified organizations see membership/team/active-mission summaries and links to the next task. Administrators approve or reject incoming requests and can remove membership subject to team constraints. Rejection/removal requires a reason.

The volunteer's portal reflects the same decision. Approval makes a volunteer eligible for a team; it does not automatically assign one. Members must first be removed from their team before membership removal, and active-mission teams are locked.

### Team creation and editing

A team form captures name, operating districts, approved members, a leader from those members, availability and aid capabilities. Teams belong to the current organization; another organization's team cannot be edited by changing the URL.

Rules include:

- Members must have approved membership in the owning organization.
- A volunteer can belong to only one current small team.
- The leader must be among selected members.
- Team operating areas must belong to the organization.
- A team with an active mission cannot be edited.

### Organization profile

The profile displays administrator, type, contacts, description, districts, specific locations, verification, ID and creation time. Its existing dialog edits name, type, description, email, phone and operating districts. Specific locations are displayed but do not have a dedicated edit control in this dialog.

Verification, administrator linkage, ID and creation time remain protected. Removing a district still used by a team is rejected with an explanation. Organization admins monitor missions; they do not dispatch teams or update leader progress.

## 7. Super administrator experience

### Request queue and detail

The queue searches reference/upazila and filters district/verification. Filters stay in the URL, and returning from detail preserves queue context. Priority is displayed; the current review action changes verification and notes, not priority.

Request detail provides:

- Request type, area, people, assistance, priority, timestamps and operational description.
- Private applicant/contact information behind an explicit reveal control in the admin view.
- Verify, request clarification or reject actions, with required reasons for the latter two.
- Eligibility reasons for teams and a separate assignment confirmation.
- Prior assignments and links to mission details.

Only verified requests can be dispatched. Active/completed assignments block duplicate dispatch and conflicting review. No eligible team produces a waiting state with an explanation, not an individual-acceptance fallback.

### Team eligibility and organization verification

Eligibility checks organization verification, operating-area match, requested aid capabilities, team readiness, approved roster/leader and active workload. This is a simplified eligibility check, **not distance-based automatic routing**.

Organization review shows registration-linked identity, administrator and contact details. Admins verify or reject with a reason. Verification changes are blocked while the organization's teams have active missions.

### Suppliers and resources

The page browses suppliers and their resources and includes working add dialogs:

| Form | Fields |
|---|---|
| Supplier | Name, category, location and fictional contact |
| Resource | Name, category, nonnegative quantity and optional note, attached to the selected supplier |

Saved additions persist in the shared browser-local state; quantity determines displayed stock status. This is not a complete inventory-adjustment, purchasing, fulfillment or external supplier-integration system. No such functionality should be inferred from the add forms.

## 8. Mission lifecycle and permissions

```text
Request received → pending review
  ├─ clarification → public additional information → pending review
  ├─ rejection
  └─ verified → eligible team assigned
                   → leader acknowledgement
                   → leader starts mission
                   → progress notes
                   → completion with a note
```

A leader can report a problem from assigned, acknowledged or ongoing. Resolving it requires a note and returns to that same previous normal stage; acknowledgement/start cannot be skipped. Ongoing progress updates and completion require operational notes where enforced by the transition rules.

The super admin can cancel or fail an active mission with a reason, then return to the request to select another eligible team. This does not erase the previous assignment. Completed/cancelled/failed missions cannot be edited; a completed request cannot be dispatched again.

| Action | Public | Volunteer member | Assigned leader | Organization admin | Super admin |
|---|---|---|---|---|---|
| Submit/track a public request | Yes, tracking requires code | Same public flow | Same public flow | Same public flow | Same public flow |
| Request own organization membership | No | Yes | Yes, subject to duplicate policy | No | No |
| Approve organization memberships/manage teams | No | No | No | Own verified organization | Cross-organization team overview, not org editing |
| Verify requests/organizations and dispatch teams | No | No | No | No | Yes |
| View restricted missions | No | Own team | Own team | Own organization | All |
| Acknowledge/start/update/report problems/complete | No | No | Assigned team's mission | No | No |
| Cancel/fail a mission and arrange reassignment | No | No | No | No | Yes |
| Add suppliers/resources | No | No | No | No | Yes |

This table describes **frontend demo permissions**, not production access control. Checks exist in layouts, detail views and state transitions, but anyone with browser storage/devtools access can inspect or alter local data.

## 9. State and persistence

| Source | Responsibility |
|---|---|
| `src/app/model.ts` | Types, seeds, labels, eligibility, ownership and transition guards |
| `src/app/store.ts` | Shared subscribed state, transition dispatch, storage warnings and reset |
| `src/app/data.ts` | Geographic options, legacy fictional seed records and static map places |
| `src/app/locale.ts` | Language preference, translation and bilingual search |
| `src/app/i18n.ts`, `src/app/en.json` | React language subscription and English catalog |

`shara-demo-v1` stores accounts, selected demo session, volunteers, organizations, memberships, teams, requests, missions and suppliers/resources. Successful submissions and edits therefore survive refresh in the same browser. Other components read the same records instead of independent operational arrays.

Corrupt/unreadable or incompatible saved data falls back to sample data with a warning. A failed storage write retains in-memory changes and warns they may disappear on refresh. Same-origin tabs receive demo-state storage changes; this is not a shared multi-user service.

`shara-language` is independent. Switching languages neither resets the demo nor changes canonical record values. Temporary searches, open dialogs and unfinished form drafts are not all persisted.

## 10. Accessibility and interaction support

Implemented support includes labelled controls, required markers, invalid/error feedback, visible focus styles, text-backed statuses, reduced-motion animation rules and contextual empty/error states.

The shared dialog is portalled outside headers, uses a labelled native modal, locks page scroll, wraps Tab focus, handles Escape and restores trigger focus. Public menu, safe request summaries, profile edits, confirmations and mobile language selection reuse it.

Source review also identifies remaining work: hints/errors are not consistently connected through descriptive ARIA attributes; the custom search selector lacks a complete arrow-key interaction; map markers support Enter but not Space; route changes scroll without deliberate heading/main focus, and no skip link is present. These are audit findings, not a claim that the site has passed accessibility certification.

## 11. Verification and evidence status

Available scripts remain:

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm format
pnpm test:browser
```

There is no standalone lint script. `pnpm test` currently declares 10 tests covering localization, switching without record changes, business flows, ownership, duplication, roster locks, mission recovery and organization/team area consistency.

The browser suite covers public/role journeys, tracking/clarification, map prefilling, completion, membership/team/profile flows, supplier/resource persistence, mobile navigation and language behavior. Its language helper/assertions now account for the compact mobile language dialog.

Browser automation requires an installed external Playwright module and Chromium; it is not an added application dependency. Against the already-supervised preview, the documented invocation is:

```sh
PLAYWRIGHT_MODULE=/path/to/installed/playwright \
SHARA_PREVIEW_URL=http://localhost:3000 \
pnpm test:browser
```

**No tests, build or browser journeys were rerun for this documentation refresh.** Earlier passing results in `FLOW_IMPLEMENTATION.md` are historical evidence, not a fresh pass for subsequent navbar/mobile changes. The latest compact interaction needs a new browser check before reporting it as verified. Earlier builds also reported a large-chunk warning. The existing formatter caveat is recorded in the implementation notes; it should not be blindly applied across known problematic type declarations.

This update checks documentation links, whitespace and consistency with reviewed source, not runtime correctness.

## 12. Intentional limitations and outstanding UX work

### Intentional demo boundaries

- No production login, secure tracking, server authorization or protected private storage.
- No shared database or synchronization across devices/browser profiles.
- No real email, SMS, rescue response, dispatch, geolocation or background notifications.
- Approximate static map data and a subset of geographic form options, not a live/official registry.
- One current approved organization membership and small team per volunteer, plus one active mission per team, are simplified demo policies.
- Names/free-text can remain in their original language; the static catalog is not automatic translation.
- Submitted records persist locally, but unfinished drafts can be lost on reload/navigation.

### UX follow-up, not new implementation in this report

The [current audit](UX_AUDIT.md) prioritizes privacy-safe actionable clarification/rejection feedback, field/search/map/route accessibility, consistent phone validation, truthful local-error messages, unsaved-work protection and localization review. Copy helpers and measured performance improvements are lower-priority considerations.

This report does **not** recommend bringing back individual request acceptance, creating independent volunteer teams, adding parallel management screens or silently introducing backend infrastructure. The current branding, connected shared-store flows, team-leader boundaries and existing map should be preserved.
