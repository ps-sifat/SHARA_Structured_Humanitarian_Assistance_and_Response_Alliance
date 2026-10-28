import { useLanguage } from "./i18n"
import { matchesSearch } from "./locale"
import { useState } from "react"
import { useParams, useSearchParams } from "react-router"
import { AID, DISTRICTS, bn } from "./data"
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  Empty,
  Field,
  Input,
  PageHead,
  SectionTitle,
  Select,
  TextArea,
} from "./ui"
import {
  active,
  eligibility,
  labels,
  latestMission,
  progress,
  time,
  type HelpRequest,
} from "./model"
import { act, uid, useDemo } from "./store"
export { MissionDetail } from "./Missions"

export function AdminDashboard() {
  const { tr } = useLanguage()
  const s = useDemo()
  const summaries = [
    [
      "পর্যালোচনার অপেক্ষায়",
      s.requests.filter(
        (r) =>
          r.verification === "pending" || r.verification === "clarification",
      ).length,
      "/admin/requests?verification=pending",
    ],
    [
      "যাচাইকৃত · দল বাকি",
      s.requests.filter(
        (r) =>
          r.verification === "verified" &&
          !s.missions.some(
            (m) => m.requestId === r.id && (active(m) || m.status === "done"),
          ),
      ).length,
      "/admin/requests?dispatch=waiting",
    ],
    [
      "নেতার স্বীকৃতি বাকি",
      s.missions.filter((m) => m.status === "assigned").length,
      "/admin/missions?status=assigned",
    ],
    [
      "কার্যক্রমে সমস্যা",
      s.missions.filter((m) => m.status === "problem").length,
      "/admin/missions?status=problem",
    ],
    [
      "সংগঠন যাচাই বাকি",
      s.organizations.filter((o) => o.verification === "pending").length,
      "/admin/organizations",
    ],
  ] as const
  return (
    <div className="mx-auto max-w-6xl">
      <PageHead
        title={tr("সুপার অ্যাডমিন সারসংক্ষেপ")}
        sub={tr("পর্যালোচনা, যাচাই ও দলভিত্তিক সাড়ার পরবর্তী কাজ")}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summaries.map(([label, count, to]) => (
          <Card key={label}>
            <p>{tr(label)}</p>
            <p className="my-3 font-display text-3xl font-bold text-forest">
              {tr(bn(count))}
            </p>
            <Button to={to} variant="secondary">
              {tr("তালিকা দেখুন")}</Button>
          </Card>
        ))}
      </div>
      <div className="mt-6">
        <Alert>
          {tr("যাচাইকৃত আবেদন → উপযুক্ত দল → দলনেতার স্বীকৃতি → অগ্রগতি → সম্পন্ন। কোনো ব্যক্তিকে আলাদাভাবে dispatch করা হয় না।")}</Alert>
      </div>
    </div>
  )
}

export function RequestQueue() {
  const { tr } = useLanguage()
  const s = useDemo(),
    [params, setParams] = useSearchParams()
  const q = params.get("q") ?? "",
    district = params.get("district") ?? "",
    verification = params.get("verification") ?? ""
  const set = (key: string, value: string) => {
    const p = new URLSearchParams(params)
    value ? p.set(key, value) : p.delete(key)
    setParams(p)
  }
  const list = s.requests.filter(
    (r) =>
      matchesSearch(`${r.id} ${r.upazila}`, q) &&
      (!district || r.district === district) &&
      (!verification ||
        (verification === "pending"
          ? ["pending", "clarification"].includes(r.verification)
          : r.verification === verification)) &&
      (!params.has("dispatch") ||
        (r.verification === "verified" &&
          !s.missions.some(
            (m) => m.requestId === r.id && (active(m) || m.status === "done"),
          ))),
  )
  return (
    <div className="mx-auto max-w-6xl">
      <PageHead
        title={tr("সহায়তার আবেদন পর্যালোচনা")}
        sub={tr("ফিল্টার URL-এ থাকে; বিস্তারিত থেকে ফিরলেও নির্বাচন অক্ষুণ্ণ থাকবে")}
      />
      <Card className="mb-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={tr("রেফারেন্স বা উপজেলা")} htmlFor="request-search">
            <Input
              id="request-search"
              value={q}
              onChange={(e) => set("q", e.target.value)}
            />
          </Field>
          <Field label={tr("জেলা")} htmlFor="queue-district">
            <Select
              id="queue-district"
              value={district}
              onChange={(e) => set("district", e.target.value)}
            >
              <option value="">{tr("সব জেলা")}</option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>{tr(d)}</option>
              ))}
            </Select>
          </Field>
          <Field label={tr("যাচাই")} htmlFor="queue-status">
            <Select
              id="queue-status"
              value={verification}
              onChange={(e) => set("verification", e.target.value)}
            >
              <option value="">{tr("সব অবস্থা")}</option>
              <option value="pending">{tr("পর্যালোচনা বাকি")}</option>
              <option value="verified">{tr("যাচাইকৃত")}</option>
              <option value="rejected">{tr("প্রত্যাখ্যাত")}</option>
            </Select>
          </Field>
        </div>
        <Button variant="ghost" className="mt-3" onClick={() => setParams({})}>
          {tr("সব ফিল্টার মুছুন")}</Button>
      </Card>
      <p className="mb-4 text-sm text-ink-soft">{tr(bn(list.length))}{tr("টি আবেদন")}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap justify-between gap-2">
              <SectionTitle>{tr(r.id)}</SectionTitle>
              <Badge s={r.priority} />
            </div>
            <p>
              {tr(r.upazila)}, {tr(r.district)} · {tr(bn(r.people))} {tr(" জন")}</p>
            <p className="mt-2">{tr(r.aid.join(", "))}</p>
            <p className="mt-3">{tr(progress(s, r))}</p>
            <Button
              to={`/admin/requests/${r.id}?queue=${encodeURIComponent(params.toString())}`}
              className="mt-4"
              variant="secondary"
            >
              {tr("পর্যালোচনা ও দল নির্ধারণ")}</Button>
          </Card>
        ))}
      </div>
      {!list.length && (
        <Empty
          title={tr("কোনো আবেদন মেলেনি")}
          action={<Button onClick={() => setParams({})}>{tr("ফিল্টার মুছুন")}</Button>}
        >
          {tr("ফিল্টার বদলে আবার দেখুন।")}</Empty>
      )}
    </div>
  )
}

export function RequestDetail() {
  const { tr } = useLanguage()
  const s = useDemo(),
    { id } = useParams(),
    [params] = useSearchParams()
  const r = s.requests.find((r) => r.id === id)
  const [reveal, setReveal] = useState(false),
    [pick, setPick] = useState("")
  const [review, setReview] = useState<HelpRequest["verification"] | null>(
      null,
    ),
    [reason, setReason] = useState("")
  const [error, setError] = useState(""),
    [message, setMessage] = useState("")
  if (!r)
    return (
      <Empty
        title={tr("আবেদন পাওয়া যায়নি")}
        action={<Button to="/admin/requests">{tr("আবেদনের তালিকা")}</Button>}
      />
    )
  const current = latestMission(s, r.id),
    history = s.missions.filter((m) => m.requestId === r.id)
  const dispatched = history.some((m) => active(m) || m.status === "done")
  const teams = s.teams
    .map((t) => ({ team: t, reasons: eligibility(s, t, r) }))
    .sort((a, b) => a.reasons.length - b.reasons.length)
  return (
    <div className="mx-auto max-w-5xl">
      <Button
        to={`/admin/requests?${params.get("queue") ?? ""}`}
        variant="ghost"
        className="mb-4"
      >
        {tr("আবেদনের তালিকায় ফিরুন")}</Button>
      <PageHead
        title={tr(`আবেদন ${r.id}`)}
        sub={tr(`${time(r.createdAt)} · ${
          r.isProxy ? "অন্যের পক্ষে" : "সরাসরি আবেদন"
        }`)}
        action={<Badge s={r.verification} />}
      />
      {message && <Alert kind="success">{tr(message)}</Alert>}
      {error && !pick && !review && <Alert kind="error">{tr(error)}</Alert>}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <Card>
            <SectionTitle>{tr("আবেদনের তথ্য")}</SectionTitle>
            <p>
              {tr(r.upazila)}, {tr(r.district)} · {tr(bn(r.people))} {tr(" জন")}</p>
            <p className="mt-3">{tr("সহায়তা: ")}{tr(r.aid.join(", "))}</p>
            <p className="mt-3">{tr(r.note || "অতিরিক্ত বিবরণ নেই")}</p>
            <div className="mt-3">
              <Badge s={r.priority} />
            </div>
          </Card>
          <Card>
            <SectionTitle>{tr("ব্যক্তিগত তথ্য (শুধু অ্যাডমিন)")}</SectionTitle>
            <p>
              {tr("নাম:")}{" "}
              {tr(reveal ? r.victimName || r.reporter || "দেওয়া হয়নি" : "••••••••")}
            </p>
            <p>{tr("ফোন: ")}{tr(reveal ? r.phone : "••••••••")}</p>
            {reveal && r.isProxy && (
              <p>
                {tr("আবেদনকারী: ")}{r.reporter} · {tr(r.reporterPhone || "নম্বর দেওয়া হয়নি")} ·{" "}
                {tr(r.relation)}
              </p>
            )}
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => setReveal(!reveal)}
            >
              {tr(reveal ? "লুকান" : "তথ্য দেখান")}
            </Button>
          </Card>
          <Card>
            <SectionTitle>{tr("উপযুক্ত দল নির্ধারণ")}</SectionTitle>
            {dispatched ? (
              <Alert>
                {tr("আবেদনে ইতিমধ্যে সক্রিয়/সম্পন্ন কার্যক্রম রয়েছে। দ্বৈত dispatch বন্ধ।")}</Alert>
            ) : r.verification !== "verified" ? (
              <Alert kind="warn">{tr("আগে আবেদন যাচাই করুন।")}</Alert>
            ) : (
              <>
                {!teams.some((x) => !x.reasons.length) && (
                  <Alert kind="warn" title={tr("উপযুক্ত প্রস্তুত দল নেই")}>
                    {tr("দলের সক্ষমতা/এলাকা/ব্যস্ততা দেখুন। অন্য উপযুক্ত দল প্রস্তুত হলে এই আবেদনেই ফিরে বরাদ্দ দিন।")}</Alert>
                )}
                <div className="divide-y divide-line">
                  {teams.map(({ team: t, reasons }) => (
                    <div key={t.id} className="py-4">
                      <p className="font-bold">{t.name}</p>
                      <p className="text-sm">
                        {s.organizations.find((o) => o.id === t.orgId)?.name} ·{" "}
                        {tr(t.areas.join(", "))}
                      </p>
                      <p className="mt-1 text-sm">
                        {tr("সক্ষমতা: ")}{tr(t.capabilities.join(", "))} {tr(" · সদস্য")}{" "}
                        {tr(bn(t.memberIds.length))} {tr(" জন")}</p>
                      <p className="mt-2 text-sm">
                        {tr(reasons.length
                          ? reasons.join(" · ")
                          : "যাচাইকৃত সংগঠন · এলাকা ও সক্ষমতা মেলে · প্রস্তুত · সক্রিয় কাজ নেই")}
                      </p>
                      <Button
                        className="mt-3"
                        size="sm"
                        disabled={!!reasons.length}
                        onClick={() => {
                          setError("")
                          setPick(t.id)
                        }}
                      >
                        {tr("এই দল নির্ধারণ করুন")}</Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
        <div className="space-y-5">
          <Card>
            <SectionTitle>{tr("যাচাই সিদ্ধান্ত")}</SectionTitle>
            <p>{tr(progress(s, r))}</p>
            {r.reviewNote && <p className="my-3">{tr("অ্যাডমিন নোট: ")}{r.reviewNote}</p>}
            <div className="mt-4 grid gap-3">
              {(["verified", "clarification", "rejected"] as const).map(
                (status) => (
                  <Button
                    key={status}
                    disabled={dispatched || r.verification === status}
                    variant={status === "verified" ? "primary" : "secondary"}
                    onClick={() => {
                      setReason("")
                      setError("")
                      setReview(status)
                    }}
                  >
                    {tr(status === "verified"
                      ? "যাচাইকৃত করুন"
                      : status === "clarification"
                        ? "স্পষ্টকরণ চাই"
                        : "প্রত্যাখ্যান")}
                  </Button>
                ),
              )}
            </div>
          </Card>
          <Card>
            <SectionTitle>{tr("বরাদ্দ ও কার্যক্রমের ইতিহাস")}</SectionTitle>
            {history.length ? (
              history.map((m) => (
                <div key={m.id} className="mb-4">
                  <p>{s.teams.find((t) => t.id === m.teamId)?.name}</p>
                  <Badge s={m.status} />
                  <Button to={`/admin/missions/${m.id}`} variant="ghost">
                    {tr("কার্যক্রম দেখুন")}</Button>
                </div>
              ))
            ) : (
              <p>{tr("এখনো কোনো দল বরাদ্দ নেই।")}</p>
            )}
            {current && (
              <p className="text-sm text-ink-soft">
                {tr("পুনর্বণ্টনে আগের record মুছবে না।")}</p>
            )}
          </Card>
        </div>
      </div>
      <Dialog
        open={!!review}
        onClose={() => setReview(null)}
        title={tr("যাচাই সিদ্ধান্ত নিশ্চিত করুন")}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!review) return
            const result = act({
              type: "review",
              id: r.id,
              status: review,
              reason,
            })
            setError(result.error)
            if (result.ok) {
              setReview(null)
              setMessage("আবেদনের যাচাই-অবস্থা ও ট্র্যাকিং হালনাগাদ হয়েছে।")
            }
          }}
        >
          <p>{tr(review ? labels[review] : "")}</p>
          {error && <Alert kind="error">{tr(error)}</Alert>}
          <Field
            label={tr("কারণ / অ্যাডমিন নোট")}
            htmlFor="review-reason"
            required={review !== "verified"}
          >
            <TextArea
              id="review-reason"
              required={review !== "verified"}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setReview(null)}>
              {tr("বাতিল")}</Button>
            <Button type="submit">{tr("নিশ্চিত করুন")}</Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={!!pick}
        onClose={() => setPick("")}
        title={tr("দল নির্ধারণ নিশ্চিত করুন")}
      >
        <p>
          {s.teams.find((t) => t.id === pick)?.name} {tr(" দলকে এই যাচাইকৃত আবেদন দেওয়া হবে। দলনেতার স্বীকৃতি বাকি থাকবে।")}</p>
        {error && <Alert kind="error">{tr(error)}</Alert>}
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setPick("")}>
            {tr("বাতিল")}</Button>
          <Button
            onClick={() => {
              const result = act({
                type: "dispatch",
                requestId: r.id,
                teamId: pick,
                id: uid("M"),
              })
              setError(result.error)
              if (result.ok) {
                setPick("")
                setMessage("দল নির্ধারিত; নিচের কার্যক্রম লিংক থেকে অগ্রগতি দেখুন।")
              }
            }}
          >
            {tr("বরাদ্দ নিশ্চিত করুন")}</Button>
        </div>
      </Dialog>
    </div>
  )
}

export function OrganizationsReview() {
  const { tr } = useLanguage()
  const s = useDemo(),
    [selected, setSelected] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState("")
  const org = s.organizations.find((o) => o.id === selected)
  const decide = (status: "verified" | "rejected") => {
    const result = act({ type: "verifyOrg", id: selected, status, reason })
    setError(result.error)
    if (result.ok) setSelected("")
  }
  return (
    <div className="mx-auto max-w-5xl">
      <PageHead title={tr("সংগঠন যাচাই")} sub={tr("নিবন্ধন ও প্রশাসকের জবাবদিহি যাচাই করুন")} />
      <div className="grid gap-4 md:grid-cols-2">
        {s.organizations.map((o) => (
          <Card key={o.id}>
            <SectionTitle>{o.name}</SectionTitle>
            <p>{tr(o.areas.join(", "))}</p>
            <div className="mt-3">
              <Badge s={o.verification} />
            </div>
            <Button
              className="mt-4"
              variant="secondary"
              onClick={() => {
                setSelected(o.id)
                setReason("")
                setError("")
              }}
            >
              {tr("বিস্তারিত ও যাচাই")}</Button>
          </Card>
        ))}
      </div>
      <Dialog
        open={!!org}
        onClose={() => setSelected("")}
        title={tr("সংগঠনের পরিচয় পর্যালোচনা")}
      >
        {org && (
          <div className="space-y-4">
            <p className="font-bold">{org.name}</p>
            <p>{org.description}</p>
            <p>
              {tr(org.organizationType)} · {tr(org.areas.join(", "))}
            </p>
            <p>{tr("প্রশাসক: ")}{s.accounts.find((a) => a.id === org.adminId)?.name}</p>
            <p>
              {org.contactEmail} · {org.contactPhone}
            </p>
            <p>{tr("আইডি: ")}{tr(org.id)}</p>
            <p>{tr(org.locations.join(", "))}</p>
            <Field label={tr("প্রত্যাখ্যানের কারণ")} htmlFor="org-review-reason">
              <TextArea
                id="org-review-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            {error && <Alert kind="error">{tr(error)}</Alert>}
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={org.verification === "verified"}
                onClick={() => decide("verified")}
              >
                {tr("যাচাই নিশ্চিত করুন")}</Button>
              <Button
                variant="secondary"
                disabled={org.verification === "rejected"}
                onClick={() => decide("rejected")}
              >
                {tr("প্রত্যাখ্যান নিশ্চিত করুন")}</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}

export function Suppliers() {
  const { tr } = useLanguage()
  const s = useDemo(),
    [open, setOpen] = useState(s.suppliers[0]?.id ?? ""),
    [dialog, setDialog] = useState<"supplier" | "resource" | null>(null)
  const [error, setError] = useState(""),
    [message, setMessage] = useState("")
  const sup = s.suppliers.find((x) => x.id === open)
  return (
    <div className="mx-auto max-w-6xl">
      <PageHead
        title={tr("সরবরাহকারী ও সম্পদ")}
        action={
          <Button
            onClick={() => {
              setError("")
              setDialog("supplier")
            }}
          >
            {tr("সরবরাহকারী যোগ করুন")}</Button>
        }
      />
      {message && <Alert kind="success">{tr(message)}</Alert>}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          {s.suppliers.map((x) => (
            <Card key={x.id}>
              <SectionTitle>{x.name}</SectionTitle>
              <p>
                {tr(x.cat)} · {tr(x.place)}
              </p>
              <p>{x.contact}</p>
              <div className="my-3">
                <Badge s={x.verified ? "verified" : "pending"} />
              </div>
              <Button variant="secondary" onClick={() => setOpen(x.id)}>
                {tr(open === x.id ? "নির্বাচিত সরবরাহকারী" : "সম্পদ দেখুন")}
              </Button>
            </Card>
          ))}
        </div>
        {sup && (
          <Card>
            <SectionTitle>{sup.name}{tr("-এর সম্পদ")}</SectionTitle>
            <Button
              variant="secondary"
              onClick={() => {
                setError("")
                setDialog("resource")
              }}
            >
              {tr("সম্পদ যোগ করুন")}</Button>
            <ul className="mt-4 divide-y divide-line">
              {sup.res.map((r) => (
                <li className="py-3" key={r.id}>
                  <p className="font-semibold">{r.name}</p>
                  <p>
                    {tr(r.cat)} · {tr(bn(r.qty))}{tr("টি · ")}{tr(r.qty ? "মজুদ আছে" : "মজুদ শেষ")}
                  </p>
                  <p className="text-sm text-ink-soft">{r.note}</p>
                </li>
              ))}
            </ul>
            {!sup.res.length && (
              <p className="mt-4">{tr("এখনো কোনো সম্পদ যোগ হয়নি।")}</p>
            )}
          </Card>
        )}
      </div>
      <Dialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        title={tr(dialog === "supplier" ? "সরবরাহকারী যোগ করুন" : "সম্পদ যোগ করুন")}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            const data = new FormData(e.currentTarget),
              value = (key: string) => String(data.get(key) ?? "").trim()
            const id = uid(dialog === "supplier" ? "s" : "r")
            const result =
              dialog === "supplier"
                ? act({
                    type: "supplier",
                    record: {
                      id,
                      name: value("name"),
                      cat: value("category"),
                      place: value("place"),
                      contact: value("contact"),
                      verified: false,
                      res: [],
                    },
                  })
                : act({
                    type: "resource",
                    supplierId: open,
                    record: {
                      id,
                      name: value("name"),
                      cat: value("category"),
                      qty: Number(value("quantity")),
                      note: value("note"),
                    },
                  })
            setError(result.error)
            if (result.ok) {
              if (dialog === "supplier") setOpen(id)
              setDialog(null)
              setMessage("নতুন তথ্য সংরক্ষিত হয়েছে।")
            }
          }}
        >
          {error && <Alert kind="error">{tr(error)}</Alert>}
          <Field label={tr("নাম")} required htmlFor="s-name">
            <Input id="s-name" name="name" required />
          </Field>
          <Field label={tr("ধরন")} required htmlFor="s-category">
            <Select id="s-category" name="category">
              {AID.map((c) => (
                <option key={c} value={c}>{tr(c)}</option>
              ))}
            </Select>
          </Field>
          {dialog === "supplier" ? (
            <>
              <Field label={tr("এলাকা")} required htmlFor="s-place">
                <Input id="s-place" required name="place" />
              </Field>
              <Field label={tr("যোগাযোগ")} required htmlFor="s-contact">
                <Input id="s-contact" required name="contact" />
              </Field>
            </>
          ) : (
            <>
              <Field label={tr("পরিমাণ")} required htmlFor="r-quantity">
                <Input
                  id="r-quantity"
                  required
                  name="quantity"
                  type="number"
                  min={0}
                  step={1}
                />
              </Field>
              <Field label={tr("নোট")} htmlFor="r-note">
                <TextArea id="r-note" name="note" />
              </Field>
            </>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDialog(null)}>
              {tr("বাতিল")}</Button>
            <Button type="submit">{tr("সংরক্ষণ")}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
