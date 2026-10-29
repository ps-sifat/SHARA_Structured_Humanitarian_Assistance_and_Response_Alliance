import { useEffect, useState } from "react"
import { Link, useLocation, useParams, useSearchParams } from "react-router"
import { api } from "./api"
import { useAuth } from "./auth"
import { Alert, Badge, Button, Card, Empty, Field, PageHead, SectionTitle, Select, Spinner, TextArea } from "./ui"

const statusLabel = {
  awaiting_assignment: "Awaiting assignment", assigned: "Assigned · awaiting team acknowledgement",
  acknowledged: "Acknowledged", ongoing: "In progress", problem: "Problem reported",
  done: "Completed", cancelled: "Cancelled", failed: "Failed",
}
const terminal = new Set(["done", "cancelled", "failed"])
const active = (status) => !terminal.has(status)

export function LiveMissionList() {
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const filter = params.get("status") ?? "all"
  const roleRoot = location.pathname.startsWith("/admin") ? "/admin" : location.pathname.startsWith("/org") ? "/org" : "/volunteer"
  useEffect(() => { api("/api/missions/").then(setRows).catch((requestError) => setError(requestError.message || "Could not load missions.")).finally(() => setLoading(false)) }, [])
  const visible = rows.filter((mission) => filter === "all" || (filter === "active" ? active(mission.status) : filter === "history" ? !active(mission.status) : mission.status === filter))
  return <div className="mx-auto max-w-6xl">
    <PageHead title={roleRoot === "/volunteer" ? "My team missions" : "Missions"} sub="Status, assignment history and updates are shared from the operational database." />
    <Card className="mb-5"><Field label="Filter missions" htmlFor="mission-filter"><Select id="mission-filter" value={filter} onChange={(event) => setParams(event.target.value === "all" ? {} : { status: event.target.value })}><option value="all">All missions</option><option value="active">Active</option><option value="history">History</option><option value="awaiting_assignment">Awaiting assignment</option><option value="assigned">Awaiting acknowledgement</option><option value="acknowledged">Acknowledged</option><option value="ongoing">In progress</option><option value="problem">Problem reported</option><option value="done">Completed</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option></Select></Field></Card>
    {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
    {loading ? <Spinner /> : visible.length ? <div className="grid gap-4 lg:grid-cols-2">{visible.map((mission) => {
      const assignment = mission.assignments?.[0]
      const request = mission.help_request
      return <Card key={mission.id}>
        <div className="flex flex-wrap items-start justify-between gap-3"><SectionTitle>{request.request_code}</SectionTitle><Badge s={mission.status}>{statusLabel[mission.status] || mission.status}</Badge></div>
        <p className="mt-2 font-semibold text-forest">{request.assistance_categories?.join(", ")}</p>
        <p className="mt-2">{request.upazila}, {request.district} · {request.people_affected} people</p>
        <p className="mt-3 text-sm text-ink-soft">{assignment ? `${assignment.team_name} · ${assignment.organization_name}` : "No team assigned yet"}</p>
        <p className="mt-2 text-sm text-ink-soft">Updated {new Date(mission.updated_at).toLocaleString()}</p>
        <Button to={`${roleRoot}/missions/${mission.id}?list=${encodeURIComponent(filter)}`} variant="secondary" className="mt-4">Open mission</Button>
      </Card>
    })}</div> : <Empty title="No missions in this view">Verified requests appear here after the review and dispatch process.</Empty>}
  </div>
}

export function LiveMissionDetail() {
  const { id } = useParams()
  const location = useLocation()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const roleRoot = location.pathname.startsWith("/admin") ? "/admin" : location.pathname.startsWith("/org") ? "/org" : "/volunteer"
  const isAdmin = Boolean(user?.is_super_admin)
  const [mission, setMission] = useState(null)
  const [teams, setTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState("")
  const [action, setAction] = useState("")
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const load = async () => {
    setLoading(true); setError("")
    try {
      const row = await api(`/api/missions/${id}/`)
      setMission(row)
      if (isAdmin && ["awaiting_assignment", "failed"].includes(row.status)) setTeams(await api(`/api/help-requests/${row.help_request.id}/eligible-teams/`))
      else setTeams([])
    } catch (requestError) { setError(requestError.message || "Could not load this mission.") }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [id, isAdmin])

  const sendAction = async (requestedAction) => {
    setBusy(true); setError(""); setSuccess("")
    try {
      const updated = await api(`/api/missions/${id}/transition/`, { method: "POST", body: { action: requestedAction, reason: reason.trim() } })
      setMission(updated); setAction(""); setReason("")
      setSuccess("Mission update saved. Authorized request tracking, organization and volunteer views now read this status.")
      if (isAdmin && ["awaiting_assignment", "failed"].includes(updated.status)) setTeams(await api(`/api/help-requests/${updated.help_request.id}/eligible-teams/`))
      else setTeams([])
    } catch (requestError) { setError(requestError.message || "The mission transition was not accepted.") }
    finally { setBusy(false) }
  }
  const assign = async () => {
    if (!selectedTeam) return
    setBusy(true); setError(""); setSuccess("")
    try {
      const updated = await api(`/api/missions/${id}/transition/`, { method: "POST", body: { action: "assign", team_id: Number(selectedTeam), reason: reason.trim() } })
      setMission(updated); setReason(""); setSelectedTeam(""); setTeams([])
      setSuccess("Team assignment saved and added to the assignment history.")
    } catch (requestError) { setError(requestError.message || "Could not assign this team.") }
    finally { setBusy(false) }
  }

  if (loading) return <div className="mx-auto max-w-6xl"><Spinner /></div>
  if (!mission) return <div className="mx-auto max-w-6xl"><Alert kind="error">{error || "Mission not found or access denied."}</Alert><Button to={`${roleRoot}/missions`} className="mt-4">Back to missions</Button></div>
  const request = mission.help_request
  const assigned = mission.assignments?.[0]
  const leader = mission.is_assigned_leader
  const requiredReason = ["decline", "progress", "complete", "report_problem", "unable_to_continue", "resolve_problem", "cancel", "fail"].includes(action)
  const availableActions = leader ? [
    ...(mission.status === "assigned" ? [ ["acknowledge", "Acknowledge assignment"], ["decline", "Decline assignment"] ] : []),
    ...(mission.status === "acknowledged" ? [["start", "Start response"]] : []),
    ...(mission.status === "ongoing" ? [["progress", "Add progress update"], ["complete", "Complete response"]] : []),
    ...(["assigned", "acknowledged", "ongoing"].includes(mission.status) ? [["report_problem", "Report a problem"]] : []),
    ...(["acknowledged", "ongoing", "problem"].includes(mission.status) ? [["unable_to_continue", "Unable to continue"]] : []),
    ...(mission.status === "problem" ? [["resolve_problem", "Resolve reported problem"]] : []),
  ] : []
  return <div className="mx-auto max-w-6xl">
    <Button to={`${roleRoot}/missions${params.get("list") ? `?status=${encodeURIComponent(params.get("list"))}` : ""}`} variant="ghost" className="mb-4">← Missions</Button>
    <PageHead title={`Mission ${mission.id}`} sub={`Request ${request.request_code}`} action={<Badge s={mission.status}>{statusLabel[mission.status] || mission.status}</Badge>} />
    {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}{success && <div className="mb-4"><Alert kind="success">{success}</Alert></div>}
    <div className="grid gap-5 lg:grid-cols-2">
      <Card><SectionTitle>Verified request summary</SectionTitle><dl className="space-y-3">
        <div><dt className="text-sm text-ink-soft">Location</dt><dd>{request.upazila}, {request.district}</dd></div>
        <div><dt className="text-sm text-ink-soft">People affected</dt><dd>{request.people_affected}</dd></div>
        <div><dt className="text-sm text-ink-soft">Assistance requested</dt><dd>{request.assistance_categories?.join(", ")}</dd></div>
        <div><dt className="text-sm text-ink-soft">Priority</dt><dd><Badge s={request.priority} /></dd></div>
      </dl><p className="mt-4 text-sm text-ink-soft">Applicant names, phone numbers, and internal verification notes are not included in mission details.</p></Card>
      <Card><SectionTitle>Current assignment</SectionTitle>{assigned ? <dl className="space-y-3">
        <div><dt className="text-sm text-ink-soft">Team</dt><dd>{assigned.team_name}</dd></div>
        <div><dt className="text-sm text-ink-soft">Organization</dt><dd>{assigned.organization_name}</dd></div>
        <div><dt className="text-sm text-ink-soft">Assigned leader</dt><dd>{assigned.leader_name}</dd></div>
        <div><dt className="text-sm text-ink-soft">Assigned at</dt><dd>{new Date(assigned.assigned_at).toLocaleString()}</dd></div>
      </dl> : <p className="text-ink-soft">Awaiting a suitable team assignment.</p>}
        {leader && <Alert kind="info" title="You are the assigned team leader">Use the mission actions to acknowledge and report operational progress. Other team members can view this mission.</Alert>}
        {!leader && !isAdmin && <p className="mt-3 text-sm text-ink-soft">Only the assigned leader can report progress. Contact your team leader if a mission needs attention.</p>}
        <div className="mt-4 flex flex-wrap gap-2">{availableActions.map(([key, title]) => <Button key={key} variant={key === "complete" ? "primary" : key === "decline" ? "danger" : "secondary"} disabled={busy} onClick={() => { setAction(key); setReason(""); setError("") }}>{title}</Button>)}</div>
        {action && <form className="mt-4 space-y-3 rounded-xl border border-line bg-paper p-4" onSubmit={(event) => { event.preventDefault(); sendAction(action) }}><Field label={`${action.replaceAll("_", " ")} note`} required={requiredReason} htmlFor="mission-reason"><TextArea id="mission-reason" required={requiredReason} value={reason} onChange={(event) => setReason(event.target.value)} /></Field><div className="flex gap-2"><Button type="submit" disabled={busy || (requiredReason && !reason.trim())}>Save update</Button><Button variant="secondary" disabled={busy} onClick={() => setAction("")}>Cancel</Button></div></form>}
        {isAdmin && active(mission.status) && <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4"><Button variant="secondary" disabled={busy} onClick={() => { setAction("cancel"); setReason("") }}>Cancel mission</Button><Button variant="danger" disabled={busy} onClick={() => { setAction("fail"); setReason("") }}>Mark failed</Button></div>}
      </Card>
    </div>
    {isAdmin && ["awaiting_assignment", "failed"].includes(mission.status) && <Card className="mt-5"><SectionTitle>Dispatch or reassign a team</SectionTitle><p className="mb-4 text-sm text-ink-soft">Only suitable active teams from approved organizations are listed. A failed active mission can be assigned again; previous assignments remain in history.</p>
      {teams.length ? <div className="space-y-3">{teams.map((team) => <label key={team.id} className={`block rounded-xl border p-4 ${Number(selectedTeam) === team.id ? "border-forest bg-mint/40" : "border-line"}`}><span className="flex items-start gap-3"><input type="radio" name="dispatch-team" className="mt-1 accent-[#2e6b4f]" value={team.id} checked={Number(selectedTeam) === team.id} onChange={() => setSelectedTeam(String(team.id))} /><span><strong>{team.name} · {team.organization_name}</strong><span className="mt-1 block text-sm text-ink-soft">Score {team.score}: {team.reasons.join(" ")}</span></span></span></label>)}
        <Field label="Assignment note" htmlFor="assignment-note"><TextArea id="assignment-note" value={reason} onChange={(event) => setReason(event.target.value)} /></Field><Button disabled={busy || !selectedTeam} onClick={assign}>Assign selected team</Button>
      </div> : <Empty title="No suitable team is ready">Mission remains awaiting assignment until an eligible team can respond.</Empty>}
    </Card>}
    <Card className="mt-5"><SectionTitle>Assignment history</SectionTitle>{mission.assignments?.length ? <ol className="divide-y divide-line">{mission.assignments.map((item) => <li key={item.id} className="py-3"><div className="flex flex-wrap justify-between gap-2"><strong>{item.team_name} · {item.organization_name}</strong><Badge s={item.is_active ? "assigned" : "neutral"}>{item.is_active ? "Current assignment" : "Previous assignment"}</Badge></div><p className="mt-1 text-sm text-ink-soft">Leader: {item.leader_name} · Assigned by {item.assigned_by_name}</p><p className="mt-1 text-sm text-ink-soft">{new Date(item.assigned_at).toLocaleString()}{item.ended_at ? ` · ended ${new Date(item.ended_at).toLocaleString()}` : ""}</p>{item.assignment_note && <p className="mt-1">{item.assignment_note}</p>}</li>)}</ol> : <p className="text-sm text-ink-soft">No team assignment yet.</p>}</Card>
    <Card className="mt-5"><SectionTitle>Mission update history</SectionTitle>{mission.updates?.length ? <ol className="divide-y divide-line">{mission.updates.map((item) => <li key={item.id} className="py-3"><div className="flex flex-wrap justify-between gap-2"><strong>{item.action.replaceAll("_", " ")} · {statusLabel[item.status] || item.status}</strong><span className="text-sm text-ink-soft">{new Date(item.created_at).toLocaleString()}</span></div><p className="mt-1 text-sm text-ink-soft">Recorded by {item.actor_name}</p>{item.note && <p className="mt-1 whitespace-pre-wrap">{item.note}</p>}</li>)}</ol> : <p className="text-sm text-ink-soft">No updates recorded yet.</p>}</Card>
  </div>
}
