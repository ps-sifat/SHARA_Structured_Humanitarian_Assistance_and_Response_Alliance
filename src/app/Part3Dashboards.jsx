import { useEffect, useState } from "react"
import { api } from "./api"
import { useAuth } from "./auth"
import { Alert, Badge, Button, Card, PageHead, SectionTitle, Spinner } from "./ui"

export function LiveVolunteerDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  useEffect(() => {
    Promise.all([api("/api/profile/"), api("/api/memberships/mine/"), api("/api/membership-requests/mine/"), api("/api/teams/mine/"), api("/api/missions/")])
      .then(([profile, memberships, membershipRequests, team, missions]) => setData({ profile, memberships, membershipRequests, team, missions }))
      .catch((requestError) => setError(requestError.message || "Could not load dashboard data."))
  }, [])
  if (!data && !error) return <Spinner />
  const membership = data?.memberships.find((item) => item.status === "active")
  const pending = data?.membershipRequests.find((item) => item.status === "pending")
  const profile = data?.profile
  const activeMissionCount = data?.missions.filter((mission) => !["done", "cancelled", "failed"].includes(mission.status)).length ?? 0
  return <div className="mx-auto max-w-5xl">
    <PageHead title={`Welcome, ${user?.name ?? "volunteer"}`} sub="Your profile, team, and mission updates come from the shared response records." action={<Button to="/volunteer/profile/edit">Edit profile</Button>} />
    {error && <Alert kind="error">{error}</Alert>}
    {profile && <div className="grid gap-5 md:grid-cols-2">
      <Card><SectionTitle>{profile.user.name}</SectionTitle><p className="mt-2 text-ink-soft">{profile.upazila_name_bn}, {profile.district_name_bn}</p><div className="mt-4 flex flex-wrap gap-2">{profile.skills.map((skill) => <Badge key={skill.id} s="verified" dot={false}>{skill.name}</Badge>)}</div><p className="mt-4">Availability: {profile.availability}</p><Button to="/volunteer/profile/edit" variant="secondary" className="mt-4">Update availability and skills</Button></Card>
      <Card><SectionTitle>Organization and team</SectionTitle>{membership ? <Alert kind="success" title={membership.organization_name}>Your organization membership is active. Team membership is managed separately.</Alert> : pending ? <Alert kind="warn" title={pending.organization_name}>Your organization membership request is waiting for approval.</Alert> : <Alert>No active organization membership yet.</Alert>}<div className="mt-4 flex flex-wrap gap-3"><Button to={membership || pending ? "/volunteer/organization" : "/volunteer/organizations"} variant="secondary">{membership || pending ? "View my organization" : "Find an organization"}</Button><Button to="/volunteer/team" variant="ghost">My team</Button></div>{data.team?.team && <p className="mt-4 font-semibold">Team: {data.team.team.name}</p>}</Card>
      <Card><SectionTitle>My missions</SectionTitle><p className="my-3 font-display text-3xl font-bold text-forest">{activeMissionCount}</p><p className="text-ink-soft">Active missions visible to your team.</p><Button to="/volunteer/missions" className="mt-4">Open missions</Button></Card>
      <Card><SectionTitle>Mission summary</SectionTitle>{data.missions.slice(0, 3).length ? data.missions.slice(0, 3).map((mission) => <div key={mission.id} className="flex items-center justify-between gap-3 border-t border-line py-3"><span>{mission.help_request.request_code}</span><Badge s={mission.status} /></div>) : <p className="text-ink-soft">Your team has no assigned missions.</p>}<Button to="/volunteer/missions" variant="secondary" className="mt-3">View all</Button></Card>
    </div>}
  </div>
}

export function LiveOrganizationDashboard() {
  const { activeOrganizationId, user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  useEffect(() => {
    if (!activeOrganizationId) return
    Promise.all([api(`/api/organizations/${activeOrganizationId}/`), api(`/api/organizations/${activeOrganizationId}/membership-requests/`), api(`/api/organizations/${activeOrganizationId}/memberships/`), api(`/api/teams/?organization=${activeOrganizationId}`), api("/api/missions/")])
      .then(([organization, requests, memberships, teams, missions]) => setData({ organization, requests, memberships, teams, missions }))
      .catch((requestError) => setError(requestError.message || "Could not load organization dashboard."))
  }, [activeOrganizationId])
  if (!data && !error) return <Spinner />
  const activeMembers = data?.memberships.filter((item) => item.status === "active") ?? []
  const pending = data?.requests.filter((item) => item.status === "pending").length ?? 0
  const activeMissions = data?.missions.filter((mission) => !["done", "cancelled", "failed"].includes(mission.status)).length ?? 0
  return <div className="mx-auto max-w-6xl">
    {data && <PageHead title={data.organization.name} sub={`Welcome, ${user?.name ?? "organization administrator"} · response operations`} action={<Button to="/org/profile" variant="secondary">Organization profile</Button>} />}
    {error && <Alert kind="error">{error}</Alert>}
    {data && <>
      <Alert kind="success" title="Approved organization">Your team, coverage, and mission updates are backed by the current database.</Alert>
      <div className="my-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><p className="text-sm text-ink-soft">Pending membership requests</p><p className="my-2 font-display text-3xl font-bold text-forest">{pending}</p><Button to="/org/memberships" variant="secondary">Review requests</Button></Card>
        <Card><p className="text-sm text-ink-soft">Active organization members</p><p className="my-2 font-display text-3xl font-bold text-forest">{activeMembers.length}</p><Button to="/org/volunteers" variant="secondary">View members</Button></Card>
        <Card><p className="text-sm text-ink-soft">Response teams</p><p className="my-2 font-display text-3xl font-bold text-forest">{data.teams.length}</p><Button to="/org/teams" variant="secondary">Manage teams</Button></Card>
        <Card><p className="text-sm text-ink-soft">Active missions</p><p className="my-2 font-display text-3xl font-bold text-forest">{activeMissions}</p><Button to="/org/missions" variant="secondary">Open missions</Button></Card>
      </div>
      <Card><SectionTitle>Current mission updates</SectionTitle>{data.missions.slice(0, 5).length ? data.missions.slice(0, 5).map((mission) => <div key={mission.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3"><div><p className="font-semibold">{mission.help_request.request_code} · {mission.help_request.upazila}</p><p className="text-sm text-ink-soft">{mission.help_request.assistance_categories.join(", ")}</p></div><div className="flex items-center gap-3"><Badge s={mission.status} /><Button to={`/org/missions/${mission.id}`} size="sm" variant="ghost">Open</Button></div></div>) : <p className="text-ink-soft">No missions are assigned to this organization.</p>}</Card>
    </>}
  </div>
}

export function LiveAdminDashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  useEffect(() => {
    Promise.all([api("/api/help-requests/?verification=pending"), api("/api/help-requests/?verification=verified"), api("/api/missions/"), api("/api/teams/"), api("/api/organizations/review-queue/")])
      .then(([pendingRequests, verifiedRequests, missions, teams, organizations]) => setData({ pendingRequests, verifiedRequests, missions, teams, organizations }))
      .catch((requestError) => setError(requestError.message || "Could not load administrator dashboard."))
  }, [])
  if (!data && !error) return <Spinner />
  const waiting = data?.verifiedRequests.filter((request) => {
    const mission = data.missions.find((item) => item.help_request.request_code === request.request_code)
    return !mission || ["awaiting_assignment", "failed"].includes(mission.status)
  }).length ?? 0
  const awaitingAck = data?.missions.filter((mission) => mission.status === "assigned").length ?? 0
  const needsAttention = data?.missions.filter((mission) => mission.status === "problem").length ?? 0
  return <div className="mx-auto max-w-6xl">
    <PageHead title="Super Admin operations" sub="Review, team dispatch and mission counts use the same request and mission records." />
    {error && <Alert kind="error">{error}</Alert>}
    {data && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card><p className="text-sm text-ink-soft">Requests awaiting review</p><p className="my-2 font-display text-3xl font-bold text-forest">{data.pendingRequests.length}</p><Button to="/admin/requests?verification=pending" size="sm">Review requests</Button></Card>
        <Card><p className="text-sm text-ink-soft">Verified, awaiting assignment</p><p className="my-2 font-display text-3xl font-bold text-forest">{waiting}</p><Button to="/admin/requests?verification=verified" size="sm" variant="secondary">Dispatch</Button></Card>
        <Card><p className="text-sm text-ink-soft">Awaiting acknowledgement</p><p className="my-2 font-display text-3xl font-bold text-forest">{awaitingAck}</p><Button to="/admin/missions?status=assigned" size="sm" variant="secondary">Monitor</Button></Card>
        <Card><p className="text-sm text-ink-soft">Mission issues</p><p className="my-2 font-display text-3xl font-bold text-forest">{needsAttention}</p><Button to="/admin/missions?status=problem" size="sm" variant="secondary">Review issues</Button></Card>
        <Card><p className="text-sm text-ink-soft">Organizations awaiting review</p><p className="my-2 font-display text-3xl font-bold text-forest">{data.organizations.length}</p><Button to="/admin/organizations" size="sm" variant="secondary">Review organizations</Button></Card>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2"><Card><SectionTitle>Operational records</SectionTitle><dl className="grid grid-cols-2 gap-4"><div><dt className="text-sm text-ink-soft">Teams</dt><dd className="font-display text-2xl font-bold text-forest">{data.teams.length}</dd></div><div><dt className="text-sm text-ink-soft">Missions</dt><dd className="font-display text-2xl font-bold text-forest">{data.missions.length}</dd></div></dl></Card><Card><SectionTitle>Recent missions</SectionTitle>{data.missions.slice(0, 3).map((mission) => <div key={mission.id} className="flex items-center justify-between gap-3 border-t border-line py-3"><span>{mission.help_request.request_code}</span><div className="flex items-center gap-2"><Badge s={mission.status} /><Button to={`/admin/missions/${mission.id}`} size="sm" variant="ghost">Open</Button></div></div>)}</Card></div>
    </>}
  </div>
}
