import { useLanguage } from "./i18n"
import BangladeshMap from './BangladeshMap'
import { Button } from './ui'

export default function MapPage() {
  const { tr } = useLanguage()
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-forest sm:text-4xl">{tr("বাংলাদেশের বন্যা পরিস্থিতি")}</h1>
          <p className="mt-2 text-lg text-ink-soft">{tr("কোথায় সাহায্যের প্রয়োজন, দেখুন এলাকার ভিত্তিতে")}</p>
        </div>
        <Button to="/apply" className="!bg-alert hover:!bg-red-700">{tr("সাহায্যের আবেদন করুন")}</Button>
      </div>
      <BangladeshMap tall />
    </div>
  )
}
