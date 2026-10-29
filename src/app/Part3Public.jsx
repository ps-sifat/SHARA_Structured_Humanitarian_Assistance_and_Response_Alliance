import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router"
import { ArrowLeft, MapPin, ShieldCheck, Users } from "lucide-react"
import { api } from "./api"
import { useLanguage } from "./i18n"
import { DISTRICT_SHAPES, H, OUTLINE, W } from "./bdgeo"
import { Alert, Badge, Button, Card, Empty, Field, PageHead, SectionTitle, Select, Spinner, TextArea, Input } from "./ui"

const riskOptions = [
  ["medical_emergency", "Medical emergency"],
  ["children_at_risk", "Children at risk"],
  ["older_people_at_risk", "Older people at risk"],
  ["disability_access", "Disability or access needs"],
  ["unsafe_shelter", "Unsafe shelter"],
]

function label(item, language) {
  if (!item) return ""
  if (typeof item === "string") return item
  return language === "bn" ? item.name_bn || item.name_en : item.name_en || item.name_bn
}

function requestKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("")
}

export function PublicApply() {
  const { language } = useLanguage()
  const [params] = useSearchParams()
  const initialDistrict = params.get("districtId") ?? ""
  const initialUpazila = params.get("upazilaId") ?? ""
  const [districts, setDistricts] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({
    reporter_type: "direct", affected_person_name: "", contact_phone: "", reporter_name: "",
    reporter_phone: "", relation_to_affected: "", district: initialDistrict,
    upazila: initialUpazila, people_affected: "", assistance_categories: [], description: "", risks: [],
  })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [receipt, setReceipt] = useState(null)
  const keyRef = useRef(requestKey())
  const district = districts.find((item) => item.id === Number(form.district))
  const nameFor = (item) => label(item, language)

  useEffect(() => {
    Promise.all([api("/api/locations/districts/"), api("/api/help-requests/assistance-categories/")])
      .then(([locationData, categoryData]) => {
        setDistricts(locationData)
        setCategories(categoryData)
        const selectedDistrict = locationData.find((item) => item.id === Number(initialDistrict))
        const validUpazila = selectedDistrict?.upazilas.some((item) => item.id === Number(initialUpazila))
        if (initialDistrict && (!selectedDistrict || !validUpazila)) {
          setForm((current) => ({ ...current, district: selectedDistrict ? String(selectedDistrict.id) : "", upazila: "" }))
        }
      })
      .catch((requestError) => setError(requestError.message || "Could not load request options."))
      .finally(() => setLoading(false))
  }, [])

  const update = (field, value) => {
    keyRef.current = requestKey()
    setForm((current) => ({ ...current, [field]: value }))
    setError("")
  }

  const toggle = (field, value) => {
    const next = form[field].includes(value)
      ? form[field].filter((item) => item !== value)
      : [...form[field], value]
    update(field, next)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    if (!form.assistance_categories.length) {
      setError("Choose at least one type of assistance.")
      return
    }
    setBusy(true)
    setError("")
    try {
      const payload = {
        ...form,
        district: Number(form.district),
        upazila: Number(form.upazila),
        people_affected: Number(form.people_affected),
        assistance_categories: form.assistance_categories,
        affected_person_name: form.affected_person_name.trim(),
        contact_phone: form.contact_phone.trim(),
        reporter_name: form.reporter_name.trim(),
        reporter_phone: form.reporter_phone.trim(),
        relation_to_affected: form.relation_to_affected.trim(),
        description: form.description.trim(),
      }
      const result = await api("/api/help-requests/", {
        method: "POST",
        headers: { "Idempotency-Key": keyRef.current },
        body: payload,
      })
      setReceipt(result)
    } catch (requestError) {
      setError(requestError.message || "The request could not be submitted. Retry with the same details.")
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="mx-auto max-w-2xl px-4 py-12"><Spinner /></div>

  if (receipt) return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <PageHead title="Request received" sub="A Super Admin will review the information before any team is assigned." />
      <Card>
        <Alert kind="success" title="Save these private tracking details">
          The token is shown once here. It is not included in a link. Keep it private so only you can view this request.
        </Alert>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div><dt className="text-sm text-ink-soft">Request reference</dt><dd className="break-all text-lg font-bold text-forest">{receipt.request_reference}</dd></div>
          <div><dt className="text-sm text-ink-soft">Private tracking token</dt><dd className="break-all font-mono font-semibold">{receipt.tracking_token}</dd></div>
          <div><dt className="text-sm text-ink-soft">Area</dt><dd>{receipt.upazila}, {receipt.district}</dd></div>
          <div><dt className="text-sm text-ink-soft">Status</dt><dd><Badge s={receipt.verification_status} /></dd></div>
        </dl>
        <p className="mt-4 text-sm text-ink-soft">Write down both details. The token cannot be recovered if you lose it.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button to={`/track?ref=${encodeURIComponent(receipt.request_reference)}`}>Track this request</Button>
          <Button variant="secondary" onClick={() => { keyRef.current = requestKey(); setReceipt(null); setForm((current) => ({ ...current, people_affected: "", assistance_categories: [], description: "", risks: [] })) }}>Submit another request</Button>
        </div>
      </Card>
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <PageHead title="Request assistance" sub="No account is required. Request details are reviewed before response planning." />
      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      <form onSubmit={submit} className="space-y-6 rounded-2xl border border-line bg-white p-5 sm:p-8">
        <fieldset>
          <legend className="mb-2 font-semibold">Who is this request for?</legend>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-mint p-1">
            {[ ["direct", "Myself / affected person"], ["proxy", "Someone else"] ].map(([value, title]) => (
              <label key={value} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-[10px] px-3 text-center font-semibold ${form.reporter_type === value ? "bg-forest text-white" : "text-forest hover:bg-white/60"}`}>
                <input className="sr-only" type="radio" name="reporter_type" checked={form.reporter_type === value} onChange={() => update("reporter_type", value)} />{title}
              </label>
            ))}
          </div>
        </fieldset>
        {form.reporter_type === "proxy" && <section className="space-y-4 rounded-xl border border-leaf/30 bg-mint/50 p-4">
          <SectionTitle>Applicant information</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Applicant name" required htmlFor="reporter-name"><Input id="reporter-name" required value={form.reporter_name} onChange={(event) => update("reporter_name", event.target.value)} /></Field>
            <Field label="Applicant phone" required htmlFor="reporter-phone"><Input id="reporter-phone" required inputMode="tel" value={form.reporter_phone} onChange={(event) => update("reporter_phone", event.target.value)} /></Field>
            <Field label="Relationship to affected person" required htmlFor="relation"><Input id="relation" required value={form.relation_to_affected} onChange={(event) => update("relation_to_affected", event.target.value)} /></Field>
            <Field label="Affected person's name" htmlFor="affected-name"><Input id="affected-name" value={form.affected_person_name} onChange={(event) => update("affected_person_name", event.target.value)} /></Field>
          </div>
        </section>}
        <section className="space-y-4">
          <SectionTitle>Location and need</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="District" required htmlFor="request-district"><Select id="request-district" required value={form.district} onChange={(event) => { keyRef.current = requestKey(); setForm((current) => ({ ...current, district: event.target.value, upazila: "" })) }}><option value="">Choose district</option>{districts.map((item) => <option key={item.id} value={item.id}>{nameFor(item)}</option>)}</Select></Field>
            <Field label="Upazila" required htmlFor="request-upazila"><Select id="request-upazila" required disabled={!district} value={form.upazila} onChange={(event) => update("upazila", event.target.value)}><option value="">Choose upazila</option>{(district?.upazilas ?? []).map((item) => <option key={item.id} value={item.id}>{nameFor(item)}</option>)}</Select></Field>
          </div>
          <Field label="Number of affected people" required htmlFor="people"><Input id="people" required type="number" min="1" step="1" inputMode="numeric" value={form.people_affected} onChange={(event) => update("people_affected", event.target.value)} /></Field>
          <fieldset>
            <legend className="mb-2 font-semibold">Assistance needed <span className="text-alert">*</span></legend>
            <div className="flex flex-wrap gap-2">{categories.map((category) => {
              const selected = form.assistance_categories.includes(category.id)
              return <label key={category.id} className={`flex min-h-11 cursor-pointer items-center rounded-full border px-4 font-medium ${selected ? "border-forest bg-forest text-white" : "border-line hover:border-leaf"}`}><input className="sr-only" type="checkbox" checked={selected} onChange={() => toggle("assistance_categories", category.id)} />{nameFor(category)}</label>
            })}</div>
          </fieldset>
        </section>
        <Field label="Contact phone" required htmlFor="request-phone" hint="Use a Bangladesh mobile number. It is visible only to authorized request reviewers."><Input id="request-phone" required inputMode="tel" autoComplete="tel" value={form.contact_phone} onChange={(event) => update("contact_phone", event.target.value)} placeholder="01XXXXXXXXX" /></Field>
        <Field label="Situation details" htmlFor="request-description" hint="Optional. Do not include passwords or financial account information."><TextArea id="request-description" rows={4} value={form.description} onChange={(event) => update("description", event.target.value)} /></Field>
        <fieldset>
          <legend className="mb-2 font-semibold">Urgent risks (optional)</legend>
          <div className="flex flex-wrap gap-2">{riskOptions.map(([value, title]) => {
            const selected = form.risks.includes(value)
            return <label key={value} className={`flex min-h-10 cursor-pointer items-center rounded-full border px-3 text-sm ${selected ? "border-alert bg-red-50 text-red-800" : "border-line"}`}><input type="checkbox" className="mr-2 accent-alert" checked={selected} onChange={() => toggle("risks", value)} />{title}</label>
          })}</div>
        </fieldset>
        <Button type="submit" size="lg" disabled={busy} className="w-full !bg-alert hover:!bg-red-700">{busy ? "Submitting…" : "Submit help request"}</Button>
        <p className="flex items-start gap-2 text-sm text-ink-soft"><ShieldCheck size={17} className="mt-0.5 shrink-0" />Your exact address and contact details are not shown on the public map or volunteer request summaries.</p>
      </form>
    </div>
  )
}

export function PublicTracking() {
  const { tr } = useLanguage()
  const [params] = useSearchParams()
  const [reference, setReference] = useState(params.get("ref") ?? "")
  const [token, setToken] = useState("")
  const [result, setResult] = useState(null)
  const [message, setMessage] = useState("")
  const [feedback, setFeedback] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const lookup = async (event) => {
    event?.preventDefault()
    setBusy(true); setError(""); setMessage(""); setFeedback("")
    try { setResult(await api("/api/help-requests/track/", { method: "POST", body: { reference, token } })) }
    catch (requestError) { setResult(null); setError(requestError.message || "Reference and token did not match.") }
    finally { setBusy(false) }
  }
  const submitClarification = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setFeedback("")
    try {
      await api("/api/help-requests/clarification/", { method: "POST", body: { reference, token, message } })
      setMessage("")
      setResult(await api("/api/help-requests/track/", { method: "POST", body: { reference, token } }))
      setFeedback("Your clarification was sent for review.")
    } catch (requestError) { setError(requestError.message || "Could not send clarification.") }
    finally { setBusy(false) }
  }
  return <div className="mx-auto max-w-2xl px-4 py-10 sm:py-12">
    <PageHead title="Track a request" sub="Enter the reference and private token you received after submission." />
    <Card>
      <form className="space-y-4" onSubmit={lookup}>
        <Field label="Request reference" required htmlFor="track-reference"><Input id="track-reference" required autoComplete="off" value={reference} onChange={(event) => { setReference(event.target.value); setResult(null) }} /></Field>
        <Field label="Private tracking token" required htmlFor="track-token"><Input id="track-token" required autoComplete="off" value={token} onChange={(event) => { setToken(event.target.value); setResult(null) }} /></Field>
        {error && <Alert kind="error">{error}</Alert>}
        {feedback && <Alert kind="success">{feedback}</Alert>}
        {message && <Alert kind="success">{message}</Alert>}
        <Button type="submit" disabled={busy}>{busy ? "Checking…" : "View request status"}</Button>
      </form>
    </Card>
    {result && <Card className="mt-5">
      <SectionTitle>{result.request_reference}</SectionTitle>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-sm text-ink-soft">Area</dt><dd>{result.upazila}, {result.district}</dd></div>
        <div><dt className="text-sm text-ink-soft">People affected</dt><dd>{result.people_affected}</dd></div>
        <div><dt className="text-sm text-ink-soft">Assistance requested</dt><dd>{result.assistance_categories?.join(", ")}</dd></div>
        <div><dt className="text-sm text-ink-soft">Verification</dt><dd><Badge s={result.verification_status} /></dd></div>
        {result.mission_status && <div><dt className="text-sm text-ink-soft">Response progress</dt><dd><Badge s={result.mission_status} /></dd></div>}
      </dl>
      <p className="mt-4 text-sm text-ink-soft">Verification and response progress are separate steps. Submission does not mean a response team has been assigned.</p>
      {result.clarification?.status === "requested" && <form onSubmit={submitClarification} className="mt-6 space-y-4 border-t border-line pt-5">
        <Alert kind="warn" title="Additional information requested">{result.clarification.request_note}</Alert>
        <Field label="Your response" required htmlFor="clarification-message"><TextArea id="clarification-message" required maxLength={4000} value={message} onChange={(event) => setMessage(event.target.value)} /></Field>
        <Button type="submit" disabled={busy}>Send information for review</Button>
      </form>}
      <div className="mt-5 flex gap-3"><Button to="/map" variant="secondary">View map</Button><Button to="/" variant="ghost">Home</Button></div>
    </Card>}
  </div>
}

export function PublicHelpRequests() {
  const { language } = useLanguage()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  useEffect(() => { api("/api/help-requests/safe-open/").then(setRows).catch((value) => setError(value.message || "Could not load request summaries.")).finally(() => setLoading(false)) }, [])
  return <div className="mx-auto max-w-6xl">
    <PageHead title="Verified help requests" sub="These privacy safe summaries are for situational awareness. Super Admins assign response teams." />
    {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
    {loading ? <Spinner /> : rows.length ? <div className="grid gap-4 lg:grid-cols-2">{rows.map((row) => <Card key={row.request_reference}>
      <div className="flex items-start justify-between gap-3"><p className="font-semibold">{row.request_reference}</p><Badge s={row.priority} /></div>
      <p className="mt-2 text-xl font-bold text-forest">{row.assistance_categories?.join(", ")}</p>
      <p className="mt-3 flex items-center gap-1 text-ink-soft"><MapPin size={16} />{row.upazila}, {row.district}</p>
      <p className="mt-2 flex items-center gap-1"><Users size={16} />{row.people_affected} people</p>
      <p className="mt-3 text-sm text-ink-soft">Names, phone numbers and exact addresses are not included. Volunteers cannot accept public requests directly.</p>
    </Card>)}</div> : <Empty title="No verified requests available">New safe summaries appear after an administrator verifies a request.</Empty>}
    <div className="mt-5 flex gap-3"><Button to="/volunteer/missions" variant="secondary">My missions</Button><Button to="/map" variant="ghost">Map</Button></div>
  </div>
}

export function PublicMapPage() {
  const { language } = useLanguage()
  const [districts, setDistricts] = useState([])
  const [summary, setSummary] = useState([])
  const [selected, setSelected] = useState(null)
  const [upazilaId, setUpazilaId] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    Promise.all([api("/api/locations/districts/"), api("/api/map/summary/")])
      .then(([locationData, summaryData]) => { setDistricts(locationData); setSummary(summaryData) })
      .catch((requestError) => setError(requestError.message || "Could not load the map data."))
      .finally(() => setLoading(false))
  }, [])
  const shapeDistrict = (shape) => districts.find((item) => (item.name_bn || "").normalize("NFC") === shape.name.normalize("NFC"))
  const selectedDistrict = districts.find((item) => item.id === Number(selected))
  const currentSummary = summary.find((item) => item.district_id === Number(selected))
  const upazilas = selectedDistrict?.upazilas ?? []
  const applyToArea = upazilaId ? `/apply?districtId=${selectedDistrict.id}&upazilaId=${upazilaId}` : "/apply"
  const pickDistrict = (id) => { setSelected(id); setUpazilaId("") }
  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
    <PageHead title="Bangladesh response map" sub="Area level verified request summaries. The outlined boundaries are illustrative." action={<Button to={applyToArea} className="!bg-alert hover:!bg-red-700">Request assistance</Button>} />
    {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
    {loading ? <Card><Spinner label="Loading location and summary data…" /></Card> : <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="bg-[#f3f6f3] p-4 sm:p-7">
          <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto max-h-[680px] w-full max-w-[500px]" role="img" aria-label="Illustrative map of Bangladesh districts">
            <path d={OUTLINE} fill="#e9eee9" stroke="#12372a" strokeWidth="1.4" />
            {DISTRICT_SHAPES.map((shape) => {
              const match = shapeDistrict(shape)
              const data = summary.find((item) => item.district_id === match?.id)
              const active = match?.id === Number(selected)
              return <g key={shape.name}>
                <path d={shape.d} fill={active ? "#c5e0d1" : data?.count_label === "3+" ? "#f8c978" : "#f4f7f4"} stroke="#6f8a7a" strokeWidth="0.65" className={match ? "cursor-pointer hover:fill-[#c5e0d1]" : ""} onClick={() => match && pickDistrict(match.id)} />
                <text x={shape.c[0]} y={shape.c[1]} textAnchor="middle" fontSize="4.5" fill="#12372a" pointerEvents="none">{shape.name}</text>
              </g>
            })}
          </svg>
          <p className="mx-auto mt-2 max-w-xl text-center text-xs text-ink-soft">The map outline is approximate. Use the location list to select a district from the current database.</p>
        </div>
        <aside className="border-t border-line p-5 lg:border-l lg:border-t-0">
          <div className="flex items-center gap-2 text-sm text-ink-soft"><span className="size-3 rounded-sm bg-[#f8c978]" />At least 3 verified requests in this district</div>
          <div className="mt-4"><Field label="Choose a district" htmlFor="map-district"><Select id="map-district" value={selected ?? ""} onChange={(event) => pickDistrict(event.target.value)}><option value="">Choose district</option>{districts.map((item) => <option key={item.id} value={item.id}>{label(item, language)}</option>)}</Select></Field></div>
          {selectedDistrict && <div className="mt-5 border-t border-line pt-5">
            <p className="text-sm text-ink-soft">District</p><h2 className="font-display text-2xl font-bold text-forest">{label(selectedDistrict, language)}</h2>
            <p className="mt-3 font-semibold">{currentSummary?.count_label === "3+" ? `${currentSummary.verified_requests} verified requests` : "Fewer than 3 or no public count"}</p>
            <p className="mt-2 text-sm text-ink-soft">Counts are generalized and suppressed below three. No exact household locations are displayed.</p>
            <div className="mt-5"><Field label="Choose an upazila for your request" htmlFor="map-upazila"><Select id="map-upazila" value={upazilaId} onChange={(event) => setUpazilaId(event.target.value)}><option value="">Choose upazila</option>{upazilas.map((item) => <option key={item.id} value={item.id}>{label(item, language)}</option>)}</Select></Field></div>
            <Button to={applyToArea} className="mt-4 w-full">Continue to application</Button>
          </div>}
          {!selectedDistrict && <div className="mt-5"><Empty icon={<MapPin size={22} />} title="Select an area">Map selection prefills the application with current database locations.</Empty></div>}
        </aside>
      </div>
    </div>}
  </div>
}
