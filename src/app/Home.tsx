import { useLanguage } from "./i18n"
import { Link } from "react-router"
import {
  ArrowRight,
  ClipboardCheck,
  FilePenLine,
  HandHeart,
  ShieldCheck,
  Truck,
  UserX,
  Users,
} from "lucide-react"
import BangladeshMap from "./BangladeshMap"
import { Button } from "./ui"
import { bn } from "./data"
import { useDemo } from "./store"
import { active } from "./model"

const steps = [
  [FilePenLine, "সাহায্যের আবেদন জানান", "অ্যাকাউন্ট ছাড়াই কয়েকটি তথ্য দিয়ে আবেদন পাঠান।"],
  [ClipboardCheck, "আবেদন যাচাই করা হয়", "প্রশাসকরা তথ্য যাচাই করে অগ্রাধিকার ঠিক করেন।"],
  [
    Users,
    "উপযুক্ত স্বেচ্ছাসেবক দল নির্ধারণ করা হয়",
    "এলাকা ও সক্ষমতা দেখে সবচেয়ে কাছের দল বেছে নেওয়া হয়।",
  ],
  [Truck, "সহায়তা পৌঁছে দেওয়া হয়", "দলটি সহায়তা পৌঁছে কার্যক্রমের অবস্থা হালনাগাদ করে।"],
] as const

export default function Home() {
  const { tr } = useLanguage()
  const s = useDemo()
  const metrics = [
    ["মোট সাহায্যের আবেদন", s.requests.length],
    [
      "যাচাইধীন আবেদন",
      s.requests.filter((r) =>
        ["pending", "clarification"].includes(r.verification),
      ).length,
    ],
    ["সাহায্য চলমান", s.missions.filter(active).length],
    ["সহায়তা সম্পন্ন", s.missions.filter((m) => m.status === "done").length],
  ] as const
  return (
    <>
      <section className="border-b border-line bg-paper">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1 text-sm font-medium text-forest">
              <UserX size={16} />
              {tr("কোনো অ্যাকাউন্ট বা নিবন্ধন ছাড়াই আবেদন করা যায়")}</p>
            <h1 className="font-display text-[2.5rem] font-extrabold leading-[1.25] text-forest sm:text-6xl sm:leading-[1.2]">
              {tr("দুর্যোগে, মানুষের পাশে মানুষ")}</h1>
            <p className="mt-5 max-w-xl text-xl leading-relaxed text-ink-soft">
              {tr("বন্যায় আটকে পড়েছেন? আপনার বা অন্য কারও সাহায্যের আবেদন জানান।")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                to="/apply"
                size="lg"
                className="!bg-alert text-xl hover:!bg-red-700 sm:min-w-[260px]"
              >
                {tr("সাহায্যের আবেদন করুন ")}<ArrowRight size={22} />
              </Button>
              <Button to="/map" size="lg" variant="secondary">
                {tr("বন্যা পরিস্থিতি দেখুন")}</Button>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
              <ShieldCheck size={16} className="text-leaf" />
              {tr("জনসমক্ষে নাম/ফোন দেখানো হয় না।")}</p>
            <Button to="/track" variant="ghost" className="mt-3">
              {tr("আগের আবেদন ট্র্যাক করুন ")}<ArrowRight size={16} />
            </Button>
          </div>
          <figure className="relative">
            <div className="aspect-[5/4] overflow-hidden rounded-[20px] bg-mint">
              <img
                src="https://images.unsplash.com/photo-1601535928645-6b11617be149?w=1000&h=800&fit=crop&auto=format"
                alt={tr("বন্যার পানিতে নৌকায় দুজন মানুষ")}
                className="size-full object-cover"
                loading="eager"
              />
            </div>
            <div className="absolute -bottom-5 left-4 right-4 flex items-center gap-3 rounded-xl border border-line bg-white p-4 shadow-sm sm:left-auto sm:max-w-xs">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-mint text-leaf">
                <HandHeart size={20} />
              </span>
              <p className="text-[15px] leading-snug text-ink">
                {tr("স্থানীয় স্বেচ্ছাসেবক দলের মাধ্যমে সহায়তা সমন্বয় করা হয়")}</p>
            </div>
          </figure>
        </div>
      </section>

      <section id="map" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <h2 className="font-[Hind_Siliguri,sans-serif] text-3xl font-bold text-forest sm:text-4xl">
            {tr("বাংলাদেশের কোথায় সাহায্য প্রয়োজন?")}</h2>
          <p className="mt-2 font-[Hind_Siliguri,sans-serif] text-lg text-ink-soft">
            {tr("জেলা ও উপজেলা অনুযায়ী সাহায্যের আবেদন দেখুন এবং মানবিক সহায়তায় এগিয়ে আসুন।")}</p>
        </div>
        <BangladeshMap />
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 font-[Hind_Siliguri,sans-serif]">
          <Button to="/apply" className="!bg-alert hover:!bg-red-700">
            {tr("সাহায্যের আবেদন জানান")}</Button>
          <Link
            to="/map"
            className="inline-flex items-center gap-2 font-semibold text-forest underline underline-offset-4"
          >
            {tr("পূর্ণ পর্দায় মানচিত্র দেখুন ")}<ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="border-y border-line bg-mint/60">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl font-bold text-forest">
              {tr("জরুরি পরিস্থিতির সারসংক্ষেপ")}</h2>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
            {metrics.map(([l, n]) => (
              <div key={l} className="bg-white p-5 sm:p-7">
                <dt className="text-ink-soft">{tr(l)}</dt>
                <dd className="mt-1 font-display text-4xl font-bold text-forest sm:text-5xl">
                  {tr(bn(n))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-3xl font-bold text-forest sm:text-4xl">
          {tr("SHARA কীভাবে কাজ করে")}</h2>
        <ol className="mt-10 grid gap-8 md:grid-cols-4">
          {steps.map(([Icon, t, d], i) => (
            <li key={t} className="relative border-t-2 border-forest pt-5">
              <span className="font-display text-sm font-bold text-leaf">
                {tr("ধাপ ")}{tr(bn(i + 1))}
              </span>
              <span className="mt-3 grid size-12 place-items-center rounded-xl bg-mint text-forest">
                <Icon size={24} />
              </span>
              <h3 className="mt-4 text-lg font-bold leading-snug">{tr(t)}</h3>
              <p className="mt-1.5 text-ink-soft">{tr(d)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-forest text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <h2 className="font-display text-3xl font-bold leading-snug sm:text-4xl">
              {tr("আপনার সহযোগিতা হতে পারে কারও বেঁচে থাকার আশার আলো")}</h2>
            <p className="mt-3 max-w-xl text-lg text-[#cfe3d7]">
              {tr("আপনার এলাকার মানুষের পাশে দাঁড়াতে স্বেচ্ছাসেবক হিসেবে যুক্ত হোন।")}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Button
              to="/volunteer/register"
              size="lg"
              className="!bg-white !text-forest hover:!bg-mint"
            >
              {tr("স্বেচ্ছাসেবক হিসেবে নিবন্ধন")}</Button>
            <Button
              to="/organization/register"
              size="lg"
              className="!border !border-white/50 !bg-transparent text-white hover:!bg-white/10"
            >
              {tr("সংগঠন হিসেবে নিবন্ধন")}</Button>
          </div>
        </div>
      </section>
    </>
  )
}
