# SHARA Domain Statuses and Permissions

Parts 1–3 establish persisted records and service/permission boundaries for request review, team dispatch, and missions. Supplier and release workflows remain deferred to Part 4.

## Status transitions

| Record | Statuses | Allowed path |
| --- | --- | --- |
| Organization registration | `pending`, `approved`, `rejected` | Super Admin reviews a pending registration. Approval creates an active `OrganizationAdmin` relationship for the linked `registered_by` user. A rejected registration needs an explicit later resubmission/review policy. |
| Membership request | `pending`, `approved`, `rejected`, `withdrawn` | An organization admin for that organization decides a pending request. Rejected or withdrawn requests remain as history; a later request is allowed. Only one pending request per volunteer and organization is allowed. |
| Organization membership | `active`, `ended`, `revoked` | Approval creates an active history row. Ending/revoking it keeps the record; a later organization can be joined while only one active organization membership exists. |
| Team membership | `active`, `ended`, `removed` | An organization admin assigns an already-approved organization member. The `member` or `leader` role belongs to this relationship. Ending/removing keeps the record; a volunteer can have only one active team membership. |
| Help request verification | `pending`, `verified`, `rejected`, `clarification` | Public submissions start pending. Super Admin can verify, reject with a reason, or request clarification. The applicant submits a response through reference/token tracking; an admin reviews and resolves the submitted clarification, after which the request is pending review. These states do not encode mission progress. |
| Mission | `awaiting_assignment`, `assigned`, `acknowledged`, `ongoing`, `problem`, `done`, `cancelled`, `failed` | A verified request has one mission. The normal path is `awaiting_assignment → assigned → acknowledged → ongoing → done`. The assigned leader records progress; a problem may return to the previous normal stage after resolution. A decline or inability to continue releases the team and returns the mission to `awaiting_assignment`. Super Admin can cancel or fail; failed missions can be reassigned. Reassignment is limited to `awaiting_assignment` or `failed`, creates a new `MissionAssignment`, and closes the prior row. Completed and cancelled missions are terminal. |
| Supplier | `pending`, `verified`, `rejected` | Admin review controls supplier visibility; the responsible role is not explicit in the confirmed business rules and remains to be mapped to the existing Admin workflow. Resource availability is tracked independently. |
| Notification | unread (`read_at` is null), read (`read_at` set) | In-app notifications only; no email or SMS delivery state is modeled. |

The database enforces the conditional uniqueness rules SQLite supports: at most one active organization membership per volunteer, one active team membership per volunteer, one active leader per team, one pending organization membership request per volunteer/organization, one active mission assignment per mission, one active mission per team, one non-empty tracking-token hash per request, and one idempotency key per request.

## Permission rules

- Django `is_superuser` is the only Super Admin marker. Public registration and organization approval never grant it.
- Organization registration requires a linked existing `registered_by` user. Super Admin approval creates that user's active organization-admin relationship.
- Only active organization admins for an approved organization manage its teams and assign its active organization members. A volunteer can belong to one active team maximum. Leader changes/removal are blocked while the team has an active mission.
- Team leaders are active `TeamMembership(role="leader")` relationships. There is no global team-leader role.
- Super Admin assigns verified requests to active teams under approved organizations. The suitability score and reasons are deterministic rules based on operating area, availability, capability overlap, active leadership, organization approval, and active workload. The initial workload limit is one active mission per team.
- Only the leader captured on the active mission assignment may acknowledge, decline, start, add progress, complete, report a problem, resolve it, or report inability to continue. Super Admin may assign/reassign and cancel/fail with a reason. Every update stores actor, time, action, status, and note; prior assignments remain history.
- Public help request creation does not require an account. Direct/proxy reporter details are stored separately. List, map, safe-open, mission, and tracking serializers omit names, contact phones, descriptions as appropriate, internal review notes, and tracking tokens. Admin detail remains protected by Super Admin permission.
- Tracking credentials are generated with HMAC-SHA256 from the server secret, idempotency key, and request reference. Only SHA-256 token hashes are persisted. The browser submits credentials in POST bodies and does not place them in URLs or local storage.
- Public map data is grouped by district and suppresses counts below three; it does not expose household locations. The underlying geography table remains a limited subset and the displayed boundaries are approximate.
- Idempotency and validation protect against accidental duplicate requests and malformed input, but they do not prevent intentional abuse. No SMS/email ownership check or complete abuse-prevention layer is implemented.
- Phone and email are normalized identifiers only. No ownership verification, SMS, or email delivery is performed.
