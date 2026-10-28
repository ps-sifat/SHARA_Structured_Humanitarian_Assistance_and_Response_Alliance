import { useLanguage } from "./i18n"
import { matchesSearch } from "./locale"
import { useEffect, useState, type FormEvent } from "react"
import { MapPin, Building2, CircleCheck, Users } from "lucide-react"
import { useNavigate } from "react-router"
import { DISTRICTS, UPAZILAS, bn } from "./data"
import {
  Alert,
  Badge,
  Button,
  Card,
  Choices,
  Empty,
  Field,
  Input,
  PageHead,
  SectionTitle,
  Select,
} from "./ui"
import {
  account,
  active,
  labels,
  membership,
  SKILLS,
  teamFor,
  type Volunteer,
} from "./model"
import { act, uid, useDemo } from "./store"
import { ProfileImage, ProfileImageEditor } from "./ProfileImage"

const blank: Volunteer = {
  id: "",
  name: "",
  phone: "",
  district: "",
  upazila: "",
  areas: [],
  skills: [],
  availability: "available",
  vehicleAccess: false,
  swimmingCapability: false,
}
const phoneValid = (phone: string) =>
  /^(\+?88)?01[3-9]\d{8}$/.test(
    phone
      .replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)))
      .replace(/[\s-]/g, ""),
  )

// Registration and editing share the existing location, skill and capability controls.
function VolunteerForm({ registration = false }: { registration?: boolean }) {
  const { tr } = useLanguage()
  const s = useDemo(),
    a = account(s),
    nav = useNavigate()
  const existing = s.volunteers.find((v) => v.id === a?.volunteerId)
  const [profile, setProfile] = useState<Volunteer>(
    registration ? { ...blank, id: uid("v") } : (existing ?? blank),
  )
  const [organizationId, setOrganizationId] = useState("")
  const [imageProcessing, setImageProcessing] = useState(false)
  const [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false)
  useEffect(() => {
    if (error) document.getElementById("volunteer-form-errors")?.focus()
  }, [error])
  const set = <K extends keyof Volunteer>(key: K, value: Volunteer[K]) => {
    setProfile((p) => ({ ...p, [key]: value }))
    setSaved(false)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (busy || imageProcessing) return
    if (
      !profile.name.trim() ||
      !phoneValid(profile.phone) ||
      !profile.upazila ||
      !profile.areas.length ||
      !profile.skills.length
    ) {
      setError("নাম, সঠিক মোবাইল, বর্তমান উপজেলা, অন্তত একটি কাজের এলাকা ও দক্ষতা দিন।")
      return
    }
    setBusy(true)
    const result = registration
      ? act({
          type: "registerVolunteer",
          volunteer: { ...profile, name: profile.name.trim() },
          account: {
            id: uid("a"),
            name: profile.name.trim(),
            role: "volunteer",
            volunteerId: profile.id,
          },
          orgId: organizationId || undefined,
          membershipId: uid("mb"),
        })
      : act({ type: "profile", record: profile })
    setBusy(false)
    setError(result.error)
    if (result.ok) {
      if (registration) nav("/volunteer")
      else {
        setSaved(true)
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
    }
  }
  return (
    <div
      className={
        registration
          ? "mx-auto max-w-3xl px-4 py-10 sm:py-14"
          : "mx-auto max-w-3xl"
      }
    >
      <PageHead
        title={tr(registration ? "স্বেচ্ছাসেবক হিসেবে নিবন্ধন" : "প্রোফাইল ও প্রাপ্যতা")}
        sub={tr("পরিচয়, কাজের এলাকা ও সক্ষমতা হালনাগাদ রাখুন")}
      />
      {saved && (
        <div className="mb-5">
          <Alert kind="success">
            {tr("প্রোফাইল সংরক্ষিত। ড্যাশবোর্ডেও তথ্য হালনাগাদ হয়েছে।")}</Alert>
        </div>
      )}
      <form
        onSubmit={submit}
        className="space-y-7 rounded-2xl border border-line bg-white p-5 sm:p-8"
      >
        {error && (
          <div id="volunteer-form-errors" tabIndex={-1}>
            <Alert kind="error">{tr(error)}</Alert>
          </div>
        )}
        <ProfileImageEditor
          value={profile.profileImage}
          name={profile.name}
          onChange={(value) => set("profileImage", value)}
          onProcessingChange={setImageProcessing}
        />
        <section className="space-y-5">
          <SectionTitle>{tr("ব্যক্তিগত তথ্য")}</SectionTitle>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={tr("পূর্ণ নাম")} required htmlFor="v-name">
              <Input
                id="v-name"
                required
                value={profile.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field label={tr("মোবাইল নম্বর")} required htmlFor="v-phone">
              <Input
                id="v-phone"
                required
                inputMode="tel"
                value={profile.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder={tr("০১৭০০-০০০০০০")}
              />
            </Field>
          </div>
          {registration ? (
            <Field
              label={tr("সদস্যপদের জন্য সংগঠন")}
              htmlFor="v-org"
              hint={tr("নির্বাচন করলে অনুরোধ যাবে, সরাসরি সদস্যপদ নয়। পরে সংগঠন খুঁজেও আবেদন করতে পারবেন।")}
            >
              <Select
                id="v-org"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
              >
                <option value="">{tr("পরে সংগঠন খুঁজব")}</option>
                {s.organizations
                  .filter((o) => o.verification === "verified")
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
              </Select>
            </Field>
          ) : (
            <Alert>
              {tr("সদস্যপদ প্রোফাইল থেকে বদলানো যায় না।")}{" "}
              <Button to="/volunteer/organization" variant="ghost">
                {tr("আমার সংগঠন দেখুন")}</Button>
            </Alert>
          )}
        </section>
        <section className="space-y-5 border-t border-line pt-7">
          <SectionTitle>{tr("অবস্থান ও কাজের এলাকা")}</SectionTitle>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={tr("বর্তমান জেলা")} required htmlFor="v-district">
              <Select
                id="v-district"
                required
                value={profile.district}
                onChange={(e) => {
                  set("district", e.target.value)
                  set("upazila", "")
                  set("areas", [])
                }}
              >
                <option value="">{tr("জেলা বেছে নিন")}</option>
                {DISTRICTS.map((d) => (
                  <option key={d} value={d}>{tr(d)}</option>
                ))}
              </Select>
            </Field>
            <Field label={tr("বর্তমান উপজেলা")} required htmlFor="v-upazila">
              <Select
                id="v-upazila"
                required
                disabled={!profile.district}
                value={profile.upazila}
                onChange={(e) => set("upazila", e.target.value)}
              >
                <option value="">{tr("উপজেলা বেছে নিন")}</option>
                {(UPAZILAS[profile.district] ?? []).map((u) => (
                  <option key={u} value={u}>{tr(u)}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Choices
            label={tr("কাজ করতে আগ্রহী এলাকা (অন্তত একটি)")}
            options={UPAZILAS[profile.district] ?? []}
            value={profile.areas}
            onChange={(v) => set("areas", v)}
          />
        </section>
        <section className="space-y-5 border-t border-line pt-7">
          <SectionTitle>{tr("দক্ষতা ও সক্ষমতা")}</SectionTitle>
          <Choices
            label={tr("দক্ষতা (অন্তত একটি)")}
            options={SKILLS}
            value={profile.skills}
            onChange={(v) => set("skills", v)}
          />
          <Field label={tr("প্রাপ্যতা")} required htmlFor="v-availability">
            <Select
              id="v-availability"
              value={profile.availability}
              onChange={(e) =>
                set("availability", e.target.value as Volunteer["availability"])
              }
            >
              {["available", "limited", "unavailable"].map((v) => (
                <option key={v} value={v}>
                  {tr(labels[v])}
                </option>
              ))}
            </Select>
          </Field>
          <Choices
            label={tr("বিশেষ সক্ষমতা")}
            options={["যানবাহন ব্যবহারের সুযোগ আছে", "সাঁতার জানি"]}
            value={[
              ...(profile.vehicleAccess ? ["যানবাহন ব্যবহারের সুযোগ আছে"] : []),
              ...(profile.swimmingCapability ? ["সাঁতার জানি"] : []),
            ]}
            onChange={(v) => {
              set("vehicleAccess", v.includes("যানবাহন ব্যবহারের সুযোগ আছে"))
              set("swimmingCapability", v.includes("সাঁতার জানি"))
            }}
          />
        </section>
        <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-5">
          <Button to={registration ? "/" : "/volunteer"} variant="secondary">
            {tr("বাতিল")}</Button>
          <Button type="submit" disabled={busy || imageProcessing}>
            {tr(registration ? "নিবন্ধন সম্পন্ন করুন" : "পরিবর্তন সংরক্ষণ")}
          </Button>
        </div>
      </form>
    </div>
  )
}
export function VolunteerRegister() {
  return <VolunteerForm registration />
}
export function VolunteerProfileEdit() {
  return <VolunteerForm />
}

export function VolunteerDashboard() {
  const { tr } = useLanguage()
  const s = useDemo(),
    a = account(s),
    v = s.volunteers.find((v) => v.id === a?.volunteerId)!
  const member = membership(s, v.id),
    team = teamFor(s, v.id),
    pending = s.memberships.find(
      (m) => m.volunteerId === v.id && m.status === "pending",
    )
  const mission = s.missions.find((m) => m.teamId === team?.id && active(m))
  const next = mission
    ? [`/volunteer/missions/${mission.id}`, "বর্তমান কার্যক্রম দেখুন"]
    : team
      ? ["/volunteer/team", "আমার ছোট দল দেখুন"]
      : member
        ? ["/volunteer/organization", "সংগঠন ও দল বরাদ্দের অবস্থা"]
        : pending
          ? ["/volunteer/organization", "সদস্যপদের অনুরোধ দেখুন"]
          : ["/volunteer/organizations", "সংগঠন খুঁজুন"]
  return (
    <div className="mx-auto max-w-5xl">
      <PageHead
        title={tr(`স্বাগতম, ${v.name}`)}
        sub={tr("আপনার বর্তমান অবস্থা ও পরবর্তী করণীয়")}
        action={<Button to={next[0]}>{tr(next[1])}</Button>}
      />
      <Alert
        title={
          tr(mission
            ? "আপনার দলের কার্যক্রম রয়েছে"
            : team
              ? "আপনি একটি ছোট দলে যুক্ত আছেন"
              : member
                ? "সদস্যপদ অনুমোদিত · দল বরাদ্দ বাকি"
                : pending
                  ? "সদস্যপদ অনুমোদনের অপেক্ষায়"
                  : "প্রথমে একটি সংগঠনে যোগ দিন")
        }
      >
        {tr(mission
          ? labels[mission.status]
          : "সংগঠনের সদস্যপদ ও ছোট দলের বরাদ্দ আলাদা ধাপ। কার্যক্রম শুধু দলকে দেওয়া হয়।")}
      </Alert>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Card>
          <div className="flex items-center gap-3">
            <ProfileImage value={v.profileImage} name={v.name} size="sm" />
            <div>
              <p className="text-lg font-bold">{v.name}</p>
              <p className="flex items-center gap-1 text-ink-soft">
                <MapPin size={14} />
                {tr(v.upazila)}, {tr(v.district)}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {v.skills.map((skill) => (
              <Badge key={skill} s="verified" dot={false}>
                {tr(skill)}
              </Badge>
            ))}
          </div>
          <p className="mt-4">{tr("প্রাপ্যতা: ")}{tr(labels[v.availability])}</p>
          <p>
            {tr("সংগঠন:")}{" "}
            {tr(s.organizations.find((o) => o.id === member?.orgId)?.name ??
              "এখনো সদস্য নন")}
          </p>
          <p>{tr("ছোট দল: ")}{tr(team?.name ?? "এখনো বরাদ্দ নেই")}</p>
          <Button
            to="/volunteer/profile/edit"
            variant="secondary"
            className="mt-5 w-full"
          >
            {tr("প্রোফাইল সম্পাদনা")}</Button>
        </Card>
        <Card>
          <SectionTitle>{tr("পরবর্তী করণীয়")}</SectionTitle>
          <p className="text-ink-soft">
            {tr("আপনার বর্তমান সদস্যপদ ও দল অনুযায়ী প্রাসঙ্গিক কাজ দেখানো হচ্ছে।")}</p>
          <div className="mt-5 grid gap-3">
            <Button to={next[0]}>{tr(next[1])}</Button>
            <Button to="/volunteer/missions" variant="secondary">
              {tr("আমার কার্যক্রম ও ইতিহাস")}</Button>
            <Button to="/volunteer/requests" variant="ghost">
              {tr("সহায়তার আবেদন দেখুন")}</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

export function MyOrganization() {
  const { tr } = useLanguage()
  const s = useDemo(),
    a = account(s)
  const memberships = s.memberships.filter(
    (m) => m.volunteerId === a?.volunteerId,
  )
  const member = membership(s, a?.volunteerId)
  return (
    <div className="mx-auto max-w-5xl">
      <PageHead
        title={tr("আমার সংগঠন")}
        sub={tr("সদস্যপদের অনুরোধ ও অনুমোদনের অবস্থা")}
        action={
          !member ? (
            <Button to="/volunteer/organizations">{tr("সংগঠন খুঁজুন")}</Button>
          ) : undefined
        }
      />
      <Alert>
        {tr("সংগঠনে অনুমোদন পাওয়ার পরও ছোট দলে বরাদ্দের জন্য প্রশাসকের সিদ্ধান্ত প্রয়োজন।")}</Alert>
      <div className="mt-5 grid gap-4">
        {memberships.length ? (
          memberships.map((m) => (
            <Card key={m.id}>
              <SectionTitle>
                {s.organizations.find((o) => o.id === m.orgId)?.name}
              </SectionTitle>
              <Badge s={m.status}>
                {tr(m.status === "pending" ? "সদস্যপদ অপেক্ষমাণ" : labels[m.status])}
              </Badge>
              {m.reason && <p className="mt-3">{tr("কারণ: ")}{m.reason}</p>}
              {m.status === "approved" && (
                <Button
                  to="/volunteer/team"
                  className="mt-4"
                  variant="secondary"
                >
                  {tr("ছোট দলের বরাদ্দ দেখুন")}</Button>
              )}
            </Card>
          ))
        ) : (
          <Empty
            title={tr("এখনো কোনো সদস্যপদের অনুরোধ নেই")}
            action={<Button to="/volunteer/organizations">{tr("সংগঠন খুঁজুন")}</Button>}
          >
            {tr("যাচাইকৃত সংগঠন বেছে অনুরোধ পাঠান।")}</Empty>
        )}
      </div>
    </div>
  )
}

export function MyTeam() {
  const { tr } = useLanguage()
  const s = useDemo(),
    a = account(s),
    team = teamFor(s, a?.volunteerId)
  if (!team)
    return (
      <Empty
        title={
          tr(membership(s, a?.volunteerId)
            ? "ছোট দলের বরাদ্দের অপেক্ষায়"
            : "আগে সংগঠনে সদস্য হোন")
        }
        action={<Button to="/volunteer/organization">{tr("আমার সংগঠন দেখুন")}</Button>}
      >
        {tr("সংগঠনের প্রশাসক অনুমোদিত সদস্যদের ছোট দলে যুক্ত করবেন।")}</Empty>
    )
  return (
    <div className="mx-auto max-w-4xl">
      <PageHead
        title={team.name}
        sub={tr(`সংগঠন: ${s.organizations.find((o) => o.id === team.orgId)?.name}`)}
      />
      <Card>
        <p>{tr("কার্যএলাকা: ")}{tr(team.areas.join(", "))}</p>
        <p className="mt-2">{tr("সক্ষমতা: ")}{tr(team.capabilities.join(", "))}</p>
        <p className="mt-2">
          {tr("নেতা: ")}{s.volunteers.find((v) => v.id === team.leaderId)?.name}
        </p>
        <div className="mt-3">
          <Badge s={team.availability} />
        </div>
        <SectionTitle>
          <span className="mt-5 block">{tr("দলের সদস্য")}</span>
        </SectionTitle>
        <ul className="divide-y divide-line">
          {team.memberIds.map((id) => (
            <li key={id} className="py-2">
              {s.volunteers.find((v) => v.id === id)?.name}
              {tr(id === team.leaderId ? " — দলনেতা" : " — সদস্য")}
            </li>
          ))}
        </ul>
        <Button to="/volunteer/missions" className="mt-5">
          {tr("দলের কার্যক্রম দেখুন")}</Button>
      </Card>
    </div>
  )
}

export function Teams() {
  const { tr } = useLanguage()
  const s = useDemo(),
    a = account(s),
    [q, setQ] = useState(""),
    [error, setError] = useState("")
  const list = s.organizations.filter((o) =>
    matchesSearch(`${o.name} ${o.organizationType} ${o.areas.join(", ")}`, q),
  )
  const blocked = s.memberships.some(
    (m) =>
      m.volunteerId === a?.volunteerId &&
      ["pending", "approved"].includes(m.status),
  )
  return (
    <div className="mx-auto max-w-5xl">
      <PageHead
        title={tr("সংগঠন খুঁজুন")}
        sub={tr("সংগঠনে সদস্য হোন, তারপর প্রশাসক আপনাকে ছোট দলে যুক্ত করবেন")}
        action={
          <Button to="/organization/register">
            <Building2 size={18} />
            {tr("সংগঠন নিবন্ধন")}</Button>
        }
      />
      <Alert>
        {tr("একটি অনুমোদিত সদস্যপদ বা অপেক্ষমাণ অনুরোধ থাকলে নতুন অনুরোধ বন্ধ থাকে।")}</Alert>
      {error && <Alert kind="error">{tr(error)}</Alert>}
      <Input
        aria-label={tr("সংগঠন খুঁজুন")}
        className="my-5"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={tr("নাম, ধরন বা জেলা দিয়ে খুঁজুন")}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((o) => {
          const own = s.memberships
            .filter((m) => m.orgId === o.id && m.volunteerId === a?.volunteerId)
            .slice(-1)[0]
          return (
            <Card key={o.id}>
              <div className="flex flex-wrap justify-between gap-2">
                <SectionTitle>{o.name}</SectionTitle>
                <Badge s={o.verification} />
              </div>
              <p>{o.description}</p>
              <p className="mt-3 flex items-center gap-1 text-ink-soft">
                <MapPin size={15} />
                {tr(o.areas.join(", "))}
              </p>
              <p className="mt-2 text-sm">
                {tr(bn(
                  s.memberships.filter(
                    (m) => m.orgId === o.id && m.status === "approved",
                  ).length,
                ))}{" "}
                {tr("জন সদস্য · ")}{tr(bn(s.teams.filter((t) => t.orgId === o.id).length))}{tr("টি ছোট দল")}</p>
              {own && (
                <div className="mt-3">
                  <Badge s={own.status}>
                    {tr(own.status === "pending"
                      ? "সদস্যপদ অপেক্ষমাণ"
                      : labels[own.status])}
                  </Badge>
                  {own.reason && <p>{own.reason}</p>}
                </div>
              )}
              <div className="mt-4">
                {own?.status === "approved" || own?.status === "pending" ? (
                  <Button to="/volunteer/organization" variant="secondary">
                    {tr("সদস্যপদের অবস্থা দেখুন")}</Button>
                ) : (
                  <Button
                    disabled={blocked || o.verification !== "verified"}
                    onClick={() => {
                      if (a?.volunteerId)
                        setError(
                          act({
                            type: "join",
                            record: {
                              id: uid("mb"),
                              orgId: o.id,
                              volunteerId: a.volunteerId,
                              status: "pending",
                              reason: "",
                              updatedAt: new Date().toISOString(),
                            },
                          }).error,
                        )
                    }}
                  >
                    {tr(o.verification !== "verified"
                      ? "সংগঠনের যাচাই অপেক্ষমাণ"
                      : own?.status === "rejected"
                        ? "আবার আবেদন করুন"
                        : "সদস্যপদের অনুরোধ পাঠান")}
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>
      {!list.length && (
        <Empty title={tr("কোনো সংগঠন পাওয়া যায়নি")}>{tr("অন্য নাম বা জেলা দিয়ে খুঁজুন।")}</Empty>
      )}
    </div>
  )
}
