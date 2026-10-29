import { useCallback, useEffect, useMemo, useState } from "react"
import { MapPin, Users } from "lucide-react"
import { Navigate, useNavigate, useSearchParams } from "react-router"
import { useLanguage } from "./i18n"
import { api } from "./api"
import { useAuth, safeReturnPath } from "./auth"
import { Alert, Badge, Button, Card, Empty, Field, Input, PageHead, SectionTitle, Select, Spinner } from "./ui"

const blankProfile = {
  name: "",
  phone_number: "",
  email: "",
  district: "",
  upazila: "",
  service_upazilas: [],
  skills: [],
  availability: "available",
  vehicle_access: false,
  swimming_capability: false,
}

function selectedIds(values) {
  return new Set(values.map(Number))
}

function ProfileFields({ profile, setProfile, districts, skills, tr, language }) {
  const district = districts.find((item) => item.id === Number(profile.district))
  const upazilas = district?.upazilas ?? []
  const toggleId = (key, id) => {
    const current = selectedIds(profile[key])
    if (current.has(id)) current.delete(id)
    else current.add(id)
    setProfile((value) => ({ ...value, [key]: [...current] }))
  }
  const nameFor = (item) => language === "bn" ? item.name_bn : item.name_en || item.name_bn

  return (
    <>
      <section className="space-y-5">
        <SectionTitle>{tr("ব্যক্তিগত তথ্য")}</SectionTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={tr("পূর্ণ নাম")} required htmlFor="profile-name">
            <Input id="profile-name" required value={profile.name} onChange={(event) => setProfile((value) => ({ ...value, name: event.target.value }))} />
          </Field>
          <Field label={tr("মোবাইল নম্বর")} required htmlFor="profile-phone">
            <Input id="profile-phone" required inputMode="tel" autoComplete="tel" value={profile.phone_number} onChange={(event) => setProfile((value) => ({ ...value, phone_number: event.target.value }))} placeholder={tr("০১৭XXXXXXXX")} />
          </Field>
        </div>
        <Field label={tr("ইমেইল")} htmlFor="profile-email">
          <Input id="profile-email" type="email" autoComplete="email" value={profile.email} onChange={(event) => setProfile((value) => ({ ...value, email: event.target.value }))} />
        </Field>
      </section>

      <section className="space-y-5 border-t border-line pt-7">
        <SectionTitle>{tr("অবস্থান ও কাজের এলাকা")}</SectionTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={tr("বর্তমান জেলা")} required htmlFor="profile-district">
            <Select id="profile-district" required value={String(profile.district)} onChange={(event) => setProfile((value) => ({ ...value, district: event.target.value, upazila: "", service_upazilas: [] }))}>
              <option value="">{tr("জেলা বেছে নিন")}</option>
              {districts.map((item) => <option key={item.id} value={item.id}>{nameFor(item)}</option>)}
            </Select>
          </Field>
          <Field label={tr("বর্তমান উপজেলা")} required htmlFor="profile-upazila">
            <Select id="profile-upazila" required disabled={!district} value={String(profile.upazila)} onChange={(event) => setProfile((value) => ({ ...value, upazila: event.target.value }))}>
              <option value="">{tr("উপজেলা বেছে নিন")}</option>
              {upazilas.map((item) => <option key={item.id} value={item.id}>{nameFor(item)}</option>)}
            </Select>
          </Field>
        </div>
        <div>
          <p className="mb-3 text-[15px] font-semibold">{tr("কাজ করতে আগ্রহী এলাকা")}</p>
          <div className="flex flex-wrap gap-2">
            {upazilas.map((item) => {
              const selected = selectedIds(profile.service_upazilas).has(item.id)
              return (
                <label key={item.id} className={`flex min-h-11 cursor-pointer items-center rounded-full border px-4 font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-leaf ${selected ? "border-forest bg-forest text-white" : "border-[#c5d0c8] hover:border-leaf"}`}>
                  <input className="sr-only" type="checkbox" checked={selected} onChange={() => toggleId("service_upazilas", item.id)} />
                  {selected ? "✓ " : ""}{nameFor(item)}
                </label>
              )
            })}
            {!upazilas.length && <p className="text-sm text-ink-soft">{tr("জেলা বেছে নিলে এলাকার তালিকা দেখা যাবে।")}</p>}
          </div>
        </div>
      </section>

      <section className="space-y-5 border-t border-line pt-7">
        <SectionTitle>{tr("দক্ষতা ও সক্ষমতা")}</SectionTitle>
        <div>
          <p className="mb-3 text-[15px] font-semibold">{tr("দক্ষতা")}</p>
          <div className="flex flex-wrap gap-2">
            {skills.map((item) => {
              const selected = selectedIds(profile.skills).has(item.id)
              return (
                <label key={item.id} className={`flex min-h-11 cursor-pointer items-center rounded-full border px-4 font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-leaf ${selected ? "border-leaf bg-mint text-forest" : "border-[#c5d0c8] hover:border-leaf"}`}>
                  <input className="sr-only" type="checkbox" checked={selected} onChange={() => toggleId("skills", item.id)} />
                  {selected ? "✓ " : ""}{tr(item.name)}
                </label>
              )
            })}
          </div>
        </div>
        <Field label={tr("প্রাপ্যতা")} required htmlFor="profile-availability">
          <Select id="profile-availability" required value={profile.availability} onChange={(event) => setProfile((value) => ({ ...value, availability: event.target.value }))}>
            <option value="available">{tr("উপলভ্য")}</option>
            <option value="limited">{tr("সীমিত")}</option>
            <option value="unavailable">{tr("অনুপলভ্য")}</option>
          </Select>
        </Field>
        <label className="flex items-center gap-3 text-[15px] font-medium">
          <input type="checkbox" className="size-5 accent-[#2e6b4f]" checked={profile.vehicle_access} onChange={(event) => setProfile((value) => ({ ...value, vehicle_access: event.target.checked }))} />
          {tr("যানবাহন ব্যবহারের সুযোগ আছে")}
        </label>
        <label className="flex items-center gap-3 text-[15px] font-medium">
          <input type="checkbox" className="size-5 accent-[#2e6b4f]" checked={profile.swimming_capability} onChange={(event) => setProfile((value) => ({ ...value, swimming_capability: event.target.checked }))} />
          {tr("সাঁতার জানি")}
        </label>
      </section>
    </>
  )
}

function PasswordChangePanel() {
  const { tr } = useLanguage()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    setError("")
    setSaved(false)
    if (newPassword !== confirmation) {
      setError(tr("দুটি পাসওয়ার্ড মিলছে না।"))
      return
    }
    setBusy(true)
    try {
      await api("/api/auth/password/", { method: "POST", body: { current_password: currentPassword, new_password: newPassword } })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmation("")
      setSaved(true)
    } catch (requestError) {
      setError(requestError.message || tr("পাসওয়ার্ড পরিবর্তন করা যায়নি।"))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="mt-7 space-y-5 rounded-2xl border border-line bg-white p-5 sm:p-8">
      <SectionTitle>{tr("পাসওয়ার্ড পরিবর্তন")}</SectionTitle>
      {error && <Alert kind="error">{tr(error)}</Alert>}
      {saved && <Alert kind="success">{tr("পাসওয়ার্ড পরিবর্তন করা হয়েছে।")}</Alert>}
      <Field label={tr("বর্তমান পাসওয়ার্ড")} required htmlFor="current-password"><Input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></Field>
      <Field label={tr("নতুন পাসওয়ার্ড")} required htmlFor="new-password"><Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></Field>
      <Field label={tr("নতুন পাসওয়ার্ড নিশ্চিত করুন")} required htmlFor="confirm-new-password"><Input id="confirm-new-password" type="password" autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></Field>
      <div className="flex justify-end"><Button type="submit" disabled={busy}>{tr(busy ? "পরিবর্তন করা হচ্ছে…" : "পাসওয়ার্ড সংরক্ষণ")}</Button></div>
    </form>
  )
}

export function VolunteerFormPage({ registration = false }) {
  const { tr, language } = useLanguage()
  const { register, refreshUser } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(blankProfile)
  const [districts, setDistricts] = useState([])
  const [skills, setSkills] = useState([])
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [districtData, skillData, profileData] = await Promise.all([
        api("/api/locations/districts/"),
        api("/api/skills/"),
        registration ? Promise.resolve(null) : api("/api/profile/"),
      ])
      setDistricts(districtData)
      setSkills(skillData)
      if (profileData) {
        setProfile({
          name: profileData.user.name,
          phone_number: profileData.user.phone_number,
          email: profileData.user.email ?? "",
          district: profileData.district ?? "",
          upazila: profileData.upazila ?? "",
          service_upazilas: profileData.service_upazilas ?? [],
          skills: (profileData.skills ?? []).map((item) => item.id),
          availability: profileData.availability,
          vehicle_access: profileData.vehicle_access,
          swimming_capability: profileData.swimming_capability,
        })
      }
    } catch (requestError) {
      setError(requestError.message || tr("তথ্য লোড করা যায়নি। আবার চেষ্টা করুন।"))
    } finally {
      setLoading(false)
    }
  }, [registration, tr])

  useEffect(() => { load() }, [load])

  const saveProfile = async () => {
    if (!profile.name.trim() || !profile.phone_number.trim() || !profile.district || !profile.upazila || !profile.service_upazilas.length || !profile.skills.length) {
      setError(tr("নাম, মোবাইল, জেলা, উপজেলা, অন্তত একটি কাজের এলাকা ও দক্ষতা দিন।"))
      return
    }
    setBusy(true)
    setError("")
    try {
      if (registration) {
        if (password !== passwordConfirm) throw new Error(tr("দুটি পাসওয়ার্ড মিলছে না।"))
        const user = await register({
          ...profile,
          name: profile.name.trim(),
          email: profile.email.trim() || null,
          district: Number(profile.district),
          upazila: Number(profile.upazila),
          service_upazilas: profile.service_upazilas.map(Number),
          skills: profile.skills.map(Number),
          password,
        })
        navigate(safeReturnPath(params.get("next"), user), { replace: true })
      } else {
        await api("/api/profile/", {
          method: "PATCH",
          body: {
            ...profile,
            name: profile.name.trim(),
            email: profile.email.trim() || null,
            district: Number(profile.district),
            upazila: Number(profile.upazila),
            service_upazilas: profile.service_upazilas.map(Number),
            skills: profile.skills.map(Number),
          },
        })
        await refreshUser()
        setSaved(true)
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
    } catch (requestError) {
      setError(requestError.message || tr("তথ্য সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।"))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-12"><Spinner /></div>
  if (error && !districts.length) return <div className="mx-auto max-w-3xl px-4 py-12"><Alert kind="error">{tr(error)}</Alert><Button className="mt-4" onClick={load}>{tr("আবার চেষ্টা করুন")}</Button></div>

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <PageHead title={tr(registration ? "স্বেচ্ছাসেবক হিসেবে নিবন্ধন" : "প্রোফাইল ও প্রাপ্যতা")} sub={tr("পরিচয়, কাজের এলাকা ও সক্ষমতার তথ্য হালনাগাদ রাখুন")} />
      {registration && <Alert kind="info" title={tr("অ্যাকাউন্ট সুরক্ষা")}>{tr("আপনার পাসওয়ার্ড নিরাপদভাবে সংরক্ষিত হবে। কোনো পাসওয়ার্ড ব্রাউজারের স্থানীয় স্টোরেজে রাখা হয় না।")}</Alert>}
      {saved && <div className="my-5"><Alert kind="success">{tr("প্রোফাইল সংরক্ষিত হয়েছে।")}</Alert></div>}
      {error && <div className="my-4"><Alert kind="error">{tr(error)}</Alert></div>}
      {districts.length === 0 && <div className="my-4"><Alert kind="warn">{tr("অবস্থান তালিকা ডাটাবেসে এখনো সম্পূর্ণ নয়; দেখানো জেলাগুলো প্রাথমিক নমুনা।")}</Alert></div>}
      <form className="mt-6 space-y-7 rounded-2xl border border-line bg-white p-5 sm:p-8" onSubmit={(event) => { event.preventDefault(); saveProfile() }}>
        <ProfileFields profile={profile} setProfile={setProfile} districts={districts} skills={skills} tr={tr} language={language} />
        {registration && (
          <section className="space-y-5 border-t border-line pt-7">
            <SectionTitle>{tr("লগইন তথ্য")}</SectionTitle>
            <Field label={tr("পাসওয়ার্ড")} required htmlFor="register-password" hint={tr("কমপক্ষে ৮ অক্ষর এবং সাধারণ পাসওয়ার্ড নয়।")}>
              <Input id="register-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
            </Field>
            <Field label={tr("পাসওয়ার্ড নিশ্চিত করুন")} required htmlFor="register-password-confirm">
              <Input id="register-password-confirm" type="password" autoComplete="new-password" required value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} />
            </Field>
          </section>
        )}
        <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-5">
          <Button to={registration ? "/" : "/volunteer"} variant="secondary">{tr("বাতিল")}</Button>
          <Button type="submit" disabled={busy || !districts.length || !skills.length}>
            {busy ? tr("সংরক্ষণ করা হচ্ছে…") : tr(registration ? "নিবন্ধন সম্পন্ন করুন" : "পরিবর্তন সংরক্ষণ")}
          </Button>
        </div>
      </form>
      {!registration && <PasswordChangePanel />}
    </div>
  )
}

export function VolunteerDashboardPage() {
  const { tr } = useLanguage()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  const load = useCallback(async () => {
    setError("")
    try {
      const [profile, memberships, requests] = await Promise.all([
        api("/api/profile/"), api("/api/memberships/mine/"), api("/api/membership-requests/mine/"),
      ])
      setData({ profile, memberships, requests })
    } catch (requestError) {
      setError(requestError.message || tr("তথ্য লোড করা যায়নি।"))
    }
  }, [tr])
  useEffect(() => { load() }, [load])
  const membership = data?.memberships.find((item) => item.status === "active")
  const pending = data?.requests.find((item) => item.status === "pending")

  return (
    <div className="mx-auto max-w-5xl">
      <PageHead title={tr(`স্বাগতম, ${user?.name ?? ""}`)} sub={tr("আপনার প্রোফাইল ও সংগঠন সদস্যপদের অবস্থা")} action={<Button to="/volunteer/profile/edit">{tr("প্রোফাইল সম্পাদনা")}</Button>} />
      {error && <Alert kind="error">{tr(error)} <Button variant="ghost" onClick={load}>{tr("আবার চেষ্টা করুন")}</Button></Alert>}
      {!data && !error && <Spinner />}
      {data && (
        <div className="grid gap-5 md:grid-cols-2">
          <Card>
            <SectionTitle>{data.profile.user.name}</SectionTitle>
            <p className="flex items-center gap-1 text-ink-soft"><MapPin size={15} />{data.profile.upazila_name_bn}, {data.profile.district_name_bn}</p>
            <div className="mt-4 flex flex-wrap gap-2">{data.profile.skills.map((skill) => <Badge key={skill.id} s="verified" dot={false}>{skill.name}</Badge>)}</div>
            <p className="mt-4">{tr("প্রাপ্যতা")}: {tr(data.profile.availability)}</p>
            <Button to="/volunteer/profile/edit" variant="secondary" className="mt-5 w-full">{tr("প্রোফাইল সম্পাদনা")}</Button>
          </Card>
          <Card>
            <SectionTitle><span className="inline-flex items-center gap-2"><Users size={19} />{tr("আমার সংগঠন")}</span></SectionTitle>
            {membership ? <Alert kind="success" title={membership.organization_name}>{tr("আপনার সদস্যপদ অনুমোদিত। দল বরাদ্দ আলাদা ধাপ।")}</Alert> : pending ? <Alert kind="warn" title={pending.organization_name}>{tr("সদস্যপদের অনুরোধ অনুমোদনের অপেক্ষায় আছে।")}</Alert> : <Alert>{tr("এখনো কোনো সক্রিয় সদস্যপদ বা অপেক্ষমাণ অনুরোধ নেই।")}</Alert>}
            <Button to={membership || pending ? "/volunteer/organization" : "/volunteer/organizations"} className="mt-4">{tr(membership || pending ? "সদস্যপদের অবস্থা দেখুন" : "সংগঠন খুঁজুন")}</Button>
          </Card>
        </div>
      )}
    </div>
  )
}

export function OrganizationDiscoveryPage() {
  const { tr } = useLanguage()
  const [organizations, setOrganizations] = useState([])
  const [requests, setRequests] = useState([])
  const [memberships, setMemberships] = useState([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [orgRows, requestRows, membershipRows] = await Promise.all([
        api("/api/organizations/"), api("/api/membership-requests/mine/"), api("/api/memberships/mine/"),
      ])
      setOrganizations(orgRows)
      setRequests(requestRows)
      setMemberships(membershipRows)
    } catch (requestError) {
      setError(requestError.message || tr("সংগঠনের তথ্য লোড করা যায়নি।"))
    } finally {
      setLoading(false)
    }
  }, [tr])
  useEffect(() => { load() }, [load])

  const activeMembership = memberships.find((item) => item.status === "active")
  const latestByOrganization = useMemo(() => {
    const map = new Map()
    requests.forEach((request) => {
      if (!map.has(request.organization)) map.set(request.organization, request)
    })
    return map
  }, [requests])
  const filtered = organizations.filter((organization) => `${organization.name} ${organization.organization_type} ${organization.service_district_names.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()))

  const requestMembership = async (organizationId) => {
    setBusyId(organizationId)
    setError("")
    try {
      await api(`/api/organizations/${organizationId}/membership-requests/`, { method: "POST", body: {} })
      await load()
    } catch (requestError) {
      setError(requestError.message || tr("অনুরোধ পাঠানো যায়নি।"))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHead title={tr("সংগঠন খুঁজুন")} sub={tr("যাচাইকৃত সংগঠনে সদস্যপদের অনুরোধ পাঠান")} action={<Button to="/organization/register">{tr("সংগঠন নিবন্ধন")}</Button>} />
      {activeMembership && <div className="mb-4"><Alert kind="info" title={activeMembership.organization_name}>{tr("আপনার একটি সক্রিয় সংগঠন সদস্যপদ আছে; নতুন সদস্যপদ নেওয়ার আগে এটি শেষ করতে হবে.")}</Alert></div>}
      {error && <div className="mb-4"><Alert kind="error">{tr(error)} <Button variant="ghost" onClick={load}>{tr("আবার চেষ্টা করুন")}</Button></Alert></div>}
      <Input aria-label={tr("সংগঠন খুঁজুন")} className="my-5" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr("নাম বা জেলা দিয়ে খুঁজুন")} />
      {loading ? <Spinner /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((organization) => {
            const ownRequest = latestByOrganization.get(organization.id)
            const isActive = activeMembership?.organization === organization.id
            return (
              <Card key={organization.id}>
                <div className="flex flex-wrap justify-between gap-2"><SectionTitle>{organization.name}</SectionTitle><Badge s="verified">{tr("যাচাইকৃত")}</Badge></div>
                <p>{organization.description}</p>
                <p className="mt-3 flex items-center gap-1 text-ink-soft"><MapPin size={15} />{organization.service_district_names.map(tr).join(", ")}</p>
                <p className="mt-2 text-sm text-ink-soft">{organization.service_upazila_labels.map(tr).join(" · ")}</p>
                {ownRequest && <div className="mt-3"><Badge s={ownRequest.status} /><p className="mt-2 text-sm">{tr(ownRequest.decision_note || ownRequest.request_note)}</p></div>}
                <div className="mt-4">
                  {isActive ? <Button to="/volunteer/organization" variant="secondary">{tr("সদস্যপদের অবস্থা দেখুন")}</Button> : ownRequest?.status === "pending" ? <Button to="/volunteer/organization" variant="secondary">{tr("অনুরোধের অবস্থা দেখুন")}</Button> : (
                    <Button disabled={Boolean(activeMembership) || busyId === organization.id} onClick={() => requestMembership(organization.id)}>
                      {busyId === organization.id ? tr("অনুরোধ পাঠানো হচ্ছে…") : tr(ownRequest?.status === "rejected" ? "আবার আবেদন করুন" : "সদস্যপদের অনুরোধ পাঠান")}
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
      {!loading && !filtered.length && <Empty title={tr("কোনো যাচাইকৃত সংগঠন পাওয়া যায়নি")}>{tr("নাম বা জেলা পরিবর্তন করে খুঁজুন।")}</Empty>}
      <p className="mt-6 text-sm text-ink-soft">{tr("অবস্থান তালিকা এখনো প্রাথমিক; ডাটাবেসে যুক্ত জেলাগুলোই এখানে দেখানো হয়।")}</p>
    </div>
  )
}

export function VolunteerOrganizationPage() {
  const { tr } = useLanguage()
  const [memberships, setMemberships] = useState([])
  const [requests, setRequests] = useState([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [withdrawing, setWithdrawing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [membershipRows, requestRows] = await Promise.all([
        api("/api/memberships/mine/"), api("/api/membership-requests/mine/"),
      ])
      setMemberships(membershipRows)
      setRequests(requestRows)
    } catch (requestError) {
      setError(requestError.message || tr("সদস্যপদের তথ্য লোড করা যায়নি।"))
    } finally {
      setLoading(false)
    }
  }, [tr])
  useEffect(() => { load() }, [load])

  const withdraw = async (requestId) => {
    setWithdrawing(requestId)
    setError("")
    try {
      await api(`/api/membership-requests/${requestId}/withdraw/`, { method: "POST", body: {} })
      await load()
    } catch (requestError) {
      setError(requestError.message || tr("অনুরোধ প্রত্যাহার করা যায়নি।"))
    } finally {
      setWithdrawing(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHead title={tr("আমার সংগঠন")} sub={tr("সদস্যপদের অনুরোধ ও অনুমোদনের অবস্থা")} action={<Button to="/volunteer/organizations">{tr("সংগঠন খুঁজুন")}</Button>} />
      <Alert>{tr("সংগঠনের সদস্যপদ এবং ছোট দলে বরাদ্দ আলাদা ধাপ।")}</Alert>
      {error && <div className="mt-4"><Alert kind="error">{tr(error)} <Button variant="ghost" onClick={load}>{tr("আবার চেষ্টা করুন")}</Button></Alert></div>}
      {loading ? <div className="mt-5"><Spinner /></div> : (
        <div className="mt-5 grid gap-4">
          {memberships.map((membership) => (
            <Card key={`membership-${membership.id}`}>
              <SectionTitle>{membership.organization_name}</SectionTitle>
              <Badge s={membership.status}>{tr("সদস্যপদ অনুমোদিত")}</Badge>
              <p className="mt-3">{tr("দল বরাদ্দ হলে দল ও কার্যক্রমের তথ্য এখানে দেখানো হবে।")}</p>
            </Card>
          ))}
          {requests.map((request) => (
            <Card key={`request-${request.id}`}>
              <SectionTitle>{request.organization_name}</SectionTitle>
              <Badge s={request.status} />
              {request.decision_note && <p className="mt-3">{tr("কারণ")}: {request.decision_note}</p>}
              {request.request_note && <p className="mt-2 text-sm text-ink-soft">{request.request_note}</p>}
              {request.status === "pending" && <Button variant="secondary" className="mt-4" disabled={withdrawing === request.id} onClick={() => withdraw(request.id)}>{tr(withdrawing === request.id ? "প্রত্যাহার করা হচ্ছে…" : "অনুরোধ প্রত্যাহার")}</Button>}
            </Card>
          ))}
          {!memberships.length && !requests.length && <Empty title={tr("এখনো কোনো সদস্যপদের অনুরোধ নেই")} action={<Button to="/volunteer/organizations">{tr("সংগঠন খুঁজুন")}</Button>}>{tr("যাচাইকৃত সংগঠন বেছে অনুরোধ পাঠান।")}</Empty>}
        </div>
      )}
    </div>
  )
}
