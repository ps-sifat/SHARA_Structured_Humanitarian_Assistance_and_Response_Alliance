import { useLanguage } from "./i18n"
import { useState } from "react"
import { useSearchParams } from "react-router"
import {
  Alert,
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Input,
  PageHead,
  SectionTitle,
  TextArea,
} from "./ui"
import { account, progress, time } from "./model"
import { act, useDemo } from "./store"

export function Tracking() {
  const { tr } = useLanguage()
  const s = useDemo(),
    [params] = useSearchParams()
  const [reference, setReference] = useState(params.get("ref") ?? "")
  const [code, setCode] = useState(""),
    [result, setResult] = useState(""),
    [error, setError] = useState("")
  const r = s.requests.find((r) => r.id === result)
  const [additional, setAdditional] = useState("")
  const [feedback, setFeedback] = useState("")
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <PageHead
        title={tr("আবেদনের অগ্রগতি")}
        sub={tr("রেফারেন্স ও ট্র্যাকিং কোড দিয়ে অগ্রগতি দেখুন")}
      />
      <Card>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            const found = s.requests.find(
              (x) =>
                x.id.toUpperCase() === reference.trim().toUpperCase() &&
                x.trackingCode === code.trim(),
            )
            setResult(found?.id ?? "")
            setFeedback("")
            setAdditional("")
            setError(
              found
                ? ""
                : "রেফারেন্স বা কোড মেলেনি। জমার নিশ্চিতকরণ থেকে সঠিক তথ্য দিন।",
            )
          }}
        >
          <Field label={tr("আবেদনের রেফারেন্স")} required htmlFor="track-reference">
            <Input
              id="track-reference"
              required
              value={reference}
              onChange={(e) => {
                setReference(e.target.value)
                setResult("")
                setFeedback("")
                setAdditional("")
                setError("")
              }}
            />
          </Field>
          <Field label={tr("ট্র্যাকিং কোড")} required htmlFor="track-code">
            <Input
              id="track-code"
              required
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setResult("")
                setFeedback("")
                setAdditional("")
                setError("")
              }}
            />
          </Field>
          {error && <Alert kind="error">{tr(error)}</Alert>}
          <Button type="submit">{tr("অগ্রগতি দেখুন")}</Button>
        </form>
      </Card>
      {r && (
        <Card className="mt-5">
          <SectionTitle>{tr(r.id)}</SectionTitle>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-ink-soft">{tr("এলাকা")}</dt>
              <dd>
                {tr(r.upazila)}, {tr(r.district)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-soft">{tr("সহায়তা")}</dt>
              <dd>{tr(r.aid.join(", "))}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-soft">{tr("জমার সময়")}</dt>
              <dd>{tr(time(r.createdAt))}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-soft">{tr("সর্বশেষ পরিবর্তন")}</dt>
              <dd>{tr(time(r.updatedAt))}</dd>
            </div>
          </dl>
          <div className="mt-5">
            <Badge s={r.verification}>{tr(progress(s, r))}</Badge>
          </div>
          <p className="mt-3 text-sm text-ink-soft">
            {tr("আবেদন পাওয়া মানেই উদ্ধারকারী দল নির্ধারিত নয়। যাচাই ও দল নির্ধারণ পৃথক ধাপ।")}</p>
          {feedback && <div className="mt-4"><Alert kind="success">{tr(feedback)}</Alert></div>}
          {r.verification === "clarification" && <form className="mt-5 space-y-4" onSubmit={event => {
            event.preventDefault()
            const response = act({ type: "clarify", id: r.id, code: code.trim(), note: additional })
            setError(response.error)
            if (response.ok) { setAdditional(""); setFeedback("অতিরিক্ত তথ্য জমা হয়েছে; আবেদন আবার পর্যালোচনার অপেক্ষায়।") }
          }}>
            <Field label={tr("পরিস্থিতির অতিরিক্ত তথ্য")} required htmlFor="tracking-additional" hint={tr("নাম/ফোন দেবেন না। এই তথ্য কেবল অ্যাডমিন পর্যালোচনায় ব্যবহার হবে।")}><TextArea id="tracking-additional" required value={additional} onChange={event => setAdditional(event.target.value)} /></Field>
            <Button type="submit">{tr("অতিরিক্ত তথ্য জমা দিন")}</Button>
          </form>}
          <div className="mt-5 flex gap-3">
            <Button to="/" variant="secondary">
              {tr("হোম")}</Button>
            <Button to="/map" variant="ghost">
              {tr("মানচিত্র")}</Button>
          </div>
        </Card>
      )}
    </div>
  )
}

export function AccessDenied() {
  const { tr } = useLanguage()
  const s = useDemo(),
    a = account(s)
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Empty
        title={tr("এই পৃষ্ঠায় আপনার প্রবেশাধিকার নেই")}
        action={
          <Button to={a ? `/${a.role}` : "/login"}>{tr("নিজের পোর্টালে ফিরুন")}</Button>
        }
      >
        {tr("সঠিক অ্যাকাউন্ট বেছে নিন। অন্য সংগঠন বা দলের সীমাবদ্ধ কার্যক্রম দেখা যায় না।")}</Empty>
    </div>
  )
}
export function Privacy() {
  const { tr } = useLanguage()
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <PageHead title={tr("তথ্য ও গোপনীয়তা")} />
      <Card>
        <p>
          {tr("ফর্ম, প্রোফাইল ও কার্যক্রমের তথ্য এই ব্রাউজারে সংরক্ষিত থাকে।")}</p>
        <p className="mt-4">
          {tr("মানচিত্র, আবেদনের সারসংক্ষেপ ও ট্র্যাকিংয়ে নাম ও ফোন নম্বর দেখানো হয় না। ডেভেলপার নিয়ন্ত্রণ থেকে সংরক্ষিত তথ্য রিসেট করতে পারবেন।")}</p>
        <Button to="/" variant="secondary" className="mt-5">
          {tr("হোমে ফিরে যান")}</Button>
      </Card>
    </div>
  )
}
