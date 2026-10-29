import { useCallback, useEffect, useMemo, useState } from "react"
import { Building2, CircleCheck, MapPin, Users } from "lucide-react"
import { Navigate, useNavigate } from "react-router"
import { useLanguage } from "./i18n"
import { api } from "./api"
import { useAuth } from "./auth"
import { Alert, Badge, Button, Card, Dialog, Empty, Field, Input, PageHead, SectionTitle, Select, Spinner, TextArea } from "./ui"

const DRAFT_KEY = "shara.organization-registration-draft"
const organizationTypes = [
  ["ngo", "বেসরকারি উন্নয়ন সংস্থা (এনজিও)"],
  ["nonprofit", "অলাভজনক / দাতব্য সংস্থা"],
  ["community", "স্থানীয় কমিউনিটি সংগঠন"],
  ["government", "সরকারি প্রতিষ্ঠান"],
  ["educational", "শিক্ষাপ্রতিষ্ঠানভিত্তিক সংগঠন"],
]

function initialOrganizationDraft() {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY)
    return raw ? { ...emptyOrganization, ...JSON.parse(raw) } : emptyOrganization
  } catch {
    return emptyOrganization
  }
}

const emptyOrganization = {
  name: "",
  description: "",
  organization_type: "",
  contact_email: "",
  contact_phone: "",
  service_districts: [],
  service_upazilas: [],
}

function ids(values) {
  return new Set(values.map(Number))
}

export function OrganizationRegistrationPage() {
  const { tr, language } = useLanguage()
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(initialOrganizationDraft)
  const [districts, setDistricts] = useState([])
  const [locationDistrictId, setLocationDistrictId] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [submittedName, setSubmittedName] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setDistricts(await api("/api/locations/districts/"))
    } catch (requestError) {
      setError(requestError.message || tr("অবস্থান তালিকা লোড করা যায়নি।"))
    } finally {
      setLoading(false)
    }
  }, [tr])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    try {
      if (form.name || form.description || form.contact_email || form.contact_phone) {
        window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form))
      }
    } catch {
      // Preserve the draft when available; no account credentials are stored here.
    }
  }, [form])

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const toggleId = (key, id) => {
    const selected = ids(form[key])
    if (selected.has(id)) selected.delete(id)
    else selected.add(id)
    if (key === "service_districts" && !selected.has(id)) {
      const district = districts.find((item) => item.id === id)
      const upazilaIds = new Set((district?.upazilas ?? []).map((item) => item.id))
      setForm((current) => ({
        ...current,
        service_districts: [...selected],
        service_upazilas: current.service_upazilas.filter((item) => !upazilaIds.has(Number(item))),
      }))
      return
    }
    set(key, [...selected])
  }
  const locationDistrict = districts.find((item) => item.id === Number(locationDistrictId))
  const locationChoices = (locationDistrict?.upazilas ?? []).filter((item) => ids(form.service_districts).has(item.district))
  const districtLabel = (district) => language === "bn" ? district.name_bn : district.name_en || district.name_bn
  const upazilaLabel = (upazila) => {
    const district = districts.find((item) => item.id === upazila.district)
    return `${language === "bn" ? upazila.name_bn : upazila.name_en || upazila.name_bn}, ${district ? districtLabel(district) : ""}`
  }

  const submit = async (event) => {
    event.preventDefault()
    setError("")
    if (!form.name.trim() || !form.description.trim() || !form.organization_type || !form.contact_email.trim() || !form.contact_phone.trim() || !form.service_districts.length || !form.service_upazilas.length) {
      setError(tr("নাম, ধরন, বিবরণ, যোগাযোগের তথ্য, জেলা ও অন্তত একটি লোকেশন দিন।"))
      return
    }
    if (!user) {
      try { window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form)) } catch { /* Draft preservation is best effort. */ }
      navigate(`/login?next=${encodeURIComponent("/organization/register")}`)
      return
    }
    setBusy(true)
    try {
      await api("/api/organizations/", {
        method: "POST",
        body: {
          ...form,
          name: form.name.trim(),
          description: form.description.trim(),
          contact_email: form.contact_email.trim(),
          service_districts: form.service_districts.map(Number),
          service_upazilas: form.service_upazilas.map(Number),
        },
      })
      try { window.sessionStorage.removeItem(DRAFT_KEY) } catch { /* no-op */ }
      await refreshUser()
      setSubmittedName(form.name)
    } catch (requestError) {
      setError(requestError.message || tr("নিবন্ধনের আবেদন জমা দেওয়া যায়নি।"))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-12"><Spinner /></div>
  if (submittedName) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-mint text-leaf"><CircleCheck size={36} /></span>
        <h1 className="mt-5 font-display text-3xl font-bold text-forest">{tr("নিবন্ধনের আবেদন গ্রহণ করা হয়েছে")}</h1>
        <p className="mt-3 text-lg text-ink-soft"><strong className="text-ink">{submittedName}</strong>{tr("-এর তথ্য যাচাইয়ের অপেক্ষায় রয়েছে।")}</p>
        <div className="mt-6"><Alert kind="warn" title={tr("যাচাই চলছে")}>{tr("সুপার অ্যাডমিন অনুমোদনের আগে সংগঠন পরিচালনার সুবিধা সক্রিয় হবে না।")}</Alert></div>
        <Button className="mt-6" onClick={() => navigate("/organization/status")}>{tr("নিবন্ধনের অবস্থা দেখুন")}</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <div className="max-w-2xl">
        <p className="mb-2 font-semibold text-leaf">{tr("সংগঠনের অংশীদারিত্ব")}</p>
        <h1 className="font-display text-3xl font-bold text-forest sm:text-4xl">{tr("সংগঠন হিসেবে নিবন্ধন")}</h1>
        <p className="mt-2 text-lg text-ink-soft">{tr("স্বেচ্ছাসেবক দল গঠন ও মানবিক সহায়তা সমন্বয়ের জন্য আপনার সংগঠনের তথ্য দিন।")}</p>
      </div>
      {user ? (
        <Alert kind="info" title={tr("দায়িত্বশীল আবেদনকারী")}>{tr("আবেদনটি আপনার অ্যাকাউন্টের সঙ্গে যুক্ত হবে:")} <strong>{user.name}</strong> · {user.phone_number}</Alert>
      ) : (
        <div className="mt-5"><Alert kind="warn" title={tr("সাইন ইন প্রয়োজন")}>{tr("আবেদন চূড়ান্ত করতে একটি স্বাক্ষরিত অ্যাকাউন্ট দরকার। আপনার খসড়া এই ট্যাবে রাখা হবে।")}</Alert></div>
      )}
      {error && <div className="mt-4"><Alert kind="error">{tr(error)} <Button variant="ghost" onClick={load}>{tr("আবার চেষ্টা করুন")}</Button></Alert></div>}
      {!districts.length && <div className="mt-4"><Alert kind="warn">{tr("অবস্থান তালিকা এখনো প্রাথমিক; ডাটাবেসে যুক্ত জেলাগুলোই দেখানো হবে।")}</Alert></div>}

      <form onSubmit={submit} className="mt-7 space-y-8 rounded-2xl border border-line bg-white p-5 sm:p-8">
        <Alert kind="info" title={tr("যাচাই প্রয়োজন")}>{tr("নিবন্ধনের পর অবস্থা ‘যাচাই চলছে’ থাকবে। অনুমোদন শুধু সুপার অ্যাডমিন দিতে পারবেন।")}</Alert>
        <section className="space-y-5">
          <div><h2 className="font-display text-xl font-bold text-forest">{tr("সংগঠনের পরিচিতি")}</h2><p className="text-sm text-ink-soft">{tr("সংগঠনটি কী এবং কীভাবে মানবিক সহায়তায় কাজ করে")}</p></div>
          <Field label={tr("সংগঠনের নাম")} required htmlFor="organization-name"><Input id="organization-name" required value={form.name} onChange={(event) => set("name", event.target.value)} /></Field>
          <Field label={tr("সংগঠনের ধরন")} required htmlFor="organization-type">
            <Select id="organization-type" required value={form.organization_type} onChange={(event) => set("organization_type", event.target.value)}>
              <option value="">{tr("ধরন বেছে নিন")}</option>
              {organizationTypes.map(([value, label]) => <option key={value} value={value}>{tr(label)}</option>)}
            </Select>
          </Field>
          <Field label={tr("সংক্ষিপ্ত বিবরণ")} required htmlFor="organization-description" hint={tr("সংগঠনের লক্ষ্য, অভিজ্ঞতা এবং প্রধান কার্যক্রম সংক্ষেপে লিখুন।")}>
            <TextArea id="organization-description" required rows={5} value={form.description} onChange={(event) => set("description", event.target.value)} />
          </Field>
        </section>

        <section className="space-y-5 border-t border-line pt-7">
          <div><h2 className="font-display text-xl font-bold text-forest">{tr("যোগাযোগের তথ্য")}</h2><p className="text-sm text-ink-soft">{tr("যাচাই ও জরুরি সমন্বয়ের জন্য দায়িত্বশীল যোগাযোগ")}</p></div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={tr("যোগাযোগের ইমেইল")} required htmlFor="organization-email"><Input id="organization-email" required type="email" value={form.contact_email} onChange={(event) => set("contact_email", event.target.value)} placeholder="contact@example.org" /></Field>
            <Field label={tr("যোগাযোগের ফোন")} required htmlFor="organization-phone"><Input id="organization-phone" required inputMode="tel" value={form.contact_phone} onChange={(event) => set("contact_phone", event.target.value)} placeholder={tr("০১৭XXXXXXXX")} /></Field>
          </div>
        </section>

        <section className="space-y-5 border-t border-line pt-7">
          <div><h2 className="font-display text-xl font-bold text-forest">{tr("কার্যএলাকা ও লোকেশন")}</h2><p className="text-sm text-ink-soft">{tr("একাধিক জেলা এবং সুনির্দিষ্ট উপজেলা নির্বাচন করা যাবে")}</p></div>
          <fieldset>
            <legend className="mb-3 text-[15px] font-semibold">{tr("কার্যপরিচালনার জেলা")} <span className="text-alert">*</span></legend>
            <div className="flex flex-wrap gap-2">
              {districts.map((district) => {
                const checked = ids(form.service_districts).has(district.id)
                return <label key={district.id} className={`flex min-h-11 cursor-pointer items-center rounded-full border px-4 font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-leaf ${checked ? "border-forest bg-forest text-white" : "border-[#c5d0c8] hover:border-leaf"}`}><input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleId("service_districts", district.id)} />{checked ? "✓ " : ""}{districtLabel(district)}</label>
              })}
            </div>
          </fieldset>
          <Field label={tr("লোকেশনের জেলা")} required htmlFor="organization-location-district" hint={tr("আগে কার্যপরিচালনার জেলা নির্বাচন করুন।")}>
            <Select id="organization-location-district" value={locationDistrictId} onChange={(event) => setLocationDistrictId(event.target.value)}>
              <option value="">{tr("জেলা বেছে নিন")}</option>
              {districts.filter((item) => ids(form.service_districts).has(item.id)).map((district) => <option key={district.id} value={district.id}>{districtLabel(district)}</option>)}
            </Select>
          </Field>
          <div className="flex flex-wrap gap-2">
            {locationChoices.map((upazila) => {
              const checked = ids(form.service_upazilas).has(upazila.id)
              return <label key={upazila.id} className={`flex min-h-11 cursor-pointer items-center rounded-full border px-4 font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-leaf ${checked ? "border-leaf bg-mint text-forest" : "border-[#c5d0c8] hover:border-leaf"}`}><input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleId("service_upazilas", upazila.id)} />{checked ? "✓ " : ""}{districtLabel(locationDistrict)} · {language === "bn" ? upazila.name_bn : upazila.name_en || upazila.name_bn}</label>
            })}
          </div>
          {form.service_upazilas.length > 0 && <div className="rounded-xl bg-paper p-4"><p className="mb-2 text-sm font-semibold text-forest">{tr("নির্বাচিত লোকেশন")}</p><p>{form.service_upazilas.map((id) => districts.flatMap((district) => district.upazilas).find((item) => item.id === Number(id))).filter(Boolean).map(upazilaLabel).map(tr).join(" · ")}</p></div>}
        </section>

        <section className="border-t border-line pt-7">
          <h2 className="font-display text-xl font-bold text-forest">{tr("যাচাইয়ের পর যা করতে পারবেন")}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex gap-3 rounded-xl bg-mint/60 p-4"><Users className="shrink-0 text-leaf" size={22} /><p><strong className="block">{tr("স্বেচ্ছাসেবক ব্যবস্থাপনা")}</strong><span className="text-sm text-ink-soft">{tr("সদস্যপদের অনুরোধ পর্যালোচনা ও অনুমোদিত সদস্য দেখা")}</span></p></div>
            <div className="flex gap-3 rounded-xl bg-mint/60 p-4"><Building2 className="shrink-0 text-leaf" size={22} /><p><strong className="block">{tr("সংগঠনের প্রোফাইল")}</strong><span className="text-sm text-ink-soft">{tr("সংগঠনের অনুমোদিত তথ্য হালনাগাদ")}</span></p></div>
          </div>
        </section>
        <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-7">
          {!user && <Button variant="ghost" onClick={() => navigate(`/volunteer/register?next=${encodeURIComponent("/organization/register")}`)}>{tr("অ্যাকাউন্ট তৈরি করুন")}</Button>}
          <Button to="/" variant="secondary">{tr("বাতিল")}</Button>
          <Button type="submit" disabled={busy || !districts.length}>{tr(busy ? "জমা দেওয়া হচ্ছে…" : user ? "যাচাইয়ের জন্য জমা দিন" : "সাইন ইন করে জমা দিন")}</Button>
        </div>
      </form>
    </div>
  )
}

export function OrganizationStatusPage() {
  const { tr } = useLanguage()
  const { user, status } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try { setRows(await api("/api/organizations/mine/")) }
    catch (requestError) { setError(requestError.message || tr("নিবন্ধনের অবস্থা লোড করা যায়নি।")) }
    finally { setLoading(false) }
  }, [tr])
  useEffect(() => { if (user) load() }, [user, load])

  if (status === "loading") return <div className="mx-auto max-w-3xl px-4 py-12"><Spinner /></div>
  if (!user) return <Navigate to="/login?next=%2Forganization%2Fstatus" replace />

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <PageHead title={tr("সংগঠনের নিবন্ধনের অবস্থা")} sub={tr("আপনার অ্যাকাউন্টের সঙ্গে যুক্ত আবেদনগুলো") } action={<Button to="/organization/register">{tr("নতুন সংগঠন নিবন্ধন")}</Button>} />
      {error && <Alert kind="error">{tr(error)} <Button variant="ghost" onClick={load}>{tr("আবার চেষ্টা করুন")}</Button></Alert>}
      {loading ? <Spinner /> : rows.length ? <div className="mt-5 grid gap-4">{rows.map((organization) => (
        <Card key={organization.id}>
          <div className="flex flex-wrap items-center justify-between gap-3"><SectionTitle>{organization.name}</SectionTitle><Badge s={organization.registration_status}>{tr(organization.registration_status === "pending" ? "যাচাই চলছে" : organization.registration_status === "approved" ? "যাচাইকৃত" : "প্রত্যাখ্যাত")}</Badge></div>
          <p className="mt-2">{organization.description}</p>
          <p className="mt-3 text-sm text-ink-soft">{tr("আবেদন নম্বর")}: {organization.id}</p>
          {organization.review_note && <Alert kind={organization.registration_status === "rejected" ? "warn" : "info"} title={tr("পর্যালোচনার নোট")}>{organization.review_note}</Alert>}
          {organization.registration_status === "approved" && <Button className="mt-4" to="/org">{tr("সংগঠন কর্মক্ষেত্রে যান")}</Button>}
        </Card>
      ))}</div> : <Empty title={tr("কোনো নিবন্ধন পাওয়া যায়নি")} action={<Button to="/organization/register">{tr("সংগঠন নিবন্ধন")}</Button>}>{tr("আবেদন জমা দিলে তার অবস্থা এখানে দেখা যাবে।")}</Empty>}
    </div>
  )
}

export function OrganizationDashboardPage() {
  const { tr } = useLanguage()
  const { activeOrganizationId, user } = useAuth()
  const [organization, setOrganization] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    if (!activeOrganizationId) return
    setLoading(true)
    setError("")
    try {
      const [org, requests] = await Promise.all([
        api(`/api/organizations/${activeOrganizationId}/`),
        api(`/api/organizations/${activeOrganizationId}/membership-requests/`),
      ])
      setOrganization(org)
      setPendingCount(requests.filter((item) => item.status === "pending").length)
    } catch (requestError) { setError(requestError.message || tr("সংগঠনের তথ্য লোড করা যায়নি।")) }
    finally { setLoading(false) }
  }, [activeOrganizationId, tr])
  useEffect(() => { load() }, [load])

  return (
    <div className="mx-auto max-w-5xl">
      {loading && <Spinner />}
      {error && <Alert kind="error">{tr(error)} <Button variant="ghost" onClick={load}>{tr("আবার চেষ্টা করুন")}</Button></Alert>}
      {organization && <>
        <PageHead title={tr(organization.name)} sub={tr(`স্বাগতম, ${user?.name ?? ""} · সংগঠন প্রশাসন পোর্টাল`)} action={<Button to="/org/profile" variant="secondary">{tr("সংগঠনের প্রোফাইল")}</Button>} />
        <Alert kind="success" title={tr("যাচাইকৃত সংগঠন")}>{tr("আপনি এই সংগঠনের অনুমোদিত প্রশাসক। সদস্যপদের অনুরোধ পর্যালোচনা করতে পারেন।")}</Alert>
        <div className="my-6 grid gap-4 sm:grid-cols-2">
          <Card><p>{tr("অপেক্ষমাণ সদস্যপদের অনুরোধ")}</p><p className="my-3 font-display text-3xl font-bold text-forest">{pendingCount}</p><Button to="/org/memberships" variant="secondary">{tr("অনুরোধ পর্যালোচনা")}</Button></Card>
          <Card><SectionTitle>{tr("পরবর্তী করণীয়")}</SectionTitle><p className="text-ink-soft">{tr("অনুমোদিত সদস্যদের দল বরাদ্দ Part 3-এ যুক্ত হবে।")}</p><Button to="/org/volunteers" className="mt-4">{tr("অনুমোদিত সদস্য দেখুন")}</Button></Card>
        </div>
      </>}
    </div>
  )
}

export function AdminDashboardPage() {
  const { tr } = useLanguage()
  const [pendingCount, setPendingCount] = useState(null)
  const [error, setError] = useState("")
  const load = useCallback(async () => {
    setError("")
    try { setPendingCount((await api("/api/organizations/review-queue/")).length) }
    catch (requestError) { setError(requestError.message || tr("আবেদনের সারাংশ লোড করা যায়নি।")) }
  }, [tr])
  useEffect(() => { load() }, [load])
  return (
    <div className="mx-auto max-w-5xl">
      <PageHead title={tr("সুপার অ্যাডমিন সারসংক্ষেপ")} sub={tr("সিস্টেম প্রশাসন ও যাচাইয়ের কাজ")} />
      {error && <Alert kind="error">{tr(error)} <Button variant="ghost" onClick={load}>{tr("আবার চেষ্টা করুন")}</Button></Alert>}
      <Card className="mt-5">
        <SectionTitle>{tr("সংগঠন যাচাই")}</SectionTitle>
        <p className="my-3 font-display text-3xl font-bold text-forest">{pendingCount ?? "—"}</p>
        <p className="mb-4 text-ink-soft">{tr("অপেক্ষমাণ আবেদন পর্যালোচনা করুন।")}</p>
        <Button to="/admin/organizations">{tr("আবেদন পর্যালোচনা")}</Button>
      </Card>
      <div className="mt-5"><Alert kind="warn" title={tr("অন্যান্য প্রশাসনিক কাজ")}>{tr("সহায়তার আবেদন, কার্যক্রম, দল এবং সরবরাহকারী ব্যবস্থাপনা পরবর্তী মাইগ্রেশন অংশে যুক্ত হবে এবং এখনো নমুনা ডেটা ব্যবহার করে।")}</Alert></div>
    </div>
  )
}

export function OrganizationProfilePage() {
  const { tr } = useLanguage()
  const { activeOrganizationId } = useAuth()
  const [organization, setOrganization] = useState(null)
  const [form, setForm] = useState(null)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!activeOrganizationId) return
    setLoading(true)
    setError("")
    try {
      const org = await api(`/api/organizations/${activeOrganizationId}/`)
      setOrganization(org)
      setForm({ name: org.name, description: org.description, organization_type: org.organization_type, contact_email: org.contact_email, contact_phone: org.contact_phone })
    } catch (requestError) { setError(requestError.message || tr("সংগঠনের তথ্য লোড করা যায়নি।")) }
    finally { setLoading(false) }
  }, [activeOrganizationId, tr])
  useEffect(() => { load() }, [load])

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const org = await api(`/api/organizations/${activeOrganizationId}/`, { method: "PATCH", body: form })
      setOrganization((current) => ({ ...current, ...org }))
      setSaved(true)
    } catch (requestError) { setError(requestError.message || tr("পরিবর্তন সংরক্ষণ করা যায়নি।")) }
    finally { setBusy(false) }
  }

  if (loading) return <Spinner />
  if (!organization || !form) return <div><Alert kind="error">{tr(error || "সংগঠনের তথ্য পাওয়া যায়নি.")}</Alert><Button className="mt-4" onClick={load}>{tr("আবার চেষ্টা করুন")}</Button></div>
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  return (
    <div className="mx-auto max-w-4xl">
      <PageHead title={tr("সংগঠনের প্রোফাইল")} sub={tr("অনুমোদিত সংগঠনের যোগাযোগ ও পরিচিতির তথ্য")} />
      {saved && <div className="mb-4"><Alert kind="success">{tr("পরিবর্তন সংরক্ষিত হয়েছে।")}</Alert></div>}
      <Card>
        <div className="flex flex-wrap items-center gap-4"><span className="grid size-14 place-items-center rounded-full bg-mint text-forest"><Building2 /></span><div><SectionTitle>{organization.name}</SectionTitle><Badge s="verified">{tr("যাচাইকৃত")}</Badge></div></div>
        <p className="mt-4">{organization.description}</p>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {[["ID (read-only)", organization.id], ["Registration status (read-only)", organization.registration_status], ["Service districts", organization.service_district_names.join(", ")], ["Service locations", organization.service_upazila_labels.join(", ")]].map(([label, value]) => <div key={label}><dt className="text-sm text-ink-soft">{tr(label)}</dt><dd className="break-words">{tr(String(value || "—"))}</dd></div>)}
        </dl>
      </Card>
      {error && <div className="my-4"><Alert kind="error">{tr(error)}</Alert></div>}
      <form className="mt-5 space-y-5 rounded-2xl border border-line bg-white p-5 sm:p-8" onSubmit={submit}>
        <Alert>{tr("যাচাই-অবস্থা, প্রশাসক সম্পর্ক, আইডি ও তৈরির সময় এই ফর্ম থেকে পরিবর্তন করা যায় না।")}</Alert>
        <Field label={tr("সংগঠনের নাম")} required htmlFor="edit-org-name"><Input id="edit-org-name" required value={form.name} onChange={(event) => set("name", event.target.value)} /></Field>
        <Field label={tr("সংগঠনের ধরন")} required htmlFor="edit-org-type"><Select id="edit-org-type" required value={form.organization_type} onChange={(event) => set("organization_type", event.target.value)}>{organizationTypes.map(([value, label]) => <option key={value} value={value}>{tr(label)}</option>)}</Select></Field>
        <Field label={tr("সংক্ষিপ্ত বিবরণ")} required htmlFor="edit-org-description"><TextArea id="edit-org-description" required rows={4} value={form.description} onChange={(event) => set("description", event.target.value)} /></Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={tr("যোগাযোগের ইমেইল")} required htmlFor="edit-org-email"><Input id="edit-org-email" required type="email" value={form.contact_email} onChange={(event) => set("contact_email", event.target.value)} /></Field>
          <Field label={tr("যোগাযোগের ফোন")} required htmlFor="edit-org-phone"><Input id="edit-org-phone" required value={form.contact_phone} onChange={(event) => set("contact_phone", event.target.value)} /></Field>
        </div>
        <div className="flex justify-end"><Button type="submit" disabled={busy}>{tr(busy ? "সংরক্ষণ করা হচ্ছে…" : "পরিবর্তন সংরক্ষণ")}</Button></div>
      </form>
    </div>
  )
}

export function OrganizationMembershipsPage({ volunteersOnly = false }) {
  const { tr } = useLanguage()
  const { activeOrganizationId } = useAuth()
  const [requests, setRequests] = useState([])
  const [memberships, setMemberships] = useState([])
  const [query, setQuery] = useState("")
  const [decision, setDecision] = useState(null)
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!activeOrganizationId) return
    setLoading(true)
    setError("")
    try {
      const [requestRows, memberRows] = await Promise.all([
        api(`/api/organizations/${activeOrganizationId}/membership-requests/`),
        api(`/api/organizations/${activeOrganizationId}/memberships/`),
      ])
      setRequests(requestRows)
      setMemberships(memberRows.filter((item) => item.status === "active"))
    } catch (requestError) { setError(requestError.message || tr("সদস্যপদের তথ্য লোড করা যায়নি।")) }
    finally { setLoading(false) }
  }, [activeOrganizationId, tr])
  useEffect(() => { load() }, [load])

  const rows = volunteersOnly
    ? memberships.map((membership) => ({ ...membership, status: "approved", request_note: "", decision_note: "" }))
    : requests.filter((request) => request.status !== "approved")
  const filtered = useMemo(() => rows.filter((row) => `${row.volunteer_name} ${row.district_name ?? ""} ${row.upazila_name ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())), [rows, query])

  const decide = async (event) => {
    event.preventDefault()
    if (!decision) return
    setBusy(true)
    setError("")
    try {
      await api(`/api/membership-requests/${decision.id}/${decision.status}/`, {
        method: "POST",
        body: decision.status === "reject" ? { reason } : {},
      })
      setDecision(null)
      setReason("")
      setMessage(tr(decision.status === "approve" ? "সদস্যপদ অনুমোদিত হয়েছে।" : "অনুরোধ প্রত্যাখ্যান করা হয়েছে।"))
      await load()
    } catch (requestError) { setError(requestError.message || tr("সদস্যপদের সিদ্ধান্ত সংরক্ষণ করা যায়নি।")) }
    finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHead title={tr(volunteersOnly ? "অনুমোদিত স্বেচ্ছাসেবক" : "সদস্যপদের অনুরোধ")} sub={tr("শুধু এই সংগঠনের অনুমোদিত প্রশাসকরা এই তালিকা দেখতে ও সিদ্ধান্ত দিতে পারেন.")} />
      {message && <div className="mb-4"><Alert kind="success">{message}</Alert></div>}
      {error && <div className="mb-4"><Alert kind="error">{tr(error)} <Button variant="ghost" onClick={load}>{tr("আবার চেষ্টা করুন")}</Button></Alert></div>}
      {!volunteersOnly && <Input aria-label={tr("সদস্য খুঁজুন")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr("নাম দিয়ে খুঁজুন")} className="mb-5" />}
      {loading ? <Spinner /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((row) => (
            <Card key={row.id}>
              <SectionTitle>{row.volunteer_name}</SectionTitle>
              <p>{[row.upazila_name, row.district_name].filter(Boolean).map(tr).join(", ")}</p>
              {row.skill_names?.length > 0 && <p className="mt-2">{row.skill_names.map(tr).join(", ")}</p>}
              {row.volunteer_phone && <p className="mt-2 text-sm text-ink-soft">{tr("মোবাইল")}: {row.volunteer_phone}</p>}
              <div className="my-3"><Badge s={row.status}>{tr(row.status === "approved" ? "অনুমোদিত সদস্য" : row.status === "pending" ? "অনুরোধ অপেক্ষমাণ" : row.status === "rejected" ? "প্রত্যাখ্যাত" : row.status)}</Badge></div>
              {row.request_note && <p>{row.request_note}</p>}
              {row.decision_note && <p className="mt-2">{tr("কারণ")}: {row.decision_note}</p>}
              {!volunteersOnly && row.status === "pending" && <div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => { setReason(""); setDecision({ id: row.id, status: "approve" }) }}>{tr("অনুমোদন")}</Button><Button variant="secondary" onClick={() => { setReason(""); setDecision({ id: row.id, status: "reject" }) }}>{tr("প্রত্যাখ্যান")}</Button></div>}
            </Card>
          ))}
        </div>
      )}
      {!loading && !filtered.length && <Empty title={tr("কোনো সদস্য বা অনুরোধ নেই")}>{tr("নতুন অনুরোধ এলে এখানে দেখা যাবে।")}</Empty>}
      <Dialog open={!!decision} onClose={() => setDecision(null)} title={tr(decision?.status === "approve" ? "সদস্যপদ অনুমোদন করবেন?" : "প্রত্যাখ্যানের কারণ")}>
        <form className="space-y-4" onSubmit={decide}>
          {error && <Alert kind="error">{tr(error)}</Alert>}
          {decision?.status === "reject" ? <Field label={tr("কারণ")} required htmlFor="membership-reason"><TextArea id="membership-reason" required value={reason} onChange={(event) => setReason(event.target.value)} /></Field> : <p>{tr("অনুমোদন পেলে স্বেচ্ছাসেবক এই সংগঠনের সক্রিয় সদস্য হবেন।")}</p>}
          <div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setDecision(null)}>{tr("বাতিল")}</Button><Button type="submit" disabled={busy}>{tr("নিশ্চিত করুন")}</Button></div>
        </form>
      </Dialog>
    </div>
  )
}

export function AdminOrganizationReviewPage() {
  const { tr } = useLanguage()
  const [organizations, setOrganizations] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [decision, setDecision] = useState(null)
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try { setOrganizations(await api("/api/organizations/review-queue/")) }
    catch (requestError) { setError(requestError.message || tr("নিবন্ধনের তালিকা লোড করা যায়নি।")) }
    finally { setLoading(false) }
  }, [tr])
  useEffect(() => { load() }, [load])

  const approve = async (organization) => {
    setBusyId(organization.id)
    setError("")
    try {
      await api(`/api/organizations/${organization.id}/approve/`, { method: "POST", body: {} })
      setMessage(tr("সংগঠন অনুমোদিত হয়েছে এবং আবেদনকারীকে প্রশাসক প্রবেশাধিকার দেওয়া হয়েছে।"))
      await load()
    } catch (requestError) { setError(requestError.message || tr("অনুমোদন করা যায়নি।")) }
    finally { setBusyId(null) }
  }
  const reject = async (event) => {
    event.preventDefault()
    if (!decision) return
    setBusyId(decision.id)
    setError("")
    try {
      await api(`/api/organizations/${decision.id}/reject/`, { method: "POST", body: { reason } })
      setDecision(null)
      setReason("")
      setMessage(tr("আবেদন প্রত্যাখ্যান করা হয়েছে এবং কারণ সংরক্ষণ করা হয়েছে।"))
      await load()
    } catch (requestError) { setError(requestError.message || tr("আবেদন প্রত্যাখ্যান করা যায়নি।")) }
    finally { setBusyId(null) }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHead title={tr("সংগঠন যাচাই")} sub={tr("শুধু সুপার অ্যাডমিন আবেদন অনুমোদন বা কারণসহ প্রত্যাখ্যান করতে পারেন.")} />
      {message && <div className="mb-4"><Alert kind="success">{message}</Alert></div>}
      {error && <div className="mb-4"><Alert kind="error">{tr(error)} <Button variant="ghost" onClick={load}>{tr("আবার চেষ্টা করুন")}</Button></Alert></div>}
      {loading ? <Spinner /> : organizations.length ? <div className="grid gap-4 md:grid-cols-2">{organizations.map((organization) => (
        <Card key={organization.id}>
          <div className="flex flex-wrap items-center justify-between gap-2"><SectionTitle>{organization.name}</SectionTitle><Badge s="pending">{tr("যাচাই চলছে")}</Badge></div>
          <p className="mt-2">{organization.description}</p>
          <dl className="mt-4 space-y-2 text-sm"><div><dt className="font-semibold">{tr("দায়িত্বশীল আবেদনকারী")}</dt><dd>{organization.registered_by_name || tr("নিবন্ধিত ব্যবহারকারী")}</dd></div><div><dt className="font-semibold">{tr("যোগাযোগ")}</dt><dd>{organization.contact_email} · {organization.contact_phone}</dd></div><div><dt className="font-semibold">{tr("কার্যএলাকা")}</dt><dd>{organization.service_district_names.join(", ")} · {organization.service_upazila_labels.join("; ")}</dd></div></dl>
          <div className="mt-4 flex flex-wrap gap-2"><Button disabled={busyId === organization.id} onClick={() => approve(organization)}>{tr(busyId === organization.id ? "অনুমোদন করা হচ্ছে…" : "অনুমোদন")}</Button><Button variant="secondary" disabled={busyId === organization.id} onClick={() => { setReason(""); setDecision({ id: organization.id, name: organization.name }) }}>{tr("কারণসহ প্রত্যাখ্যান")}</Button></div>
        </Card>
      ))}</div> : <Empty title={tr("কোনো অপেক্ষমাণ আবেদন নেই")}><Button variant="secondary" onClick={load}>{tr("তালিকা হালনাগাদ")}</Button></Empty>}
      <Dialog open={!!decision} onClose={() => setDecision(null)} title={tr(`“${decision?.name ?? ""}” আবেদন প্রত্যাখ্যান করবেন?`)}>
        <form className="space-y-4" onSubmit={reject}>
          {error && <Alert kind="error">{tr(error)}</Alert>}
          <Field label={tr("প্রত্যাখ্যানের কারণ")} required htmlFor="organization-rejection-reason"><TextArea id="organization-rejection-reason" required value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
          <div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setDecision(null)}>{tr("বাতিল")}</Button><Button type="submit" variant="danger" disabled={busyId === decision?.id}>{tr("প্রত্যাখ্যান নিশ্চিত করুন")}</Button></div>
        </form>
      </Dialog>
    </div>
  )
}
