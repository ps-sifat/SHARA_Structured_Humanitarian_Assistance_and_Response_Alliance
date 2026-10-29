import { useEffect, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import { api } from "./api"
import { Alert, Badge, Button, Card, Empty, Field, PageHead, SectionTitle, Select, Spinner, TextArea } from "./ui"

function categoryNames(row) {
  return (row.assistance_categories ?? []).map((item) => typeof item === "string" ? item : item.name_en || item.name_bn).join(", ")
}

export function LiveRequestQueue() {
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState("")
  const filter = params.get("verification") ?? "all"
  useEffect(() => {
    setBusy(true); setError("")
    api(`/api/help-requests/${filter === "all" ? "" : `?verification=${encodeURIComponent(filter)}`}`)
      .then(setRows).catch((requestError) => setError(requestError.message || "Could not load request queue."))
      .finally(() => setBusy(false))
  }, [filter])
  return <div className="mx-auto max-w-6xl">
    <PageHead title="Help request review" sub="Protected details are available only on the administrator review page." />
    <Card className="mb-5"><Field label="Verification status" htmlFor="request-filter"><Select id="request-filter" value={filter} onChange={(event) => setParams(event.target.value === "all" ? {} : { verification: event.target.value })}><option value="all">All requests</option><option value="pending">Pending review</option><option value="clarification">Clarification needed</option><option value="verified">Verified</option><option value="rejected">Rejected</option></Select></Field></Card>
    {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
    {busy ? <Spinner /> : rows.length ? <div className="grid gap-4 lg:grid-cols-2">{rows.map((row) => <Card key={row.id}>
      <div className="flex items-start justify-between gap-3"><SectionTitle>{row.request_code}</SectionTitle><Badge s={row.verification_status} /></div>
      <p className="mt-2 text-lg font-bold text-forest">{categoryNames(row)}</p>
      <p className="mt-2">{row.upazila_name}, {row.district_name}</p>
      <p className="mt-1 text-sm text-ink-soft">{row.people_affected} people · {row.reporter_type === "proxy" ? "Proxy request" : "Direct request"}</p>
      {row.risks?.length > 0 && <p className="mt-2 text-sm text-alert">Risk indicators: {row.risks.join(", ")}</p>}
      <Button to={`/admin/requests/${row.id}`} variant="secondary" className="mt-4">Review protected details</Button>
    </Card>)}</div> : <Empty title="No requests in this view">New public requests will appear here.</Empty>}
  </div>
}

export function LiveRequestDetail() {
  const { id } = useParams()
  const [record, setRecord] = useState(null)
  const [teams, setTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const load = async () => {
    setLoading(true); setError("")
    try {
      const row = await api(`/api/help-requests/${id}/`)
      setRecord(row)
      if (row.verification_status === "verified") setTeams(await api(`/api/help-requests/${id}/eligible-teams/`))
      else setTeams([])
    } catch (requestError) { setError(requestError.message || "Could not load this request.") }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [id])

  const review = async (action, body = {}) => {
    setBusy(true); setError(""); setSuccess("")
    try {
      const updated = await api(`/api/help-requests/${id}/${action}/`, { method: "POST", body })
      setRecord(updated)
      setReason("")
      if (updated.verification_status === "verified") setTeams(await api(`/api/help-requests/${id}/eligible-teams/`))
      else setTeams([])
      setSuccess(action === "resolve-clarification" ? "Clarification marked reviewed. Continue verification when ready." : "Request review updated.")
    } catch (requestError) { setError(requestError.message || "Could not update request review.") }
    finally { setBusy(false) }
  }

  const assign = async () => {
    if (!record?.mission_id || !selectedTeam) return
    setBusy(true); setError(""); setSuccess("")
    try {
      await api(`/api/missions/${record.mission_id}/transition/`, { method: "POST", body: { action: "assign", team_id: Number(selectedTeam), reason: reason.trim() } })
      setSuccess("Team assigned. Mission status and history are now available in all authorized portals.")
      setReason(""); await load()
    } catch (requestError) { setError(requestError.message || "Could not assign this team.") }
    finally { setBusy(false) }
  }

  if (loading) return <div className="mx-auto max-w-5xl"><Spinner /></div>
  if (!record) return <div className="mx-auto max-w-5xl"><Alert kind="error">{error || "Request not found."}</Alert><Button to="/admin/requests" variant="secondary" className="mt-4">Back to review queue</Button></div>
  const clarificationPending = record.clarifications?.find((item) => item.status === "submitted")
  const missionTerminal = ["done", "cancelled"].includes(record.mission_status)
  return <div className="mx-auto max-w-5xl">
    <Button to="/admin/requests" variant="ghost" className="mb-4">← Review queue</Button>
    <PageHead title={`Request ${record.request_code}`} sub="Personal contact details are shown only in this protected Super Admin view." action={<Badge s={record.verification_status} />} />
    {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}{success && <div className="mb-4"><Alert kind="success">{success}</Alert></div>}
    <div className="grid gap-5 md:grid-cols-2">
      <Card><SectionTitle>Request details</SectionTitle><dl className="space-y-3">
        <div><dt className="text-sm text-ink-soft">Affected person</dt><dd>{record.affected_person_name || "Not provided"}</dd></div>
        {record.reporter_type === "proxy" && <><div><dt className="text-sm text-ink-soft">Applicant</dt><dd>{record.reporter_name} · {record.relation_to_affected}</dd></div><div><dt className="text-sm text-ink-soft">Applicant phone</dt><dd>{record.reporter_phone}</dd></div></>}
        <div><dt className="text-sm text-ink-soft">Contact phone</dt><dd>{record.contact_phone}</dd></div>
        <div><dt className="text-sm text-ink-soft">Area and people</dt><dd>{record.upazila_name}, {record.district_name} · {record.people_affected} people</dd></div>
        <div><dt className="text-sm text-ink-soft">Assistance requested</dt><dd>{categoryNames(record)}</dd></div>
        <div><dt className="text-sm text-ink-soft">Description</dt><dd className="whitespace-pre-wrap">{record.description || "No description provided."}</dd></div>
        {record.risks?.length > 0 && <div><dt className="text-sm text-ink-soft">Risk indicators</dt><dd>{record.risks.join(", ")}</dd></div>}
      </dl></Card>
      <Card><SectionTitle>Review action</SectionTitle>
        {record.review_note && <Alert kind={record.verification_status === "rejected" ? "error" : "info"} title="Latest review note">{record.review_note}</Alert>}
        {record.verification_status === "pending" && <div className="mt-4 grid gap-3">
          <Button disabled={busy} onClick={() => review("verify")}>Verify request</Button>
          <Field label="Reason for rejection or clarification" required htmlFor="review-reason"><TextArea id="review-reason" required value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
          <div className="flex flex-wrap gap-3"><Button variant="danger" disabled={busy || !reason.trim()} onClick={() => review("reject", { reason })}>Reject with reason</Button><Button variant="secondary" disabled={busy || !reason.trim()} onClick={() => review("clarify", { reason })}>Request clarification</Button></div>
        </div>}
        {record.verification_status === "clarification" && <p className="mt-4 text-sm text-ink-soft">Waiting for the applicant to respond through private tracking access.</p>}
        {clarificationPending && <div className="mt-4 rounded-xl border border-line bg-paper p-4"><p className="font-semibold">Applicant response</p><p className="mt-2 whitespace-pre-wrap">{clarificationPending.applicant_message}</p><div className="mt-3"><Field label="Review note" required htmlFor="clarification-review"><TextArea id="clarification-review" value={reason} onChange={(event) => setReason(event.target.value)} /></Field></div><Button className="mt-3" disabled={busy || !reason.trim()} onClick={() => review("resolve-clarification", { reason })}>Mark clarification reviewed</Button></div>}
        {record.verification_status === "verified" && <div className="mt-4"><Alert kind="success" title="Verified">Mission status: {record.mission_id ? "awaiting assignment or assigned" : "not created"}. Verification remains separate from mission progress.</Alert></div>}
        {record.verification_status === "rejected" && <div className="mt-4"><Badge s="rejected">Rejected</Badge></div>}
      </Card>
    </div>
    {record.verification_status === "verified" && record.mission_id && !missionTerminal && <Card className="mt-5">
      <SectionTitle>Eligible team selection</SectionTitle>
      <p className="mb-4 text-sm text-ink-soft">Eligibility follows area, availability, category capability, active workload, leadership, and organization approval. Reasons are deterministic rules, not AI recommendations.</p>
      {teams.length ? <div className="space-y-3">{teams.map((team) => <label key={team.id} className={`block rounded-xl border p-4 ${Number(selectedTeam) === team.id ? "border-forest bg-mint/40" : "border-line"}`}>
        <span className="flex items-start gap-3"><input type="radio" name="eligible-team" className="mt-1 accent-[#2e6b4f]" value={team.id} checked={Number(selectedTeam) === team.id} onChange={() => setSelectedTeam(String(team.id))} /><span className="flex-1"><span className="flex flex-wrap items-center justify-between gap-2 font-semibold">{team.name} · {team.organization_name}<Badge s={team.availability} /></span><span className="mt-2 block text-sm text-ink-soft">Match score: {team.score} · {team.reasons.join(" ")}</span></span></span>
      </label>)}
      <Field label="Assignment note" htmlFor="assignment-reason"><TextArea id="assignment-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Optional note" /></Field>
      <Button className="mt-3" disabled={busy || !selectedTeam} onClick={assign}>Assign selected team</Button>
      </div> : <Empty title="No eligible team is ready">The request remains awaiting assignment until an active approved team matches the rules.</Empty>}
      <Button to={`/admin/missions/${record.mission_id}`} variant="ghost" className="mt-4">Open mission history</Button>
    </Card>}
    {record.clarifications?.length > 0 && <Card className="mt-5"><SectionTitle>Clarification history</SectionTitle><ol className="space-y-4">{record.clarifications.map((item) => <li key={item.id} className="border-t border-line pt-3"><div className="flex flex-wrap justify-between gap-2"><strong>{item.status}</strong><span className="text-sm text-ink-soft">{new Date(item.created_at).toLocaleString()}</span></div><p className="mt-2">Requested: {item.request_note}</p>{item.applicant_message && <p className="mt-1">Applicant: {item.applicant_message}</p>}{item.review_note && <p className="mt-1 text-sm text-ink-soft">Review note: {item.review_note}</p>}</li>)}</ol></Card>}
  </div>
}
