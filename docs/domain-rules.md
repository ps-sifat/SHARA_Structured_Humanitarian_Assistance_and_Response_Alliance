# SHARA Domain Statuses and Permissions

Part 1 establishes the persisted choices and service/permission boundaries. Workflow APIs are intentionally deferred to later migration phases.

## Status transitions

| Record | Statuses | Allowed path |
| --- | --- | --- |
| Organization registration | `pending`, `approved`, `rejected` | Super Admin reviews a pending registration. Approval creates an active `OrganizationAdmin` relationship for the linked `registered_by` user. A rejected registration needs an explicit later resubmission/review policy. |
| Membership request | `pending`, `approved`, `rejected`, `withdrawn` | An organization admin for that organization decides a pending request. Rejected or withdrawn requests remain as history; a later request is allowed. Only one pending request per volunteer and organization is allowed. |
| Organization membership | `active`, `ended`, `revoked` | Approval creates an active history row. Ending/revoking it keeps the record; a later organization can be joined while only one active organization membership exists. |
| Team membership | `active`, `ended`, `removed` | An organization admin assigns an already-approved organization member. The `member` or `leader` role belongs to this relationship. Ending/removing keeps the record; a volunteer can have only one active team membership. |
| Help request verification | `pending`, `verified`, `rejected`, `clarification` | Public submissions start pending. Super Admin review can verify, reject, or request clarification; clarification returns to pending after the reporter supplies more information. These states do not encode mission progress. |
| Mission | `awaiting_assignment`, `assigned`, `acknowledged`, `ongoing`, `problem`, `done`, `cancelled`, `failed` | A verified request may be assigned. The normal path is `awaiting_assignment → assigned → acknowledged → ongoing → done`. The assigned leader records progress; `problem` records an interruption and may return to the last normal progress stage after resolution. Super Admin can cancel or fail a mission and can reopen a failed mission through reassignment. Completed and cancelled missions are terminal. Reassignment creates a new `MissionAssignment` and closes the previous row instead of deleting it. |
| Supplier | `pending`, `verified`, `rejected` | Admin review controls supplier visibility; the responsible role is not explicit in the confirmed business rules and remains to be mapped to the existing Admin workflow. Resource availability is tracked independently. |
| Notification | unread (`read_at` is null), read (`read_at` set) | In-app notifications only; no email or SMS delivery state is modeled. |

The database enforces the conditional uniqueness rules SQLite supports: at most one active organization membership per volunteer, one active team membership per volunteer, one active leader per team, one pending organization membership request per volunteer/organization, one active mission assignment per mission, and one active mission per team.

## Permission rules

- Django `is_superuser` is the only Super Admin marker. Public registration and organization approval never grant it.
- Organization registration requires a linked existing `registered_by` user. Super Admin approval creates that user's active organization-admin relationship.
- Only active organization admins for an organization review that organization's volunteer membership requests and assign approved organization members to that organization's teams.
- Team leaders are active `TeamMembership(role="leader")` relationships. There is no global team-leader role.
- Super Admin assigns or reassigns verified requests to active teams under approved organizations. Assignment history captures the team leader who was assigned at that time.
- Only the leader captured on the active mission assignment may update mission progress. Super Admin has oversight and may assign/reassign or cancel/fail missions through later workflow APIs.
- Public help request creation does not require an account. The request stores direct/proxy reporter details separately. PII and the tracking token must not be exposed by public serializers.
- Phone and email are normalized identifiers only. No ownership verification, SMS, or email delivery is performed.
