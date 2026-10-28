import { useLanguage } from "./i18n"
import { useEffect, useState } from "react"
import { CircleCheck, MapPin, ShieldCheck, Users } from "lucide-react"
import { DISTRICTS, UPAZILAS, bn } from "./data"
import { Alert, Button, Field, SearchSelect, inputCls } from "./ui"
import { act, uid } from "./store"
import { ORGANIZATION_TYPES as organizationTypeLabels } from "./model"
import { ProfileImageEditor } from "./ProfileImage"

const ORGANIZATION_TYPES = [
  ["ngo", "বেসরকারি উন্নয়ন সংস্থা (এনজিও)"],
  ["nonprofit", "অলাভজনক / দাতব্য সংস্থা"],
  ["community", "স্থানীয় কমিউনিটি সংগঠন"],
  ["government", "সরকারি প্রতিষ্ঠান"],
  ["educational", "শিক্ষাপ্রতিষ্ঠানভিত্তিক সংগঠন"],
] as const

type OrganizationForm = {
  name: string
  profileImage: string
  description: string
  organizationType: typeof ORGANIZATION_TYPES[number][0] | ""
  contactEmail: string
  contactPhone: string
  operatingAreaIds: string[]
  locationIds: string[]
}

const emptyOrganization: OrganizationForm = {
  name: "",
  profileImage: "",
  description: "",
  organizationType: "",
  contactEmail: "",
  contactPhone: "",
  operatingAreaIds: [],
  locationIds: [],
}

export function OrganizationRegister() {
  const { tr } = useLanguage()
  const [form, setForm] = useState<OrganizationForm>(emptyOrganization)
  const [locationDistrict, setLocationDistrict] = useState("")
  const [done, setDone] = useState(false)
  const [adminName, setAdminName] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [imageProcessing, setImageProcessing] = useState(false)
  useEffect(() => {
    if (error) document.getElementById("organization-form-errors")?.focus()
  }, [error])
  const set = <K extends keyof OrganizationForm,>(
    key: K,
    value: OrganizationForm[K],
  ) => setForm((current) => ({ ...current, [key]: value }))
  const toggle = (key: "operatingAreaIds" | "locationIds", value: string) => {
    const values = form[key]
    set(
      key,
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    )
  }

  if (done)
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-mint text-leaf">
          <CircleCheck size={36} />
        </span>
        <h1 className="mt-5 font-display text-3xl font-bold text-forest">
          {tr("নিবন্ধনের আবেদন গ্রহণ করা হয়েছে")}</h1>
        <p className="mt-3 text-lg text-ink-soft">
          <strong className="text-ink">{form.name}</strong>{tr("-এর তথ্য যাচাইয়ের অপেক্ষায় রয়েছে।")}</p>
        <div className="mt-6 text-left">
          <Alert kind="warn" title={tr("যাচাই চলছে")}>
            {tr("সুপার অ্যাডমিন অনুমোদন না করা পর্যন্ত সংগঠনটি যাচাইকৃত হিসেবে দেখানো হবে না এবং দল পরিচালনার সুবিধা সক্রিয় হবে না।")}</Alert>
        </div>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button to="/org">{tr("নিবন্ধনের অবস্থা দেখুন")}</Button>
          <Button to="/" variant="secondary">
            {tr("হোমে ফিরে যান")}</Button>
        </div>
      </div>
    )

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <div className="max-w-2xl">
        <p className="mb-2 font-semibold text-leaf">{tr("সংগঠনের অংশীদারিত্ব")}</p>
        <h1 className="font-display text-3xl font-bold text-forest sm:text-4xl">
          {tr("সংগঠন হিসেবে নিবন্ধন")}</h1>
        <p className="mt-2 text-lg text-ink-soft">
          {tr("স্বেচ্ছাসেবক দল গঠন ও মানবিক সহায়তা সমন্বয়ের জন্য আপনার সংগঠনের তথ্য দিন।")}</p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (busy || imageProcessing) return
          if (
            !form.name.trim() ||
            !form.description.trim() ||
            !adminName.trim() ||
            !form.operatingAreaIds.length ||
            !form.locationIds.length
          ) {
            setError("নাম, বিবরণ, প্রশাসকের নাম, জেলা ও অন্তত একটি লোকেশন দিন।")
            return
          }
          setBusy(true)
          const orgId = uid("org"),
            adminId = uid("a")
          const result = act({
            type: "registerOrg",
            record: {
              id: orgId,
              adminId,
              name: form.name.trim(),
              profileImage: form.profileImage,
              description: form.description,
              organizationType:
                organizationTypeLabels[
                  ORGANIZATION_TYPES.findIndex(
                    ([value]) => value === form.organizationType,
                  )
                ] ?? organizationTypeLabels[0],
              contactEmail: form.contactEmail,
              contactPhone: form.contactPhone,
              areas: form.operatingAreaIds,
              locations: form.locationIds,
              verification: "pending",
              createdAt: new Date().toISOString(),
              reason: "",
            },
            account: {
              id: adminId,
              name: adminName.trim(),
              role: "org",
              orgId,
            },
          })
          setBusy(false)
          setError(result.error)
          if (result.ok) setDone(true)
        }}
        className="mt-7 space-y-8 rounded-2xl border border-line bg-white p-5 sm:p-8"
      >
        {error && (
          <div id="organization-form-errors" tabIndex={-1}>
            <Alert kind="error">{tr(error)}</Alert>
          </div>
        )}
        <Alert kind="info" title={tr("যাচাই প্রয়োজন")}>
          {tr("নিবন্ধনের পর আপনার সংগঠনের অবস্থা “যাচাই চলছে” থাকবে। সংগঠন আইডি ও তৈরির তারিখ স্বয়ংক্রিয়ভাবে তৈরি হবে।")}</Alert>
        <Field
          label={tr("দায়িত্বশীল প্রশাসকের নাম")}
          required
          htmlFor="organization-admin"
          hint={tr("এই নামে সংগঠনের প্রশাসক অ্যাকাউন্ট তৈরি হবে।")}
        >
          <input
            id="organization-admin"
            required
            className={inputCls}
            value={adminName}
            onChange={(event) => setAdminName(event.target.value)}
          />
        </Field>

        <section className="space-y-5" aria-labelledby="organization-details">
          <div>
            <h2
              id="organization-details"
              className="font-display text-xl font-bold text-forest"
            >
              {tr("সংগঠনের পরিচিতি")}</h2>
            <p className="text-sm text-ink-soft">
              {tr("সংগঠনটি কী এবং কীভাবে মানবিক সহায়তায় কাজ করে")}</p>
          </div>
          <ProfileImageEditor
            value={form.profileImage}
            name={form.name}
            organization
            onChange={(value) => set("profileImage", value)}
            onProcessingChange={setImageProcessing}
          />
          <Field label={tr("সংগঠনের নাম")} required htmlFor="organization-name">
            <input
              id="organization-name"
              required
              className={inputCls}
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder={tr("যেমন: সবুজ বাংলা ফাউন্ডেশন")}
            />
          </Field>
          <Field label={tr("সংগঠনের ধরন")} required htmlFor="organization-type">
            <select
              id="organization-type"
              required
              className={inputCls}
              value={form.organizationType}
              onChange={(event) =>
                set(
                  "organizationType",
                  event.target.value as OrganizationForm["organizationType"],
                )
              }
            >
              <option value="">{tr("ধরন বেছে নিন")}</option>
              {ORGANIZATION_TYPES.map(([value, label]) => (
                <option key={value} value={value}>
                  {tr(label)}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={tr("সংক্ষিপ্ত বিবরণ")}
            required
            htmlFor="organization-description"
            hint={tr("সংগঠনের লক্ষ্য, অভিজ্ঞতা এবং প্রধান কার্যক্রম সংক্ষেপে লিখুন।")}
          >
            <textarea
              id="organization-description"
              required
              rows={5}
              className={`${inputCls} py-3`}
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
              placeholder={tr("আপনাদের কাজ সম্পর্কে লিখুন…")}
            />
          </Field>
        </section>

        <section
          className="space-y-5 border-t border-line pt-7"
          aria-labelledby="organization-contact"
        >
          <div>
            <h2
              id="organization-contact"
              className="font-display text-xl font-bold text-forest"
            >
              {tr("যোগাযোগের তথ্য")}</h2>
            <p className="text-sm text-ink-soft">
              {tr("যাচাই ও জরুরি সমন্বয়ের জন্য দায়িত্বশীল যোগাযোগ")}</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={tr("যোগাযোগের ইমেইল")} required htmlFor="organization-email">
              <input
                id="organization-email"
                required
                type="email"
                className={inputCls}
                value={form.contactEmail}
                onChange={(event) => set("contactEmail", event.target.value)}
                placeholder="contact@example.org"
              />
            </Field>
            <Field label={tr("যোগাযোগের ফোন")} required htmlFor="organization-phone">
              <input
                id="organization-phone"
                required
                inputMode="tel"
                className={inputCls}
                value={form.contactPhone}
                onChange={(event) => set("contactPhone", event.target.value)}
                placeholder={tr("০১৭XXXXXXXX")}
              />
            </Field>
          </div>
        </section>

        <section
          className="space-y-5 border-t border-line pt-7"
          aria-labelledby="organization-areas"
        >
          <div>
            <h2
              id="organization-areas"
              className="font-display text-xl font-bold text-forest"
            >
              {tr("কার্যএলাকা ও লোকেশন")}</h2>
            <p className="text-sm text-ink-soft">
              {tr("একাধিক জেলা এবং সুনির্দিষ্ট উপজেলা নির্বাচন করা যাবে")}</p>
          </div>
          <fieldset>
            <legend className="mb-1 text-[15px] font-semibold">
              {tr("কার্যপরিচালনার জেলা ")}<span className="text-alert">*</span>
            </legend>
            <p className="mb-3 text-sm text-ink-soft">
              {tr("সংগঠনটি যেসব জেলায় নিয়মিত কাজ করে")}</p>
            <div className="flex flex-wrap gap-2">
              {DISTRICTS.map((district) => {
                const selected = form.operatingAreaIds.includes(district)
                return (
                  <label
                    key={district}
                    className={`flex min-h-11 cursor-pointer items-center rounded-full border px-4 font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-leaf ${
                      selected
                        ? "border-forest bg-forest text-white"
                        : "border-[#c5d0c8] hover:border-leaf"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={selected}
                      onChange={() => toggle("operatingAreaIds", district)}
                    />
                    {tr(selected && "✓ ")}
                    {tr(district)}
                  </label>
                )
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-[15px] font-semibold">
              {tr("সুনির্দিষ্ট লোকেশন ")}<span className="text-alert">*</span>
            </legend>
            <Field
              label={tr("লোকেশনের জেলা")}
              required
              htmlFor="location-district"
              hint={tr("একটি জেলা বেছে নিয়ে নিচের উপজেলা যোগ করুন। পরে অন্য জেলা থেকেও যোগ করতে পারবেন।")}
            >
              <SearchSelect
                id="location-district"
                value={locationDistrict}
                onChange={setLocationDistrict}
                options={DISTRICTS}
                placeholder={tr("জেলা বেছে নিন")}
              />
            </Field>
            {locationDistrict && (
              <div className="mt-4 flex flex-wrap gap-2">
                {(UPAZILAS[locationDistrict] ?? []).map((upazila) => {
                  const location = `${upazila}, ${locationDistrict}`
                  const selected = form.locationIds.includes(location)
                  return (
                    <label
                      key={location}
                      className={`flex min-h-11 cursor-pointer items-center rounded-full border px-4 font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-leaf ${
                        selected
                          ? "border-leaf bg-mint text-forest"
                          : "border-[#c5d0c8] hover:border-leaf"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={selected}
                        onChange={() => toggle("locationIds", location)}
                      />
                      {tr(selected && "✓ ")}
                      {tr(upazila)}
                    </label>
                  )
                })}
              </div>
            )}
            {form.locationIds.length > 0 && (
              <div className="mt-4 rounded-xl bg-paper p-4">
                <p className="mb-2 text-sm font-semibold text-forest">
                  {tr("নির্বাচিত লোকেশন (")}{tr(bn(form.locationIds.length))})
                </p>
                <div className="flex flex-wrap gap-2">
                  {form.locationIds.map((location) => (
                    <button
                      key={location}
                      type="button"
                      onClick={() => toggle("locationIds", location)}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-mint px-3 text-sm font-medium text-forest hover:bg-line"
                    >
                      <MapPin size={14} />
                      {tr(location)}
                      <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </fieldset>
        </section>

        <section
          className="border-t border-line pt-7"
          aria-labelledby="organization-capabilities"
        >
          <h2
            id="organization-capabilities"
            className="font-display text-xl font-bold text-forest"
          >
            {tr("যাচাইয়ের পর যা করতে পারবেন")}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex gap-3 rounded-xl bg-mint/60 p-4">
              <Users className="shrink-0 text-leaf" size={22} />
              <p>
                <strong className="block">{tr("স্বেচ্ছাসেবক ব্যবস্থাপনা")}</strong>
                <span className="text-sm text-ink-soft">
                  {tr("সদস্য যোগ বা অপসারণ এবং সক্রিয় দল দেখা")}</span>
              </p>
            </div>
            <div className="flex gap-3 rounded-xl bg-mint/60 p-4">
              <ShieldCheck className="shrink-0 text-leaf" size={22} />
              <p>
                <strong className="block">{tr("দল গঠন ও প্রোফাইল")}</strong>
                <span className="text-sm text-ink-soft">
                  {tr("নতুন দল তৈরি এবং সংগঠনের তথ্য হালনাগাদ")}</span>
              </p>
            </div>
          </div>
        </section>

        <div className="border-t border-line pt-7">
          <Button type="submit" size="lg" disabled={busy || imageProcessing} className="w-full">
            {tr("নিবন্ধনের আবেদন জমা দিন")}</Button>
          <p className="mt-3 text-center text-sm text-ink-soft">
            {tr("জমা দেওয়ার মাধ্যমে আপনি প্রদত্ত তথ্য সঠিক বলে নিশ্চিত করছেন।")}</p>
        </div>
      </form>
    </div>
  )
}

export { OrgDashboard as default } from "./OrgManagement"
