import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { api } from "./api"
import { useAuth } from "./auth"
import { useLanguage } from "./i18n"
import { Alert, Badge, Button, Card, Empty, Field, PageHead, SectionTitle, Select, Spinner, TextArea, Input } from "./ui"

const emptyTeam = { name: "", description: "", availability: "ready", capabilities: [], service_districts: [], service_upazilas: [] }
const displayName = (item, language) => language === "bn" ? item?.name_bn || item?.name_en : item?.name_en || item?.name_bn

export function LiveTeamList({ admin = false }) {
  const { activeOrganizationId } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  useEffect(() => {
    setLoading(true); setError("")
    const query = admin ? "" : activeOrganizationId ? `?organization=${activeOrganizationId}` : ""
    api(`/api/teams/${query}`).then(setRows).catch((requestError) => setError(requestError.message || "Could not load teams.")).finally(() => setLoading(false))
  }, [activeOrganizationId, admin])
  return <div className="mx-auto max-w-6xl">
    <PageHead title={admin ? "Response teams" : "Organization response teams"} sub={admin ? "Overview of teams in active approved organizations." : "Create teams from approved organization members and manage coverage."} action={!admin && <Button to="/org/teams/new">Create team</Button>} />
    {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
    {loading ? <Spinner /> : rows.length ? <div className="grid gap-4 lg:grid-cols-2">{rows.map((team) => <Card key={team.id}>
      <div className="flex items-start justify-between gap-3"><div><SectionTitle>{team.name}</SectionTitle><p className="text-sm text-ink-soft">{team.organization_name}</p></div><Badge s={team.availability} /></div>
      {team.description && <p className="mt-3">{team.description}</p>}
      <dl className="mt-4 grid gap-3 sm:grid-cols-2"><div><dt className="text-sm text-ink-soft">Service districts</dt><dd>{team.service_district_names?.join(", ") || "No service area set"}</dd></div><div><dt className="text-sm text-ink-soft">Capabilities</dt><dd>{team.capability_names?.join(", ") || "No capabilities set"}</dd></div></dl>
      <div className="mt-4 border-t border-line pt-3"><p className="text-sm text-ink-soft">Active members</p><p className="font-semibold">{team.memberships?.length ?? 0}</p>{team.memberships?.map((member) => <div key={member.id} className="mt-1 flex items-center justify-between gap-2 text-sm"><span>{member.volunteer_name}</span><span>{member.role === "leader" ? "Team leader" : "Member"}</span></div>)}</div>
      {!admin && <Button to={`/org/teams/${team.id}/edit`} variant="secondary" className="mt-4">Manage team</Button>}
    </Card>)}</div> : <Empty title="No teams yet" action={!admin && <Button to="/org/teams/new">Create your first team</Button>}>Teams become dispatch ready when an active approved organization has a leader, service area and matching capabilities.</Empty>}
  </div>
}

export function LiveTeamForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { activeOrganizationId } = useAuth()
  const { language } = useLanguage()
  const [team, setTeam] = useState(emptyTeam)
  const [districts, setDistricts] = useState([])
  const [categories, setCategories] = useState([])
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const currentId = id ? Number(id) : null
  const activeMembers = team.memberships ?? []
  const selectedDistricts = new Set(team.service_districts)
  const upazilas = districts.filter((row) => selectedDistricts.has(row.id)).flatMap((row) => row.upazilas ?? [])

  const load = async () => {
    if (!activeOrganizationId) { setLoading(false); setError("Choose an approved organization workspace first."); return }
    setLoading(true); setError("")
    try {
      const [districtData, categoryData, currentTeam] = await Promise.all([
        api("/api/locations/districts/"),
        api("/api/help-requests/assistance-categories/"),
        currentId ? api(`/api/teams/${currentId}/`) : Promise.resolve(null),
      ])
      setDistricts(districtData); setCategories(categoryData)
      if (currentTeam) setTeam({
        ...currentTeam,
        service_districts: currentTeam.service_districts ?? [],
        service_upazilas: currentTeam.service_upazilas ?? [],
        capabilities: currentTeam.capabilities ?? [],
        memberships: currentTeam.memberships ?? [],
      })
      else setTeam({ ...emptyTeam })
      setCandidates(await api(`/api/teams/eligible-members/?organization=${activeOrganizationId}`))
    } catch (requestError) { setError(requestError.message || "Could not load team setup data.") }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [currentId, activeOrganizationId])
  const setList = (field, value) => setTeam((current) => ({ ...current, [field]: current[field].includes(value) ? current[field].filter((item) => item !== value) : [...current[field], value] }))
  const toggleDistrict = (districtId) => {
    const removing = team.service_districts.includes(districtId)
    setTeam((current) => ({
      ...current,
      service_districts: removing ? current.service_districts.filter((value) => value !== districtId) : [...current.service_districts, districtId],
      service_upazilas: removing ? current.service_upazilas.filter((upazilaId) => !districts.find((row) => row.id === districtId)?.upazilas.some((upazila) => upazila.id === upazilaId)) : current.service_upazilas,
    }))
  }
  const saveTeam = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("")
    try {
      const payload = { ...team, organization: activeOrganizationId, name: team.name.trim(), description: team.description.trim() }
      const saved = await api(currentId ? `/api/teams/${currentId}/` : "/api/teams/", { method: currentId ? "PATCH" : "POST", body: payload })
      setTeam((current) => ({ ...current, ...saved, memberships: saved.memberships ?? current.memberships }))
      setSuccess("Team details saved.")
      if (!currentId) navigate(`/org/teams/${saved.id}/edit`, { replace: true })
    } catch (requestError) { setError(requestError.message || "Could not save this team.") }
    finally { setBusy(false) }
  }
  const addMember = async (volunteerId) => {
    setBusy(true); setError("")
    try { await api(`/api/teams/${currentId}/members/`, { method: "POST", body: { volunteer: volunteerId, role: "member" } }); await load(); setSuccess("Approved organization member added.") }
    catch (requestError) { setError(requestError.message || "Could not add member.") }
    finally { setBusy(false) }
  }
  const setLeader = async (volunteerId) => {
    setBusy(true); setError("")
    try { await api(`/api/teams/${currentId}/set-leader/`, { method: "POST", body: { volunteer: volunteerId } }); await load(); setSuccess("Team leader updated.") }
    catch (requestError) { setError(requestError.message || "Could not change team leader. Reassign active missions first.") }
    finally { setBusy(false) }
  }
  const removeMember = async (membershipId) => {
    setBusy(true); setError("")
    try { await api(`/api/team-memberships/${membershipId}/remove/`, { method: "POST", body: {} }); await load(); setSuccess("Team membership ended. History is retained.") }
    catch (requestError) { setError(requestError.message || "Could not remove member. Reassign active missions first.") }
    finally { setBusy(false) }
  }
  if (loading) return <div className="mx-auto max-w-4xl"><Spinner /></div>
  return <div className="mx-auto max-w-4xl">
    <PageHead title={currentId ? "Manage response team" : "Create response team"} sub="Teams can include active members of this approved organization only." />
    {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}{success && <div className="mb-4"><Alert kind="success">{success}</Alert></div>}
    <form onSubmit={saveTeam} className="space-y-6 rounded-2xl border border-line bg-white p-5 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Team name" required htmlFor="team-name"><Input id="team-name" required maxLength={160} value={team.name} onChange={(event) => setTeam((current) => ({ ...current, name: event.target.value }))} /></Field>
        <Field label="Availability" required htmlFor="team-availability"><Select id="team-availability" value={team.availability} onChange={(event) => setTeam((current) => ({ ...current, availability: event.target.value }))}><option value="ready">Ready</option><option value="limited">Limited capacity</option><option value="unavailable">Unavailable</option></Select></Field></div>
      <Field label="Description" htmlFor="team-description"><TextArea id="team-description" value={team.description} onChange={(event) => setTeam((current) => ({ ...current, description: event.target.value }))} /></Field>
      <fieldset><legend className="mb-2 font-semibold">Service districts</legend><div className="flex flex-wrap gap-2">{districts.map((item) => <label key={item.id} className={`flex min-h-10 cursor-pointer items-center rounded-full border px-3 ${team.service_districts.includes(item.id) ? "border-forest bg-mint text-forest" : "border-line"}`}><input type="checkbox" className="mr-2 accent-[#2e6b4f]" checked={team.service_districts.includes(item.id)} onChange={() => toggleDistrict(item.id)} />{displayName(item, language)}</label>)}</div></fieldset>
      <fieldset><legend className="mb-2 font-semibold">Service upazilas</legend><div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">{upazilas.map((item) => <label key={item.id} className={`flex min-h-10 cursor-pointer items-center rounded-full border px-3 ${team.service_upazilas.includes(item.id) ? "border-forest bg-mint text-forest" : "border-line"}`}><input type="checkbox" className="mr-2 accent-[#2e6b4f]" checked={team.service_upazilas.includes(item.id)} onChange={() => setList("service_upazilas", item.id)} />{displayName(item, language)}</label>)}{!upazilas.length && <p className="text-sm text-ink-soft">Choose service districts to show their upazilas.</p>}</div></fieldset>
      <fieldset><legend className="mb-2 font-semibold">Capabilities</legend><div className="flex flex-wrap gap-2">{categories.map((item) => <label key={item.id} className={`flex min-h-10 cursor-pointer items-center rounded-full border px-3 ${team.capabilities.includes(item.id) ? "border-forest bg-forest text-white" : "border-line"}`}><input type="checkbox" className="mr-2 accent-[#2e6b4f]" checked={team.capabilities.includes(item.id)} onChange={() => setList("capabilities", item.id)} />{displayName(item, language)}</label>)}</div></fieldset>
      <div className="flex flex-wrap justify-end gap-3"><Button to="/org/teams" variant="secondary">Back to teams</Button><Button type="submit" disabled={busy || !activeOrganizationId}>{busy ? "Saving…" : "Save team details"}</Button></div>
    </form>
    {currentId && <Card className="mt-5"><SectionTitle>Team membership and leader</SectionTitle>
      {activeMembers.length ? <div className="space-y-3">{activeMembers.map((member) => <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3"><div><p className="font-semibold">{member.volunteer_name}</p><p className="text-sm text-ink-soft">{member.role === "leader" ? "Team leader" : "Member"} · {member.volunteer_availability}</p></div><div className="flex flex-wrap gap-2">{member.role !== "leader" && <Button size="sm" variant="secondary" disabled={busy} onClick={() => setLeader(member.volunteer)}>Make leader</Button>}<Button size="sm" variant="danger" disabled={busy} onClick={() => removeMember(member.id)}>Remove</Button></div></div>)}</div> : <p className="text-sm text-ink-soft">Add active organization members below, then choose a leader.</p>}
      <div className="mt-5 border-t border-line pt-4"><p className="mb-3 font-semibold">Add an available organization member</p>{candidates.length ? <div className="flex flex-wrap gap-2">{candidates.map((person) => <Button key={person.volunteer} size="sm" variant="secondary" disabled={busy} onClick={() => addMember(person.volunteer)}>+ {person.volunteer_name}</Button>)}</div> : <p className="text-sm text-ink-soft">All active organization members are already on a team, or there are no active members to add.</p>}</div>
      <p className="mt-4 text-sm text-ink-soft">Changing a leader or removing a member is blocked while the team has an active mission. Reassign the mission first.</p>
    </Card>}
  </div>
}

export function LiveMyTeam() {
  const { language } = useLanguage()
  const [data, setData] = useState(null)
  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  useEffect(() => {
    Promise.all([api("/api/teams/mine/"), api("/api/missions/")])
      .then(([teamData, missionData]) => { setData(teamData); setMissions(missionData) })
      .catch((requestError) => setError(requestError.message || "Could not load your team."))
      .finally(() => setLoading(false))
  }, [])
  if (loading) return <Spinner />
  if (error) return <Alert kind="error">{error}</Alert>
  const team = data?.team
  return <div className="mx-auto max-w-5xl">
    <PageHead title="My team" sub="Your team and assigned response work come from the shared SHARA database." />
    {!team ? <Empty title="You are not on an active response team" action={<Button to="/volunteer/organization">View my organization</Button>}>An organization administrator can add you to a team after your organization membership is approved.</Empty> : <>
      <Card><div className="flex flex-wrap items-start justify-between gap-3"><div><SectionTitle>{team.name}</SectionTitle><p className="text-ink-soft">{team.organization_name}</p></div><Badge s={team.availability} /></div>
        <p className="mt-4">{team.description || "No team description has been added."}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2"><div><dt className="text-sm text-ink-soft">Service districts</dt><dd>{team.service_district_names?.join(", ") || "Not set"}</dd></div><div><dt className="text-sm text-ink-soft">Capabilities</dt><dd>{team.capability_names?.join(", ") || "Not set"}</dd></div></dl>
        <div className="mt-5"><SectionTitle>Team members</SectionTitle></div>
        <ul className="mt-2 divide-y divide-line">{team.memberships?.map((member) => <li key={member.id} className="flex justify-between gap-3 py-2"><span>{member.volunteer_name}</span><span className="text-sm text-ink-soft">{member.role === "leader" ? "Team leader" : "Member"}</span></li>)}</ul>
      </Card>
      <Card className="mt-5"><div className="flex items-center justify-between gap-3"><SectionTitle>Team missions</SectionTitle><Button to="/volunteer/missions" variant="secondary">View all missions</Button></div>
        {missions.length ? missions.slice(0, 5).map((mission) => <Link key={mission.id} to={`/volunteer/missions/${mission.id}`} className="mt-3 block rounded-xl border border-line p-4 hover:bg-mint"><div className="flex justify-between gap-3"><strong>{mission.help_request.request_code}</strong><Badge s={mission.status} /></div><p className="mt-2">{mission.help_request.upazila}, {mission.help_request.district} · {mission.help_request.assistance_categories.join(", ")}</p></Link>) : <p className="text-sm text-ink-soft">No mission has been assigned to this team.</p>}
      </Card>
    </>}
  </div>
}
