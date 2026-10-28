import { useLanguage } from "./i18n"
import { useState } from "react"
import { useParams, useSearchParams } from "react-router"
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  Empty,
  Field,
  PageHead,
  SectionTitle,
  Select,
  Stepper,
  TextArea,
} from "./ui"
import {
  account,
  active,
  canViewMission,
  labels,
  missionStage,
  time,
  type MissionStatus,
} from "./model"
import { act, useDemo } from "./store"

export function MissionList() {
  const { tr } = useLanguage()
  const s = useDemo(),
    a = account(s)!,
    [params, setParams] = useSearchParams()
  const filter = params.get("status") ?? "all"
  const list = s.missions.filter(
    (m) =>
      canViewMission(s, m) &&
      (filter === "all" ||
        (filter === "active" ? active(m) : filter === "history" ? !active(m) : m.status === filter)),
  )
  return (
    <div className="mx-auto max-w-5xl">
      <PageHead
        title={tr(a.role === "volunteer" ? "আমার দলের কার্যক্রম" : "কার্যক্রমসমূহ")}
        sub={tr("বর্তমান কাজ ও পূর্ববর্তী কার্যক্রম একই তালিকায়")}
      />
      <Select
        aria-label={tr("কার্যক্রম ফিল্টার")}
        value={filter}
        onChange={(e) =>
          setParams(e.target.value === "all" ? {} : { status: e.target.value })
        }
        className="mb-5 sm:max-w-xs"
      >
        <option value="all">{tr("সব কার্যক্রম")}</option>
        <option value="active">{tr("সক্রিয়")}</option>
        <option value="history">{tr("ইতিহাস")}</option>
        <option value="assigned">{tr("নেতার স্বীকৃতি বাকি")}</option>
        <option value="problem">{tr("সমস্যা জানানো হয়েছে")}</option>
      </Select>
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((m) => {
          const r = s.requests.find((r) => r.id === m.requestId)!,
            t = s.teams.find((t) => t.id === m.teamId)!
          return (
            <Card key={m.id}>
              <SectionTitle>{tr(m.id)}</SectionTitle>
              <p>
                {tr(r.aid.join(", "))} · {tr(r.upazila)}, {tr(r.district)}
              </p>
              <p className="mt-2">{t.name}</p>
              <div className="mt-3">
                <Badge s={m.status} />
              </div>
              <p className="mt-3 text-sm text-ink-soft">
                {tr("সর্বশেষ: ")}{tr(time(m.updatedAt))}
              </p>
              <Button
                to={`/${a.role}/missions/${m.id}?list=${filter}`}
                className="mt-4"
                variant="secondary"
              >
                {tr("কার্যক্রম দেখুন")}</Button>
            </Card>
          )
        })}
      </div>
      {!list.length && (
        <Empty
          title={tr("কোনো কার্যক্রম নেই")}
          action={<Button to={`/${a.role}`}>{tr("ড্যাশবোর্ডে ফিরুন")}</Button>}
        >
          {tr("সুপার অ্যাডমিন দল নির্ধারণের পর কার্যক্রম এখানে দেখা যাবে।")}</Empty>
      )}
    </div>
  )
}

export function MissionDetail() {
  const { tr } = useLanguage()
  const s = useDemo(),
    a = account(s)!,
    { id } = useParams(),
    [params] = useSearchParams()
  const m = s.missions.find((m) => m.id === id)
  const [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("")
  const [confirm, setConfirm] = useState<MissionStatus | null>(null)
  if (!m || !canViewMission(s, m))
    return (
      <Empty
        title={tr("কার্যক্রম পাওয়া যায়নি বা প্রবেশাধিকার নেই")}
        action={<Button to={`/${a.role}/missions`}>{tr("নিজের কার্যক্রমে ফিরুন")}</Button>}
      >
        {tr("শুধু সংশ্লিষ্ট দলের সদস্য, সংগঠন প্রশাসক ও সুপার অ্যাডমিন দেখতে পারেন।")}</Empty>
    )
  const t = s.teams.find((t) => t.id === m.teamId)!,
    r = s.requests.find((r) => r.id === m.requestId)!
  const leader = a.role === "volunteer" && t.leaderId === a.volunteerId
  const order = ["assigned", "acknowledged", "ongoing", "done"]
  const stage = missionStage(m)
  const needsNote = !!confirm && (
    ["done", "problem", "cancelled", "failed"].includes(confirm) ||
    m.status === "problem" ||
    m.status === confirm
  )
  const update = () => {
    if (!confirm) return
    const result = act({ type: "mission", id: m.id, status: confirm, note })
    setError(result.error)
    if (result.ok) {
      setConfirm(null)
      setNote("")
      setSuccess("কার্যক্রম হালনাগাদ হয়েছে। সব সংশ্লিষ্ট পোর্টাল ও ট্র্যাকিংয়ে অবস্থা বদলেছে।")
    }
  }
  return (
    <div className="mx-auto max-w-5xl">
      <Button to={`/${a.role}/missions?status=${encodeURIComponent(params.get('list') ?? 'all')}`} variant="ghost" className="mb-4">
        {tr("কার্যক্রমের তালিকায় ফিরুন")}</Button>
      <PageHead
        title={tr(`কার্যক্রম ${m.id}`)}
        sub={tr(`আবেদন: ${r.id}`)}
        action={<Badge s={m.status} />}
      />
      {success && (
        <div className="mb-4">
          <Alert kind="success">{tr(success)}</Alert>
        </div>
      )}
      <Card className="mb-5">
        <Stepper
          steps={["দল নির্ধারিত", "নেতার স্বীকৃতি", "চলমান", "সম্পন্ন"]}
          current={
            ["cancelled", "failed"].includes(m.status)
              ? -1
              : m.status === "done" ? 4 : Math.max(0, order.indexOf(stage))
          }
        />
        {["problem", "cancelled", "failed"].includes(m.status) && (
          <div className="mt-4">
            <Alert kind="warn" title={tr(labels[m.status])}>
              {tr("সর্বশেষ ধাপ: ")}{tr(labels[stage])}।
              {tr(m.status === "problem"
                ? " সমাধানের পর একই ধাপে ফিরতে হবে; স্বীকৃতি বা শুরুর ধাপ বাদ দেওয়া যাবে না।"
                : " এই কার্যক্রম বন্ধ। পুনর্বণ্টন হলে আলাদা বরাদ্দের record থাকবে।")}
            </Alert>
          </div>
        )}
      </Card>
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <SectionTitle>{tr("কার্যক্রমের বিবরণ")}</SectionTitle>
          <dl className="space-y-3">
            {[
              ["দল", t.name],
              ["সংগঠন", s.organizations.find((o) => o.id === t.orgId)?.name],
              ["এলাকা", `${r.upazila}, ${r.district}`],
              ["সহায়তা", r.aid.join(", ")],
              ["বিপদগ্রস্ত মানুষ", String(r.people)],
              ["জমার সময়", time(r.createdAt)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-ink-soft">{tr(label)}</dt>
                <dd>{tr(value)}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <SectionTitle>{tr("দলের অপারেশনাল তথ্য")}</SectionTitle>
          <p>{r.note}</p>
          <p className="mt-4">
            {tr(a.role === "admin"
              ? `যোগাযোগ: ${r.phone}`
              : "ব্যক্তিগত যোগাযোগের জন্য সুপার অ্যাডমিনের সঙ্গে সমন্বয় করুন।")}
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            {tr("ব্যক্তিগত নাম/ফোন শুধু অ্যাডমিন view-তে। দলের অপারেশনাল তথ্য প্রকাশ্যে শেয়ার করবেন না।")}</p>
          {!leader && (
            <div className="mt-4">
              <Alert>
                {tr(a.role === "admin"
                  ? "অগ্রগতি দলনেতা দেবেন। প্রয়োজনে আপনি বাতিল/ব্যর্থ চিহ্নিত করে পুনর্বণ্টন করতে পারেন।"
                  : "এই view-তে পর্যবেক্ষণ করতে পারবেন; শুধু নিযুক্ত দলনেতা অগ্রগতি পরিবর্তন করেন।")}
              </Alert>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            {leader && m.status === "assigned" && (
              <Button
                onClick={() => {
                  setError("")
                  setConfirm("acknowledged")
                }}
              >
                {tr("দলের পক্ষে স্বীকৃতি দিন")}</Button>
            )}
            {leader && m.status === "acknowledged" && (
              <Button
                onClick={() => {
                  setError("")
                  setConfirm("ongoing")
                }}
              >
                {tr("কার্যক্রম শুরু করুন")}</Button>
            )}
            {leader && m.status === "problem" && (
              <Button onClick={() => {
                setError("")
                setNote("")
                setConfirm(stage)
              }}>
                {tr("সমস্যা সমাধান হয়েছে — আগের ধাপে ফিরুন")}</Button>
            )}
            {leader && m.status === "ongoing" && (
              <Button
                onClick={() => {
                  setError("")
                  setConfirm("done")
                }}
              >
                {tr("সম্পন্ন চিহ্নিত করুন")}</Button>
            )}
            {leader && m.status === "ongoing" && (
              <Button
                variant="secondary"
                onClick={() => {
                  setError("")
                  setConfirm("ongoing")
                }}
              >
                {tr("অগ্রগতির নোট দিন")}</Button>
            )}
            {leader && active(m) && m.status !== "problem" && (
              <Button
                variant="secondary"
                onClick={() => {
                  setError("")
                  setConfirm("problem")
                }}
              >
                {tr("সমস্যা জানান")}</Button>
            )}
            {a.role === "admin" && active(m) && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setError("")
                    setConfirm("cancelled")
                  }}
                >
                  {tr("বাতিল ও পুনর্বণ্টন")}</Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setError("")
                    setConfirm("failed")
                  }}
                >
                  {tr("ব্যর্থ চিহ্নিত করুন")}</Button>
              </>
            )}
            {a.role === "admin" && (
              <Button to={`/admin/requests/${r.id}`} variant="ghost">
                {tr("আবেদন ও বরাদ্দের ইতিহাস")}</Button>
            )}
          </div>
        </Card>
      </div>
      <Card className="mt-5">
        <SectionTitle>{tr("পরিবর্তনের ইতিহাস")}</SectionTitle>
        <ol className="divide-y divide-line">
          {m.history.map((h, i) => (
            <li key={i} className="py-3">
              <p className="font-semibold">{tr(labels[h.status])}</p>
              <p>{tr(h.text)}</p>
              <p className="text-sm text-ink-soft">{tr(time(h.at))}</p>
            </li>
          ))}
        </ol>
      </Card>
      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={tr(`${confirm ? labels[confirm] : ""} — নিশ্চিত করুন`)}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            update()
          }}
        >
          {error && <Alert kind="error">{tr(error)}</Alert>}
          <Field
            label={tr("অপারেশনাল নোট")}
            htmlFor="mission-note"
            required={needsNote}
          >
            <TextArea
              id="mission-note"
              required={needsNote}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <p className="text-sm">
            {tr("বাতিল/ব্যর্থ হলে পুরোনো বরাদ্দ মুছবে না; অ্যাডমিন একই আবেদনে উপযুক্ত নতুন দল নির্ধারণ করতে পারবেন।")}</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              {tr("ফিরে যান")}</Button>
            <Button type="submit">{tr("নিশ্চিত করুন")}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
