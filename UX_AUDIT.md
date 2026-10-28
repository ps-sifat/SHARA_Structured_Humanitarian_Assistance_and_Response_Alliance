# SHARA — Current UX Audit

## 1. Scope and evidence

This audit describes the current repository implementation, including Bengali/English support, the language selector inside the public navbar, and its collapsed mobile control. It supersedes the previous audit's outdated “current behavior” descriptions.

**This refresh is a source-based UX review, not a new live-site usability study or accessibility certification.** Routes, rendered controls, form handlers, shared state, transition rules, localization and test coverage were reviewed. No application code was changed, and builds, automated tests and browser journeys were not rerun for this documentation update.

Evidence comes from:

- `routes.tsx` and `layouts.tsx`: navigation, public/mobile language controls, role redirects and pending-organization access.
- `Home.tsx`, `Apply.tsx`, `BangladeshMap.tsx`, `PublicFlow.tsx`: public actions, submissions, map prefilling, tracking and privacy messaging.
- `Volunteer.tsx`, `HelpRequests.tsx`, `Org.tsx`, `OrgManagement.tsx`, `Admin.tsx`, `Missions.tsx`: role-specific tasks and connected journeys.
- `model.ts`, `store.ts`, `locale.ts`, `i18n.ts`, `en.json`: ownership, mission transitions, browser-local persistence and language behavior.
- `ui.tsx`, `index.css` and existing test files: interaction patterns, accessibility support and regression coverage.

See [WEBSITE_REPORT.md](WEBSITE_REPORT.md) for the current page inventory and [FLOW_IMPLEMENTATION.md](FLOW_IMPLEMENTATION.md) for implementation details and previously recorded checks.

## 2. Overall assessment

SHARA is now a connected, bilingual **frontend demonstration**, rather than a set of disconnected page mockups. The primary business flow is represented consistently:

```text
Public help request
  → super-admin review / clarification / verification
  → eligible organization-managed team assignment
  → assigned team leader acknowledges
  → leader starts and updates progress
  → completion with a note
```

The original green branding, logo, fonts, map implementation and local UI primitives remain. No redesign, parallel workflow, backend or new application dependency is needed to explain the current site.

The main remaining concerns are actionable requester feedback, accessibility details, validation consistency and resilience around unfinished forms—not missing team management, tracking or shared demo state.

## 3. Current feature assessment

| Area | Current implementation | Assessment / classification |
|---|---|---|
| Brand and visual language | Existing forest/leaf/mint palette, typography, logo, cards and buttons retained | **Keep** |
| Public navigation | Home, map and tracking inline on wide screens; help CTA and public menu; registration and demo login available through the menu | **Keep**; check narrow-screen wrapping in both languages |
| Desktop public language control | Bengali/English buttons are inside the navbar, not in a separate top strip | **Keep** |
| Mobile public language control | Below the `sm` breakpoint, a language icon opens a dialog; selecting a language closes it | **Keep**; latest compact interaction needs a fresh browser check |
| Dashboard language control | Existing full selector remains in the role header/sidebar, including on mobile | **Keep**; intentionally distinct from the public mobile control |
| Localization | Bengali default; browser-local preference; translated interface, English date formatting and bilingual area search | **Keep / Extend** translation review rather than add another language system |
| Direct/proxy help form | Account-free submission, conditional proxy fields, location prefilling, validation and generated reference/code | **Keep / Extend** error and field accessibility |
| Tracking | Reference plus simulated code; shared status and timestamps; clarification submission | **Keep / Extend** privacy-safe explanations for clarification/rejection |
| Volunteer onboarding | Creates a demo account; optional organization selection creates a pending membership request | **Keep** |
| Organization discovery | Search, verification state and duplicate-safe membership requests | **Keep** |
| Volunteer request browsing | Area filters and safe summary dialog; no individual acceptance | **Keep** |
| Membership and teams | Organization decisions, approved-member rosters, leader selection, readiness and capability editing | **Keep** |
| Organization registration/profile | Linked administrator, pending verification, editable organization fields and protected system fields | **Keep** |
| Admin review and dispatch | Verification, clarification/rejection, contact reveal, eligibility explanations and confirmed team assignment | **Keep** |
| Mission progress | Team-owned records; leader-only operational updates; stage-aware recovery and retained history | **Keep** |
| Suppliers/resources | Functional add dialogs and browser-local resource records | **Keep**; not a complete stock-management system |
| Persistence | Shared subscribed state saved under `shara-demo-v1`; storage warnings and seed recovery | **Keep**; submitted records persist, unfinished drafts do not |
| Map | Existing approximate SVG and static geographic demonstration, with search, zoom, selection and prefilling | **Keep**; do not present its counts as a live reflection of the shared store |

## 4. Previous findings that are resolved

These are historical issues, **not outstanding implementation requests**.

| Earlier finding | Current resolution |
|---|---|
| Map selection did not populate the help form | District/upazila query values prefill valid form selections |
| Submission had a fixed reference and no shared record | Unique request/reference and simulated code are written to the shared store |
| Login opened a volunteer dashboard without explanation | `/login` is an explicitly labelled demo account chooser |
| All roles were mixed into normal global navigation | Normal menus are role-specific; developer page index/account switching are under demo controls |
| Volunteer registration suggested immediate organization membership | It creates a pending request requiring organization approval |
| Volunteers could accept help requests individually | Acceptance was removed; volunteers browse safe summaries and leaders act only on assigned team missions |
| Profile, membership and organization changes were isolated | Submitted changes update shared records and persist in the same browser |
| Create-team and supplier/resource controls were dead ends | Team forms and supplier/resource dialogs are connected |
| Public menu omitted the help application | The menu includes `/apply` |
| Safe request details could open above the viewport | Details use the shared focus-managed dialog |
| Mission problem recovery could skip acknowledgement | Recovery returns to the last normal stage and requires a note |
| Organization area changes could orphan team operating areas | Profile transitions reject removal of areas still used by a team |
| Tracking clarification feedback persisted under a different lookup | Editing either credential or submitting a new lookup clears stale results/feedback |
| Pending `/org/` was treated differently from `/org` | The pending-access check normalizes trailing slashes |
| English was unavailable | Interface localization, persistent selection and bilingual geographic search exist |
| Language selector occupied a separate bar above navigation | The public selector is now in the navbar and collapses to an icon on mobile |

## 5. Remaining findings and recommendations

Priorities below are relative to this demo. **P1** affects completion or recovery of a core task; **P2** affects accessibility, consistency or resilience; **P3** is a lower-priority improvement. Recommendations are not implemented by this report update.

| ID | Priority / evidence | Finding and impact | Smallest coherent next step |
|---|---|---|---|
| UX-01 | **P1 — source-confirmed** | Tracking shows clarification/rejection status, but does not explain the admin's specific clarification request or rejection reason. `reviewNote` is not rendered in `Tracking`; a requester sees a generic additional-information prompt. | Provide an explicitly public-safe explanation or structured reason. Do **not** expose internal notes, private contact data or operational descriptions to solve this. |
| UX-02 | **P2 — source-confirmed** | `Field` displays hints/errors without stable descriptive IDs or `aria-describedby` links. Its required marker does not itself make the child control programmatically required; this matters in the custom-validated help form. | Associate labels, hints and errors with their controls; apply appropriate required/invalid semantics without replacing the existing field components. |
| UX-03 | **P2 — source-confirmed** | `SearchSelect` supports searching, Tab-accessible option buttons and Escape, but not the expected Arrow/Home/End navigation or active-option management of a complete combobox/listbox interaction. | Complete the existing shared control's keyboard and assistive-technology pattern; retain its search and visual styling. |
| UX-04 | **P2 — source-confirmed** | SVG request markers activate with Enter but not Space; district hit areas are pointer-only. Search-result buttons offer an alternative, but map interactions are not equivalent across input methods. | Add appropriate keyboard activation and a clear accessible alternative/selection announcement, without replacing the map. |
| UX-05 | **P2 — source-confirmed** | `ScrollTop` scrolls on route changes without moving focus to the new page heading/main region. Public/dashboard layouts provide `main` IDs but no visible-on-focus skip link. | Add a skip-to-content action and deliberate route-change focus handling while preserving dialog focus restoration. |
| UX-06 | **P2 — source-confirmed** | Phone validation is inconsistent. The primary help contact and volunteer mobile are validated, but an entered optional proxy contact is not; organization phone controls require a value but do not apply the same mobile-number check. | Define the intended phone formats for each field, validate optional numbers when present, and use consistent bilingual guidance. Do not assume every organization contact must be a personal mobile. |
| UX-07 | **P2 — source-confirmed** | Help-form submission failures show an internet-connection message even though submission uses a local transition, not a network request. Storage-write failures follow a different path: in-memory success plus a global warning. | Distinguish invalid/demo-transition failures from browser-storage limitations and make the recovery action match the actual failure. |
| UX-08 | **P2 — source-confirmed** | Unsubmitted forms live in component state. Language changes preserve the mounted form, but navigation or reload can discard an unfinished application/profile/registration without a discard warning. | Start with a clear unsaved-change warning or discard confirmation. Do not silently persist sensitive unfinished contact details as a new default. |
| UX-09 | **P2 — implementation risk** | Localization uses exact Bengali phrases plus fallback phrase substitution. New copy can remain untranslated; user-authored mission history is also passed through `tr(h.text)`, potentially changing displayed wording even though storage remains unchanged. | Separate system messages from user-authored text and review both languages for each new state. Consider stable message keys incrementally, not a wholesale localization rewrite. |
| UX-10 | **P3 — source-confirmed** | The success screen displays reference/code and tells users to keep them, but offers no dedicated copy action. Re-entering credentials is a friction point, especially on mobile. | Consider accessible copy-reference/copy-code controls with clear success/failure feedback; keep manual selection available. |
| UX-11 | **P2 — source-confirmed** | Homepage process copy suggests administrators set priority and choose the closest team. Current review changes verification/notes, while team selection uses area/capability/readiness checks and manual assignment; there is no priority-edit control or distance-ranking algorithm. | Align the process wording with the existing workflow. Any future priority or proximity feature needs explicit scope rather than being implied by the current copy. |

### Items requiring observation, not a defect claim

- Recheck the **latest** compact mobile language dialog at 320/390-pixel widths and the full selector at the `sm` breakpoint, in both languages. Confirm wrapping, tap targets, selected-state announcement, automatic close, Escape and return focus.
- Recheck long organization/team names, enlarged text, zoom and translated labels in public and role navigation.
- Conduct screen-reader, contrast and real-device touch review before making any accessibility-compliance claim.
- Prior builds reported a large JavaScript chunk. Current mobile performance and network costs were not measured in this documentation refresh.

## 6. Intentional demo limitations

These must remain explicit and must not be misreported as missing UI integrations or silently expanded into a backend project.

- Demo login, client role/ownership guards and tracking codes are not production authentication, authorization or secure private storage.
- All records are browser-local. Different users, devices and browser profiles do not share a coordinated service. Same-origin tabs may synchronize browser-local changes.
- No actual SMS, email, notification, geolocation, rescue dispatch or emergency response occurs.
- The map uses separate static sample places/counts and approximate geography. Homepage operational totals derive from shared records; map counts are not recalculated from those totals.
- Geographic form options cover a subset of Bangladesh, not an official complete registry.
- One current approved organization membership and one small-team assignment per volunteer, and one active mission per team, are explicit simplified demo policies.
- All teams belong to organizations. Approved organization membership is required before assignment to a small team. There is no independent volunteer mission acceptance.
- Active mission team editing is locked. Problem recovery cannot skip acknowledgement/start stages. Cancelled/failed records remain available for history and reassignment.
- There is no automatic translation guarantee for names or free-text submissions. Interface localization does not rewrite canonical stored values.

## 7. Verification status

| Evidence | Status for this refresh |
|---|---|
| Current routes, UI definitions, form handlers, state and transition guards | Reviewed in source |
| Desktop/navbar and collapsed mobile language implementation | Reviewed in source; dashboard selector remains unchanged |
| Domain test coverage | `tests/flows.test.cjs` contains 10 tests, including localization and the main business rules; not rerun here |
| Browser coverage | Existing suite covers public/role journeys, persistence, dialogs and language behavior; mobile-language assertions have been updated for the compact dialog, but were not rerun here |
| Typecheck/build | Previously recorded results are in `FLOW_IMPLEMENTATION.md`; not rerun or represented as fresh results here |
| New live usability, accessibility or performance measurements | Not performed |
| Documentation integrity | Checked for patch whitespace and consistency with reviewed source |

### Recommended follow-up order

1. Make clarification/rejection feedback actionable without exposing private notes.
2. Close the shared field/search-control and route/map keyboard-accessibility gaps.
3. Align phone validation and local-error recovery messages.
4. Protect unfinished work from accidental loss.
5. Recheck the current mobile language interaction and both-language copy, then consider optional copy helpers and measured performance improvements.

Preserve the current branding, map and connected workflows throughout; none of these findings calls for a redesign, replacement stack or parallel management interface.
