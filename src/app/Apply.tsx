import { useLanguage } from "./i18n"
import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { CircleCheck, Loader2, Lock, X } from "lucide-react"
import { AID, DISTRICTS, UPAZILAS } from "./data"
import { Alert, Button, Field, SearchSelect, inputCls } from "./ui"
import { act, uid } from "./store"
import type { HelpRequest } from "./model"

type F = {
  kind: "self" | "proxy"
  district: string
  upazila: string
  people: string
  aid: string[]
  phone: string
  note: string
  rName: string
  rPhone: string
  relation: string
  vName: string
}
const init: F = {
  kind: "self",
  district: "",
  upazila: "",
  people: "",
  aid: [],
  phone: "",
  note: "",
  rName: "",
  rPhone: "",
  relation: "",
  vName: "",
}
type Phase = "form" | "loading" | "done"

export default function Apply() {
  const { tr } = useLanguage()
  const [params] = useSearchParams()
  const initialDistrict = params.get("district") ?? ""
  const initialUpazila = params.get("upazila") ?? ""
  const [f, setF] = useState<F>({
    ...init,
    district: DISTRICTS.includes(initialDistrict) ? initialDistrict : "",
    upazila: (UPAZILAS[initialDistrict] ?? []).includes(initialUpazila)
      ? initialUpazila
      : "",
  })
  const [submitted, setSubmitted] = useState<HelpRequest | null>(null)
  const [err, setErr] = useState<Partial<Record<keyof F, string>>>({})
  const [phase, setPhase] = useState<Phase>("form")
  const [netErr, setNetErr] = useState(false)
  const nav = useNavigate()
  const set = <K extends keyof F>(k: K, v: F[K]) => {
    setF((p) => ({ ...p, [k]: v }))
    setErr((e) => ({ ...e, [k]: undefined }))
  }
  const bnPhone = (s: string) =>
    s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)))
  const okPhone = (s: string) =>
    /^(\+?88)?01[3-9]\d{8}$/.test(bnPhone(s).replace(/[\s-]/g, ""))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const x: typeof err = {}
    if (!f.district) x.district = "জেলা বেছে নিন"
    if (!f.upazila) x.upazila = "উপজেলা বেছে নিন"
    if (!f.people || Number(bnPhone(f.people)) < 1)
      x.people = "কতজন বিপদে আছেন তা লিখুন"
    if (f.aid.length === 0) x.aid = "অন্তত একটি সাহায্য বেছে নিন"
    if (!okPhone(f.phone)) x.phone = "সঠিক মোবাইল নম্বর লিখুন (যেমন: ০১৭XXXXXXXX)"
    if (f.kind === "proxy") {
      if (!f.rName.trim()) x.rName = "আপনার নাম লিখুন"
      if (!f.relation.trim()) x.relation = "বিপদগ্রস্ত ব্যক্তির সঙ্গে সম্পর্ক লিখুন"
    }
    setErr(x)
    if (Object.keys(x).length) {
      document.getElementById("form-errors")?.focus()
      return
    }
    if (phase !== "form") return
    setPhase("loading")
    const now = new Date().toISOString()
    const record: HelpRequest = {
      id: uid("SH"),
      trackingCode: uid("CODE"),
      createdAt: now,
      updatedAt: now,
      district: f.district,
      upazila: f.upazila,
      people: Number(bnPhone(f.people)),
      aid: f.aid,
      phone: f.phone,
      note: f.note,
      isProxy: f.kind === "proxy",
      victimName: f.vName,
      reporter: f.rName,
      reporterPhone: f.rPhone,
      relation: f.relation,
      verification: "pending",
      reviewNote: "",
      risks: [],
      priority: "medium",
    }
    const result = act({ type: "request", record })
    if (!result.ok) {
      setPhase("form")
      setNetErr(true)
      return
    }
    setSubmitted(record)
    setPhase("done")
  }

  if (phase === "done")
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-mint text-leaf">
          <CircleCheck size={36} />
        </span>
        <h1 className="mt-5 font-display text-3xl font-bold text-forest">
          {tr("আবেদন গ্রহণ করা হয়েছে")}</h1>
        <p className="mt-3 text-lg text-ink-soft">
          {tr("আবেদন জমা হয়েছে; এখনো কোনো দল নির্ধারিত হয়নি। অ্যাডমিন তথ্য যাচাই করে পরবর্তী ব্যবস্থা নেবেন।")}</p>
        <div className="mt-6 rounded-xl border border-line bg-white p-5 text-left">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px]">
            <dt className="text-ink-soft">{tr("আবেদন নম্বর")}</dt>
            <dd className="break-all font-semibold">{tr(submitted?.id)}</dd>
            <dt className="text-ink-soft">{tr("ট্র্যাকিং কোড")}</dt>
            <dd className="break-all font-semibold">
              {tr(submitted?.trackingCode)}
            </dd>
            <dt className="text-ink-soft">{tr("এলাকা")}</dt>
            <dd>
              {tr(f.upazila)}, {tr(f.district)}
            </dd>
            <dt className="text-ink-soft">{tr("অবস্থা")}</dt>
            <dd className="font-semibold text-amber-800">{tr("অপেক্ষমাণ · যাচাই হবে")}</dd>
          </dl>
        </div>
        <p className="mt-3 text-sm text-ink-soft">
          {tr("রেফারেন্স ও কোড লিখে রাখুন।")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button to={`/track?ref=${submitted?.id}`}>{tr("আবেদন ট্র্যাক করুন")}</Button>
          <Button
            variant="secondary"
            onClick={() => {
              setF(init)
              setPhase("form")
              setSubmitted(null)
            }}
          >
            {tr("আরেকটি আবেদন করুন")}</Button>
          <Button to="/" variant="ghost">
            {tr("হোম")}</Button>
          <Button to="/map" variant="ghost">
            {tr("মানচিত্র")}</Button>
        </div>
      </div>
    )

  const errs = Object.values(err).filter(Boolean)
  const disabled = phase === "loading"
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-forest">
            {tr("সাহায্যের আবেদন")}</h1>
          <p className="mt-1 text-ink-soft">
            {tr("কয়েক মিনিটেই আবেদন করুন। কোনো অ্যাকাউন্ট লাগবে না।")}</p>
        </div>
        <button
          onClick={() => nav(initialDistrict ? "/map" : "/")}
          aria-label={tr("ফর্ম বন্ধ করুন")}
          className="grid size-11 shrink-0 place-items-center rounded-lg border border-line hover:bg-mint"
        >
          <X size={20} />
        </button>
      </div>

      <form
        onSubmit={submit}
        noValidate
        className="space-y-6 rounded-2xl border border-line bg-white p-5 sm:p-8"
      >
        <div id="form-errors" tabIndex={-1} className="outline-none">
          {errs.length > 0 && (
            <Alert kind="error" title={tr("ফর্মে কিছু তথ্য ঠিক করতে হবে")}>
              {tr(errs.length)}{tr("টি ঘরে ভুল বা তথ্য বাকি আছে। লাল চিহ্নিত ঘরগুলো দেখুন।")}</Alert>
          )}
          {netErr && (
            <div className="mt-3">
              <Alert kind="error" title={tr("আবেদন পাঠানো যায়নি")}>
                {tr("ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।")}</Alert>
            </div>
          )}
        </div>

        <fieldset>
          <legend className="mb-2 text-[15px] font-semibold">
            {tr("আবেদনের ধরন ")}<span className="text-alert">*</span>
          </legend>
          <div
            className="grid grid-cols-2 gap-2 rounded-xl bg-mint p-1"
            role="radiogroup"
          >
            {([
              ["self", "নিজের জন্য"],
              ["proxy", "অন্যের পক্ষ থেকে"],
            ] as const).map(([k, l]) => (
              <label
                key={k}
                className={`flex min-h-12 cursor-pointer items-center justify-center rounded-[10px] text-center font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-leaf ${
                  f.kind === k
                    ? "bg-forest text-white shadow"
                    : "text-forest hover:bg-white/60"
                }`}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  checked={f.kind === k}
                  onChange={() => set("kind", k)}
                  className="sr-only"
                />
                {tr(l)}
              </label>
            ))}
          </div>
        </fieldset>

        {f.kind === "proxy" && (
          <div className="space-y-4 rounded-xl border border-leaf/30 bg-mint/50 p-4">
            <p className="text-sm font-semibold text-forest">
              {tr("আপনার ও বিপদগ্রস্ত ব্যক্তির তথ্য")}</p>
            <Field label={tr("আপনার নাম")} required htmlFor="rName" error={tr(err.rName)}>
              <input
                id="rName"
                disabled={disabled}
                aria-invalid={!!err.rName}
                className={inputCls}
                value={f.rName}
                onChange={(e) => set("rName", e.target.value)}
                placeholder={tr("যিনি আবেদন করছেন")}
              />
            </Field>
            <Field
              label={tr("বিপদগ্রস্ত ব্যক্তির সঙ্গে সম্পর্ক")}
              required
              htmlFor="rel"
              error={tr(err.relation)}
            >
              <input
                id="rel"
                disabled={disabled}
                aria-invalid={!!err.relation}
                className={inputCls}
                value={f.relation}
                onChange={(e) => set("relation", e.target.value)}
                placeholder={tr("যেমন: প্রতিবেশী, আত্মীয়")}
              />
            </Field>
            <Field label={tr("বিপদগ্রস্ত ব্যক্তির নাম")} htmlFor="vName">
              <input
                id="vName"
                disabled={disabled}
                className={inputCls}
                value={f.vName}
                onChange={(e) => set("vName", e.target.value)}
              />
            </Field>
            <Field
              label={tr("আপনার যোগাযোগের নম্বর")}
              htmlFor="rPhone"
              hint={tr("বিপদগ্রস্ত ব্যক্তির নম্বর না থাকলে আপনার নম্বর দিন।")}
            >
              <input
                id="rPhone"
                inputMode="tel"
                disabled={disabled}
                className={inputCls}
                value={f.rPhone}
                onChange={(e) => set("rPhone", e.target.value)}
              />
            </Field>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={tr("জেলা")} required htmlFor="district" error={tr(err.district)}>
            <SearchSelect
              id="district"
              disabled={disabled}
              invalid={!!err.district}
              value={f.district}
              onChange={(v) => {
                set("district", v)
                set("upazila", "")
              }}
              options={DISTRICTS}
              placeholder={tr("জেলা বেছে নিন")}
            />
          </Field>
          <Field
            label={tr("উপজেলা")}
            required
            htmlFor="upazila"
            error={tr(err.upazila)}
            hint={tr(!f.district ? "আগে জেলা বেছে নিন" : undefined)}
          >
            <SearchSelect
              id="upazila"
              disabled={disabled || !f.district}
              invalid={!!err.upazila}
              value={f.upazila}
              onChange={(v) => set("upazila", v)}
              options={UPAZILAS[f.district] ?? []}
              placeholder={tr("উপজেলা বেছে নিন")}
            />
          </Field>
        </div>

        <Field
          label={tr("কতজন মানুষ বিপদে আছেন")}
          required
          htmlFor="people"
          error={tr(err.people)}
        >
          <input
            id="people"
            inputMode="numeric"
            disabled={disabled}
            aria-invalid={!!err.people}
            className={`${inputCls} sm:max-w-[200px]`}
            value={f.people}
            onChange={(e) =>
              set("people", e.target.value.replace(/[^\d০-৯]/g, ""))
            }
            placeholder={tr("যেমন: ৫")}
          />
        </Field>

        <fieldset>
          <legend className="mb-2 text-[15px] font-semibold">
            {tr("কী ধরনের সাহায্য প্রয়োজন ")}<span className="text-alert">*</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {AID.map((a) => {
              const on = f.aid.includes(a)
              return (
                <label
                  key={a}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-leaf ${
                    on
                      ? "border-forest bg-forest text-white"
                      : "border-[#c5d0c8] bg-white hover:border-leaf"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    disabled={disabled}
                    onChange={() =>
                      set(
                        "aid",
                        on ? f.aid.filter((x) => x !== a) : [...f.aid, a],
                      )
                    }
                  />
                  {tr(on && "✓")} {tr(a)}
                </label>
              )
            })}
          </div>
          {err.aid && (
            <p role="alert" className="mt-1.5 text-sm font-medium text-alert">
              {tr(err.aid)}
            </p>
          )}
        </fieldset>

        <Field
          label={
            tr(f.kind === "self" ? "যোগাযোগের নম্বর" : "বিপদগ্রস্ত স্থানের যোগাযোগ নম্বর")
          }
          required
          htmlFor="phone"
          error={err.phone}
          hint={tr("এই নম্বর জনসমক্ষে দেখানো হবে না।")}
        >
          <input
            id="phone"
            inputMode="tel"
            disabled={disabled}
            aria-invalid={!!err.phone}
            className={inputCls}
            value={f.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder={tr("০১৭XXXXXXXX")}
          />
        </Field>

        <Field label={tr("জরুরি অবস্থার সংক্ষিপ্ত বিবরণ")} htmlFor="note">
          <textarea
            id="note"
            rows={4}
            disabled={disabled}
            className={`${inputCls} py-3`}
            value={f.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder={tr("কোথায় আছেন, পানি কতটা উঁচু, কারও চিকিৎসা দরকার কি না…")}
          />
        </Field>

        <Button
          type="submit"
          size="lg"
          disabled={disabled}
          className="w-full !bg-alert text-xl hover:!bg-red-700"
        >
          {disabled ? (
            <>
              <Loader2 className="animate-spin" size={22} />
              {tr("পাঠানো হচ্ছে...")}</>
          ) : (
              tr("আবেদন পাঠান")
          )}
        </Button>
        <p className="flex items-start gap-2 text-sm text-ink-soft">
          <Lock size={16} className="mt-0.5 shrink-0" />
          <Link to="/privacy" className="underline">
            {tr("গোপনীয়তা নীতি")}</Link>
        </p>
      </form>
    </div>
  )
}
