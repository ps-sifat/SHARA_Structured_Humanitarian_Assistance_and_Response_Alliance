import { useLanguage } from "./i18n"
import { matchesSearch } from "./locale"
import { useEffect, useState, type FormEvent } from "react"
import { useNavigate, useParams } from "react-router"
import { AID, DISTRICTS, bn } from "./data"
import {
  Alert,
  Badge,
  Button,
  Card,
  Choices,
  Dialog,
  Empty,
  Field,
  Input,
  MemberChoices,
  PageHead,
  SectionTitle,
  Select,
  TextArea,
} from "./ui"
import {
  account,
  active,
  labels,
  ORGANIZATION_TYPES,
  time,
  type Organization,
  type Team,
} from "./model"
import { act, uid, useDemo } from "./store"
import { ProfileImage, ProfileImageEditor } from "./ProfileImage"

export function OrgDashboard() {
  const { tr } = useLanguage()
  const s = useDemo(),
    a = account(s),
    org = s.organizations.find((o) => o.id === a?.orgId)!
  const teams = s.teams.filter((t) => t.orgId === org.id)
  const pending = s.memberships.filter(
    (m) => m.orgId === org.id && m.status === "pending",
  )
  return (
    <div className="mx-auto max-w-5xl">
      <PageHead
        title={org.name}
        sub={tr("সংগঠনের প্রশাসন পোর্টাল")}
        action={
          <Button to="/org/profile" variant="secondary">
            {tr("সংগঠনের প্রোফাইল")}</Button>
        }
      />
      <Alert
        kind={org.verification === "verified" ? "success" : "warn"}
        title={tr(labels[org.verification])}
      >
        {tr(org.verification === "verified"
          ? "সদস্য অনুমোদন, ছোট দল গঠন ও কার্যক্রম পর্যবেক্ষণ করতে পারবেন।"
          : "নিবন্ধন জমা হয়েছে। সুপার অ্যাডমিন অনুমোদনের আগে পরিচালনার সুবিধা বন্ধ থাকে।")}
        {org.reason && <p>{org.reason}</p>}
      </Alert>
      {org.verification === "verified" && (
        <>
          <div className="my-6 grid gap-4 sm:grid-cols-3">
            {[
              ["/org/memberships", "সদস্যপদ অপেক্ষমাণ", pending.length],
              ["/org/teams", "ছোট দল", teams.length],
              [
                "/org/missions",
                "সক্রিয় কার্যক্রম",
                s.missions.filter(
                  (m) => teams.some((t) => t.id === m.teamId) && active(m),
                ).length,
              ],
            ].map(([to, label, count]) => (
              <Card key={to}>
                <p>{tr(label)}</p>
                <p className="my-3 font-display text-3xl font-bold text-forest">
                  {tr(bn(count))}
                </p>
                <Button to={String(to)} variant="secondary">
                  {tr("দেখুন")}</Button>
              </Card>
            ))}
          </div>
          <Card>
            <SectionTitle>{tr("পরবর্তী করণীয়")}</SectionTitle>
            <div className="flex flex-wrap gap-3">
              <Button
                to={pending.length ? "/org/memberships" : "/org/teams/new"}
              >
                {tr(pending.length ? "সদস্যপদের অনুরোধ পর্যালোচনা" : "নতুন ছোট দল গঠন")}
              </Button>
              <Button to="/org/missions" variant="secondary">
                {tr("দলের কার্যক্রম পর্যবেক্ষণ")}</Button>
            </div>
            <p className="mt-4 text-sm text-ink-soft">
              {tr("দল dispatch করেন সুপার অ্যাডমিন। দলের নেতা কার্যক্রমের স্বীকৃতি ও অগ্রগতি দেন।")}</p>
          </Card>
        </>
      )}
    </div>
  )
}

export function OrgMemberships({
  volunteersOnly = false,
}: {
  volunteersOnly?: boolean
}) {
  const { tr } = useLanguage()
  const s = useDemo(),
    a = account(s),
    [q, setQ] = useState("")
  const [decision, setDecision] = useState<{
    id: string
    status: "approved" | "rejected"
  } | null>(null)
  const [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState("")
  const rows = s.memberships
    .filter(
      (m) =>
        m.orgId === a?.orgId &&
        (volunteersOnly ? m.status === "approved" : m.status !== "approved"),
    )
    .filter((m) =>
      matchesSearch(s.volunteers.find((v) => v.id === m.volunteerId)?.name ?? "", q),
    )
  return (
    <div className="mx-auto max-w-5xl">
      <PageHead
        title={tr(volunteersOnly ? "অনুমোদিত স্বেচ্ছাসেবক" : "সদস্যপদের অনুরোধ")}
        sub={tr("সংগঠনের অনুমোদিত সদস্যরাই ছোট দলে যোগ্য")}
      />
      {message && (
        <div className="mb-4">
          <Alert kind="success">{tr(message)}</Alert>
        </div>
      )}
      <Input
        aria-label={tr("সদস্য খুঁজুন")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={tr("নাম দিয়ে খুঁজুন")}
        className="mb-5"
      />
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((m) => {
          const v = s.volunteers.find((v) => v.id === m.volunteerId)!,
            t = s.teams.find((t) => t.memberIds.includes(v.id))
          return (
            <Card key={m.id}>
              <SectionTitle>{v.name}</SectionTitle>
              <p>
                {tr(v.upazila)}, {tr(v.district)}
              </p>
              <p className="mt-2">{tr(v.skills.join(", "))}</p>
              <p className="mt-2">{tr("ছোট দল: ")}{tr(t?.name ?? "বরাদ্দ নেই")}</p>
              <div className="my-3">
                <Badge s={m.status}>
                  {tr(m.status === "pending" ? "অনুরোধ অপেক্ষমাণ" : labels[m.status])}
                </Badge>
              </div>
              {m.reason && <p>{m.reason}</p>}
              <div className="flex flex-wrap gap-2">
                {m.status === "pending" && (
                  <Button
                    onClick={() => {
                      setError("")
                      setDecision({ id: m.id, status: "approved" })
                    }}
                  >
                    {tr("অনুমোদন")}</Button>
                )}
                {m.status !== "rejected" && (
                  <Button
                    variant="secondary"
                    disabled={!!t}
                    onClick={() => {
                      setReason("")
                      setError("")
                      setDecision({ id: m.id, status: "rejected" })
                    }}
                  >
                    {tr(volunteersOnly ? "সদস্যপদ অপসারণ" : "প্রত্যাখ্যান")}
                  </Button>
                )}
                {m.status === "approved" && !t && (
                  <Button to="/org/teams/new">{tr("দলে যুক্ত করুন")}</Button>
                )}
              </div>
              {t && (
                <p className="mt-3 text-sm text-ink-soft">
                  {tr("অপসারণের আগে দল সম্পাদনা করে সদস্যকে সরান। সক্রিয় কার্যক্রমে দল সম্পাদনা বন্ধ।")}</p>
              )}
            </Card>
          )
        })}
      </div>
      {!rows.length && (
        <Empty title={tr("কোনো সদস্য বা অনুরোধ নেই")}>{tr("নতুন অনুরোধ এলে এখানে দেখা যাবে।")}</Empty>
      )}
      <Dialog
        open={!!decision}
        onClose={() => setDecision(null)}
        title={
          tr(decision?.status === "approved"
            ? "সদস্যপদ অনুমোদন করবেন?"
            : "প্রত্যাখ্যান / অপসারণের কারণ")
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!decision) return
            const result = act({ type: "membership", ...decision, reason })
            setError(result.error)
            if (result.ok) {
              setDecision(null)
              setMessage("সদস্যপদ হালনাগাদ হয়েছে। স্বেচ্ছাসেবকের পোর্টালেও অবস্থা বদলেছে।")
            }
          }}
        >
          {error && <Alert kind="error">{tr(error)}</Alert>}
          {decision?.status === "rejected" ? (
            <Field label={tr("কারণ")} required htmlFor="membership-reason">
              <TextArea
                id="membership-reason"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          ) : (
            <p>
              {tr("অনুমোদন পেলে সদস্য ছোট দলে যোগ্য হবেন; স্বয়ংক্রিয়ভাবে দলে যুক্ত হবেন না।")}</p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDecision(null)}>
              {tr("বাতিল")}</Button>
            <Button type="submit">{tr("নিশ্চিত করুন")}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}

export function OrganizationProfile() {
  const { tr } = useLanguage()
  const s = useDemo(),
    a = account(s),
    org = s.organizations.find((o) => o.id === a?.orgId)!
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState<Organization>(org),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false)
  const [imageProcessing, setImageProcessing] = useState(false)
  return (
    <div className="mx-auto max-w-4xl">
      <PageHead
        title={tr("সংগঠনের প্রোফাইল")}
        action={
          <Button
            variant="secondary"
            onClick={() => {
              setDraft(org)
              setEditing(true)
            }}
          >
            {tr("প্রোফাইল সম্পাদনা")}</Button>
        }
      />
      {saved && <Alert kind="success">{tr("পরিবর্তন সংরক্ষিত হয়েছে।")}</Alert>}
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <ProfileImage value={org.profileImage} name={org.name} organization />
          <div>
            <SectionTitle>{org.name}</SectionTitle>
            <Badge s={org.verification} />
          </div>
        </div>
        <p className="mt-4">{org.description}</p>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {[
            ["ধরন", org.organizationType],
            ["প্রশাসক", s.accounts.find((x) => x.id === org.adminId)?.name],
            ["ইমেইল", org.contactEmail],
            ["ফোন", org.contactPhone],
            ["জেলা", org.areas.join(", ")],
            ["লোকেশন", org.locations.join(", ")],
            ["আইডি (read-only)", org.id],
            ["তৈরির সময় (read-only)", time(org.createdAt)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-ink-soft">{tr(label)}</dt>
              <dd className="break-words">{tr(value)}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        title={tr("সংগঠনের প্রোফাইল সম্পাদনা")}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (imageProcessing) return
            if (
              !draft.name.trim() ||
              !draft.description.trim() ||
              !draft.areas.length
            ) {
              setError("নাম, বিবরণ ও জেলা দিন।")
              return
            }
            const r = act({ type: "orgProfile", record: draft })
            setError(r.error)
            if (r.ok) {
              setEditing(false)
              setSaved(true)
            }
          }}
        >
          <Alert>
            {tr("যাচাই-অবস্থা, প্রশাসক সম্পর্ক, আইডি ও তৈরির সময় পরিবর্তন করা যাবে না।")}</Alert>
          {s.teams.some(team => team.orgId === org.id) && (
            <p className="text-sm">
              {tr("কোনো ছোট দলের ব্যবহৃত জেলা সরানোর আগে সেই দলের কার্যএলাকা পরিবর্তন করুন।")}</p>
          )}
          {error && <Alert kind="error">{tr(error)}</Alert>}
          <ProfileImageEditor
            value={draft.profileImage}
            name={draft.name}
            organization
            onChange={(profileImage) => setDraft((current) => ({ ...current, profileImage }))}
            onProcessingChange={setImageProcessing}
          />
          <Field label={tr("সংগঠনের নাম")} required htmlFor="edit-org-name">
            <Input
              id="edit-org-name"
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field label={tr("ধরন")} required htmlFor="edit-org-type">
            <Select
              id="edit-org-type"
              value={draft.organizationType}
              onChange={(e) =>
                setDraft({ ...draft, organizationType: e.target.value })
              }
            >
              {ORGANIZATION_TYPES.map((t) => (
                <option key={t} value={t}>{tr(t)}</option>
              ))}
            </Select>
          </Field>
          <Field label={tr("বিবরণ")} required htmlFor="edit-org-description">
            <TextArea
              id="edit-org-description"
              required
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
          </Field>
          <Field label={tr("ইমেইল")} required htmlFor="edit-org-email">
            <Input
              id="edit-org-email"
              required
              type="email"
              value={draft.contactEmail}
              onChange={(e) =>
                setDraft({ ...draft, contactEmail: e.target.value })
              }
            />
          </Field>
          <Field label={tr("ফোন")} required htmlFor="edit-org-phone">
            <Input
              id="edit-org-phone"
              required
              value={draft.contactPhone}
              onChange={(e) =>
                setDraft({ ...draft, contactPhone: e.target.value })
              }
            />
          </Field>
          <Choices
            label={tr("কার্যপরিচালনার জেলা")}
            options={DISTRICTS}
            value={draft.areas}
            onChange={(areas) => setDraft({ ...draft, areas })}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setEditing(false)}>
              {tr("বাতিল")}</Button>
            <Button type="submit" disabled={imageProcessing}>{tr("সংরক্ষণ")}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}

export function TeamList({ admin = false }: { admin?: boolean }) {
  const { tr } = useLanguage()
  const s = useDemo(),
    a = account(s),
    [q, setQ] = useState("")
  const teams = s.teams.filter(
    (t) =>
      (admin || t.orgId === a?.orgId) &&
      matchesSearch(`${t.name} ${t.areas.join(", ")}`, q),
  )
  return (
    <div className="mx-auto max-w-5xl">
      <PageHead
        title={tr(admin ? "দল ও প্রাপ্যতা" : "ছোট দলসমূহ")}
        sub={tr("সদস্যপদ, সক্ষমতা ও বর্তমান কাজের অবস্থা")}
        action={
          !admin ? (
            <Button to="/org/teams/new">{tr("নতুন ছোট দল গঠন")}</Button>
          ) : undefined
        }
      />
      <Input
        aria-label={tr("দল খুঁজুন")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={tr("দল বা এলাকা দিয়ে খুঁজুন")}
        className="mb-5"
      />
      <div className="grid gap-4 md:grid-cols-2">
        {teams.map((t) => {
          const busy = s.missions.some((m) => m.teamId === t.id && active(m))
          return (
            <Card key={t.id}>
              <SectionTitle>{t.name}</SectionTitle>
              <p>{s.organizations.find((o) => o.id === t.orgId)?.name}</p>
              <p className="mt-2">{tr("এলাকা: ")}{tr(t.areas.join(", "))}</p>
              <p className="mt-2">{tr("সক্ষমতা: ")}{tr(t.capabilities.join(", "))}</p>
              <p className="mt-2">
                {tr("নেতা: ")}{s.volunteers.find((v) => v.id === t.leaderId)?.name} {tr(" · সদস্য ")}{tr(bn(t.memberIds.length))} {tr(" জন")}</p>
              <div className="mt-3">
                <Badge s={busy ? "ongoing" : t.availability}>
                  {tr(busy ? "সক্রিয় কার্যক্রমে ব্যস্ত" : labels[t.availability])}
                </Badge>
              </div>
              {!admin && (
                <Button
                  to={`/org/teams/${t.id}/edit`}
                  className="mt-4"
                  variant="secondary"
                >
                  {tr("দল দেখুন / সম্পাদনা")}</Button>
              )}
            </Card>
          )
        })}
      </div>
      {!teams.length && (
        <Empty
          title={tr("এখনো কোনো ছোট দল নেই")}
          action={
            !admin ? <Button to="/org/teams/new">{tr("ছোট দল গঠন")}</Button> : undefined
          }
        >
          {tr("অনুমোদিত সদস্যদের নিয়ে দল তৈরি করুন।")}</Empty>
      )}
    </div>
  )
}

export function TeamForm() {
  const { tr } = useLanguage()
  const s = useDemo(),
    a = account(s)!,
    { id } = useParams(),
    nav = useNavigate()
  const original = s.teams.find((t) => t.id === id)
  const [draft, setDraft] = useState<Team>(
    original ?? {
      id: uid("t"),
      orgId: a.orgId!,
      name: "",
      areas: [],
      memberIds: [],
      leaderId: "",
      availability: "ready",
      capabilities: [],
    },
  )
  const [error, setError] = useState("")
  useEffect(() => {
    if (error) document.getElementById("team-form-errors")?.focus()
  }, [error])
  if (id && (!original || original.orgId !== a.orgId))
    return (
      <Empty
        title={tr("দল পাওয়া যায়নি বা প্রবেশাধিকার নেই")}
        action={<Button to="/org/teams">{tr("দলের তালিকা")}</Button>}
      />
    )
  const locked = s.missions.some((m) => m.teamId === draft.id && active(m))
  const members = s.volunteers.filter(
    (v) =>
      s.memberships.some(
        (m) =>
          m.orgId === a.orgId &&
          m.volunteerId === v.id &&
          m.status === "approved",
      ) &&
      !s.teams.some((t) => t.id !== draft.id && t.memberIds.includes(v.id)),
  )
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const result = act({ type: "team", record: draft })
    setError(result.error)
    if (result.ok) nav("/org/teams")
  }
  return (
    <div className="mx-auto max-w-3xl">
      <PageHead
        title={tr(id ? "ছোট দল দেখুন / সম্পাদনা" : "নতুন ছোট দল গঠন")}
        sub={tr("নেতা অবশ্যই নির্বাচিত অনুমোদিত সদস্যদের একজন হবেন")}
      />
      {locked && (
        <Alert kind="warn">
          {tr("সক্রিয় কার্যক্রম থাকায় সম্পাদনা বন্ধ। আগে কার্যক্রম শেষ করুন।")}</Alert>
      )}
      <form
        onSubmit={submit}
        className="mt-4 space-y-5 rounded-2xl border border-line bg-white p-5 sm:p-8"
      >
        {error && (
          <div id="team-form-errors" tabIndex={-1}>
            <Alert kind="error">{tr(error)}</Alert>
          </div>
        )}
        <fieldset disabled={locked} className="space-y-5 disabled:opacity-70">
          <Field label={tr("দলের নাম")} required htmlFor="team-name">
            <Input
              id="team-name"
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Choices
            label={tr("কার্যপরিচালনার জেলা (অন্তত একটি)")}
            options={s.organizations.find((o) => o.id === a.orgId)?.areas ?? []}
            value={draft.areas}
            onChange={(areas) => setDraft({ ...draft, areas })}
          />
          <MemberChoices
            options={members}
            value={draft.memberIds}
            onChange={(ids) => {
              setDraft({
                ...draft,
                memberIds: ids,
                leaderId: ids.includes(draft.leaderId) ? draft.leaderId : "",
              })
            }}
          />
          {!members.length && (
            <Alert kind="warn">
              {tr("সদস্য নেই। আগে সদস্যপদ অনুমোদন করুন। অন্য দলে থাকা সদস্য এখানে যোগ করা যায় না।")}</Alert>
          )}
          <Field label={tr("দলনেতা")} required htmlFor="team-leader">
            <Select
              id="team-leader"
              required
              value={draft.leaderId}
              onChange={(e) => setDraft({ ...draft, leaderId: e.target.value })}
            >
              <option value="">{tr("সদস্যদের মধ্য থেকে নেতা বেছে নিন")}</option>
              {members
                .filter((v) => draft.memberIds.includes(v.id))
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label={tr("দলের প্রাপ্যতা")} required htmlFor="team-availability">
            <Select
              id="team-availability"
              value={draft.availability}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  availability: e.target.value as Team["availability"],
                })
              }
            >
              {["ready", "limited", "unavailable"].map((v) => (
                <option key={v} value={v}>
                  {tr(labels[v])}
                </option>
              ))}
            </Select>
          </Field>
          <Choices
            label={tr("সহায়তা প্রদানের সক্ষমতা")}
            options={AID}
            value={draft.capabilities}
            onChange={(capabilities) => setDraft({ ...draft, capabilities })}
          />
        </fieldset>
        <div className="flex flex-wrap justify-end gap-3">
          <Button to="/org/teams" variant="secondary">
            {tr("তালিকায় ফিরুন")}</Button>
          <Button type="submit" disabled={locked}>
            {tr("দল সংরক্ষণ")}</Button>
        </div>
      </form>
    </div>
  )
}
