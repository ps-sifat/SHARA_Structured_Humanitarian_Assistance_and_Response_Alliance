import { useLanguage } from "./i18n"
import { useSearchParams } from "react-router"
import { MapPin, Users } from "lucide-react"
import { bn } from "./data"
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
} from "./ui"
import { progress, time } from "./model"
import { useDemo } from "./store"

export default function HelpRequests() {
  const { tr } = useLanguage()
  const s = useDemo(),
    [params, setParams] = useSearchParams()
  const district = params.get("district") ?? "",
    upazila = params.get("upazila") ?? ""
  const selected = s.requests.find(
    (r) => r.id === params.get("detail") && r.verification !== "rejected",
  )
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    value ? next.set(key, value) : next.delete(key)
    if (key === "district") next.delete("upazila")
    setParams(next)
  }
  const list = s.requests.filter(
    (r) =>
      r.verification !== "rejected" &&
      (!district || r.district === district) &&
      (!upazila || r.upazila === upazila),
  )
  return (
    <div className="mx-auto max-w-6xl">
      <PageHead
        title={tr("সহায়তার আবেদনসমূহ")}
        sub={tr("গোপনীয়তা-সুরক্ষিত সারসংক্ষেপ; আবেদন শুধু সুপার অ্যাডমিন দলকে বরাদ্দ করেন")}
      />
      <Alert>
        {tr("ব্যক্তিগতভাবে আবেদন গ্রহণ করা যায় না। আপনার দলের জন্য বরাদ্দ হলে দলনেতা কার্যক্রমের স্বীকৃতি দেবেন।")}</Alert>
      <Card className="my-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr("জেলা")} htmlFor="browse-district">
            <Select
              id="browse-district"
              value={district}
              onChange={(e) => set("district", e.target.value)}
            >
              <option value="">{tr("সব জেলা")}</option>
              {[...new Set(s.requests.map((r) => r.district))].map((d) => (
                <option key={d} value={d}>{tr(d)}</option>
              ))}
            </Select>
          </Field>
          <Field label={tr("উপজেলা")} htmlFor="browse-upazila">
            <Select
              id="browse-upazila"
              value={upazila}
              onChange={(e) => set("upazila", e.target.value)}
            >
              <option value="">{tr("সব উপজেলা")}</option>
              {[
                ...new Set(
                  s.requests
                    .filter((r) => !district || r.district === district)
                    .map((r) => r.upazila),
                ),
              ].map((u) => (
                <option key={u} value={u}>{tr(u)}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>
      <Dialog
        open={!!selected}
        onClose={() => set("detail", "")}
        title={tr("নিরাপদ আবেদন সারসংক্ষেপ")}
      >
        {selected && <div>
          <SectionTitle>{tr(selected.id)}</SectionTitle>
          <p>
            {tr(selected.upazila)}, {tr(selected.district)} · {tr(bn(selected.people))} {tr(" জন")}</p>
          <p className="mt-3">{tr("সহায়তা: ")}{tr(selected.aid.join(", "))}</p>
          <p className="mt-3">{tr(progress(s, selected))}</p>
          <p className="mt-3 text-sm text-ink-soft">
            {tr("নাম, ফোন, নির্দিষ্ট ঠিকানা ও ব্যক্তিগত বিবরণ এখানে দেখানো হয় না।")}</p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => set("detail", "")}
          >
            {tr("সারসংক্ষেপ বন্ধ করুন")}</Button>
        </div>}
      </Dialog>
      <p className="mb-3 text-sm text-ink-soft">{tr(bn(list.length))}{tr("টি আবেদন")}</p>
      {list.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((r) => (
            <Card key={r.id}>
              <div className="flex justify-between gap-3">
                <p className="font-semibold">{tr(r.id)}</p>
                <Badge s={r.priority} />
              </div>
              <p className="mt-2 text-xl font-bold text-forest">
                {tr(r.aid.join(", "))}
              </p>
              <p className="mt-3 flex items-center gap-1 text-ink-soft">
                <MapPin size={15} />
                {tr(r.upazila)}, {tr(r.district)}
              </p>
              <p className="mt-2 flex items-center gap-1">
                <Users size={16} />
                {tr(bn(r.people))} {tr(" জন · ")}{tr(time(r.createdAt))}
              </p>
              <p className="mt-3">{tr(progress(s, r))}</p>
              {r.risks.length > 0 && (
                <p className="mt-2 text-sm">{tr(r.risks.join(" · "))}</p>
              )}
              <Button
                className="mt-5 w-full"
                variant="secondary"
                onClick={() => set("detail", r.id)}
              >
                {tr("সারসংক্ষেপ দেখুন")}</Button>
            </Card>
          ))}
        </div>
      ) : (
        <Empty
          title={tr("কোনো আবেদন পাওয়া যায়নি")}
          action={
            <Button variant="secondary" onClick={() => setParams({})}>
              {tr("ফিল্টার মুছুন")}</Button>
          }
        >
          {tr("অন্য এলাকা দিয়ে চেষ্টা করুন।")}</Empty>
      )}
    </div>
  )
}
