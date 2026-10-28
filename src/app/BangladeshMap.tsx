import { useLanguage } from "./i18n"
import { matchesSearch } from "./locale"
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Minus, Plus, RotateCcw, Search, ShieldCheck, MapPin } from 'lucide-react'
import { CELLS, H, W, outlinePath, pos } from './geo'
import { PLACES, bn, type Place } from './data'
import { Badge, Button, Empty, Spinner, Alert } from './ui'

type Mode = 'ok' | 'loading' | 'error' | 'empty'

export default function BangladeshMap({ tall = false }: { tall?: boolean }) {
  const { tr } = useLanguage()
  const [mode, setMode] = useState<Mode>('ok')
  const [scale, setScale] = useState(1)
  const [center, setCenter] = useState<[number, number]>([W / 2, H / 2])
  const [sel, setSel] = useState<Place | null>(null)
  const [emptyPick, setEmptyPick] = useState(false)
  const [q, setQ] = useState('')
  const [hover, setHover] = useState<string | null>(null)

  const places = mode === 'empty' ? [] : PLACES
  const results = useMemo(() => (q.trim() ? PLACES.filter((p) => matchesSearch(`${p.upazila}, ${p.district}`, q)) : []), [q])
  const vw = W / scale, vh = H / scale
  const x0 = Math.min(Math.max(center[0] - vw / 2, 0), W - vw), y0 = Math.min(Math.max(center[1] - vh / 2, 0), H - vh)

  const pick = (p: Place, zoom = true) => {
    setSel(p); setEmptyPick(false)
    if (zoom) { setScale(2.4); setCenter(pos(p)) }
  }
  const reset = () => { setScale(1); setCenter([W / 2, H / 2]); setSel(null); setEmptyPick(false); setQ('') }
  const zoom = (f: number) => setScale((s) => Math.min(5, Math.max(1, s * f)))
  const placeKey = (p: Place) => places.find((x) => x.id === p.id)

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white font-[Hind_Siliguri,sans-serif]">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label={tr("জেলা বা উপজেলা খুঁজুন")} placeholder={tr("জেলা বা উপজেলার নাম লিখুন")} className="min-h-11 w-full rounded-[10px] border border-[#c5d0c8] pl-10 pr-3" />
          {q.trim() && (
            <ul className="absolute z-20 mt-1 w-full rounded-[10px] border border-line bg-white p-1 shadow-lg">
              {results.length === 0 && <li className="px-3 py-2 text-sm text-ink-soft">{tr("কোনো এলাকা পাওয়া যায়নি")}</li>}
              {results.map((p) => (
                <li key={p.id}><button onClick={() => { pick(p); setQ('') }} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-mint"><MapPin size={15} className="text-alert" />{tr(p.upazila)}<span className="text-sm text-ink-soft">· {tr(p.district)}</span></button></li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center gap-2" role="group" aria-label={tr("মানচিত্র নিয়ন্ত্রণ")}>
          <Button variant="secondary" aria-label={tr("বড় করুন")} onClick={() => zoom(1.5)} className="!px-0 w-11"><Plus size={18} /></Button>
          <Button variant="secondary" aria-label={tr("ছোট করুন")} onClick={() => zoom(1 / 1.5)} className="!px-0 w-11"><Minus size={18} /></Button>
          <Button variant="secondary" onClick={reset}><RotatecwIcon />{tr("আগের অবস্থায়")}</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px]">
        <div className="relative bg-[#f3f6f3]">
          <div className={`mx-auto w-full ${tall ? 'max-w-[560px]' : 'max-w-[480px]'} px-4 py-4`}>
            {mode === 'loading' && <div className="grid aspect-[400/543] place-items-center"><Spinner label={tr("মানচিত্রের তথ্য লোড হচ্ছে...")} /></div>}
            {mode === 'error' && (
              <div className="grid aspect-[400/543] place-items-center p-4">
                <div className="max-w-xs"><Alert kind="error" title={tr("মানচিত্রের তথ্য আনা যায়নি")}>{tr("ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন। আপনি চাইলে মানচিত্র ছাড়াই আবেদন করতে পারেন।")}</Alert>
                  <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => setMode('ok')}>{tr("আবার চেষ্টা করুন")}</Button><Button size="sm" variant="secondary" to="/apply">{tr("আবেদন করুন")}</Button></div></div>
              </div>
            )}
            {(mode === 'ok' || mode === 'empty') && (
              <svg viewBox={`${x0} ${y0} ${vw} ${vh}`} className="w-full" role="img" aria-label={tr("বাংলাদেশের মানচিত্র")}>
                <defs><clipPath id="bd"><path d={outlinePath} /></clipPath></defs>
                <path d={outlinePath} fill="#e9eee9" />
                <g clipPath="url(#bd)">
                  {CELLS.map((c) => (
                    <g key={c.key}>
                      <path d={c.path} fill={c.flooded && mode === 'ok' ? '#fdebc8' : '#f4f7f4'} />
                      {c.subs.map((s, i) => (
                        <path key={i} d={s.path} fill={s.place?.flooded && mode === 'ok' ? '#f8c978' : 'none'} stroke="#cfd8d1" strokeWidth={0.35 / Math.sqrt(scale)} />
                      ))}
                    </g>
                  ))}
                  {CELLS.map((c) => (
                    <path key={'d' + c.key} d={c.path} fill={hover === c.key ? 'rgba(46,107,79,.12)' : 'transparent'} stroke="#6f8a7a" strokeWidth={0.9 / Math.sqrt(scale)} className="cursor-pointer"
                      onMouseEnter={() => setHover(c.key)} onMouseLeave={() => setHover(null)}
                      onClick={() => { const p = mode === 'ok' ? c.subs.find((s) => s.place)?.place : undefined; if (p) pick(p, false); else { setSel(null); setEmptyPick(true) } }} />
                  ))}
                </g>
                <path d={outlinePath} fill="none" stroke="#12372a" strokeWidth={1.5 / Math.sqrt(scale)} strokeLinejoin="round" pointerEvents="none" />
                {scale > 1.4 && CELLS.map((c) => (
                  <text key={'t' + c.key} x={c.c[0]} y={c.c[1]} textAnchor="middle" fontSize={5 / Math.sqrt(scale / 1.4)} fill="#12372a" fontWeight={600} paintOrder="stroke" stroke="#f8faf8" strokeWidth={1.6} pointerEvents="none">{tr(c.key)}</text>
                ))}
                {places.map((p) => {
                  const [x, y] = pos(p)
                  const on = sel?.id === p.id
                  const r = (3.6 + Math.min(p.requests, 20) * 0.12) / Math.sqrt(scale)
                  return (
                    <g key={p.id} className="cursor-pointer" onClick={() => pick(p, false)} role="button" tabIndex={0} aria-label={tr(`${p.upazila}, ${bn(p.requests)}টি আবেদন`)} onKeyDown={(e) => e.key === 'Enter' && pick(p, false)}>
                      {p.status.pending > 0 && <circle cx={x} cy={y} r={r} fill="#dc2626" className="pulse-ring" />}
                      {on && <circle cx={x} cy={y} r={r + 3 / Math.sqrt(scale)} fill="none" stroke="#12372a" strokeWidth={1.2 / Math.sqrt(scale)} />}
                      <circle cx={x} cy={y} r={r} fill="#dc2626" stroke="#fff" strokeWidth={1.2 / Math.sqrt(scale)} />
                    </g>
                  )
                })}
              </svg>
            )}
          </div>

          <div className="absolute left-3 top-3 hidden flex-col gap-1 rounded-lg border border-line bg-white/90 p-1 text-xs text-ink-soft sm:flex" role="group" aria-label={tr("মানচিত্রের অবস্থা পরিবর্তন")}>
            <span className="px-2 pt-1 font-semibold">{tr("মানচিত্রের অবস্থা")}</span>
            {([['ok', 'স্বাভাবিক'], ['loading', 'লোড হচ্ছে'], ['error', 'ত্রুটি'], ['empty', 'আবেদন নেই']] as [Mode, string][]).map(([m, l]) => (
              <button key={m} onClick={() => { setMode(m); if (m === 'loading') setTimeout(() => setMode('ok'), 1500) }} aria-pressed={mode === m} className={`rounded px-2 py-1 text-left ${mode === m ? 'bg-forest text-white' : 'hover:bg-mint'}`}>{tr(l)}</button>
            ))}
          </div>
        </div>

        <aside className="border-t border-line p-5 lg:border-l lg:border-t-0" aria-live="polite">
          <Legend />
          <div className="mt-5 border-t border-line pt-5">
            <Detail p={sel && placeKey(sel) ? sel : null} emptyPick={emptyPick} mode={mode} />
          </div>
        </aside>
      </div>
    </div>
  )
}

const RotatecwIcon = () => <RotateCcw size={16} />

export function Legend() {
  const { tr } = useLanguage()
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">{tr("সংকেত")}</h3>
      <ul className="space-y-2.5 text-[15px]">
        <li className="flex items-center gap-3"><span className="grid size-5 place-items-center"><span className="size-3.5 rounded-full border-2 border-white bg-alert shadow ring-1 ring-alert/30" /></span>{tr("সাহায্যের আবেদন রয়েছে")}</li>
        <li className="flex items-center gap-3"><span className="size-5 rounded border border-[#e9b556] bg-[#f8c978]" />{tr("যাচাইকৃত বন্যাকবলিত এলাকা")}</li>
        <li className="flex items-center gap-3"><span className="size-5 rounded border border-[#cfd8d1] bg-[#e9eee9]" />{tr("বর্তমানে যাচাইকৃত বন্যা-সংক্রান্ত তথ্য নেই")}</li>
      </ul>
      <p className="mt-3 text-sm text-ink-soft">{tr("আবেদন থাকা মানেই পুরো উপজেলা বন্যাকবলিত নয়। আবেদন ও যাচাইকৃত বন্যার তথ্য আলাদা স্তর।")}</p>
    </div>
  )
}

function Detail({ p, emptyPick, mode }: { p: Place | null; emptyPick: boolean; mode: Mode }) {
  const { tr } = useLanguage()
  if (mode === 'empty') return <Empty icon={<MapPin size={22} />} title={tr("এখনো কোনো আবেদন নেই")}>{tr("নতুন আবেদন এলে এখানে এলাকাভিত্তিক সারসংক্ষেপ দেখা যাবে।")}</Empty>
  if (!p)
    return emptyPick ? (
      <Empty icon={<MapPin size={22} />} title={tr("এই এলাকায় কোনো আবেদন নেই")}>{tr("অন্য এলাকা বেছে নিন, অথবা আপনি বিপদে থাকলে আবেদন করুন।")}</Empty>
    ) : (
      <div className="text-ink-soft"><p className="font-semibold text-ink">{tr("একটি এলাকা বেছে নিন")}</p><p className="mt-1 text-[15px]">{tr("মানচিত্রে লাল চিহ্নে ক্লিক করুন অথবা উপরে নাম লিখে খুঁজুন।")}</p></div>
    )
  const s = p.status
  const rows: [string, number, string][] = [['অপেক্ষমাণ', s.pending, '#f59e0b'], ['যাচাইধীন', s.verifying, '#8a968e'], ['সাহায্য চলমান', s.ongoing, '#2e6b4f'], ['সম্পন্ন', s.done, '#12372a']]
  return (
    <div>
      <p className="text-sm text-ink-soft">{tr(p.district)} {tr(" জেলা")}</p>
      <h3 className="font-display text-2xl font-bold text-forest">{tr(p.upazila)}</h3>
      <div className="mt-2">{p.flooded ? <Badge s="pending">{tr("যাচাইকৃত বন্যাকবলিত")}</Badge> : <Badge s="neutral">{tr("যাচাইকৃত বন্যার তথ্য নেই")}</Badge>}</div>
      <div className="mt-4 flex items-baseline gap-2"><span className="font-display text-4xl font-bold text-alert">{tr(bn(p.requests))}</span><span className="text-ink-soft">{tr("টি সাহায্যের আবেদন")}</span></div>
      <div className="mt-4"><p className="mb-1.5 text-sm font-semibold text-ink-soft">{tr("প্রয়োজনীয় সহায়তা")}</p><div className="flex flex-wrap gap-1.5">{p.categories.map((c) => <span key={c} className="rounded-md bg-mint px-2 py-0.5 text-sm text-forest">{tr(c)}</span>)}</div></div>
      <div className="mt-4">
        <p className="mb-1.5 text-sm font-semibold text-ink-soft">{tr("আবেদনের অবস্থা (মোট)")}</p>
        <div className="mb-2 flex h-2.5 overflow-hidden rounded-full bg-neutral-100">{rows.map(([l, n, c]) => <span key={l} style={{ width: `${(n / p.requests) * 100}%`, background: c }} title={tr(l)} />)}</div>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">{rows.map(([l, n, c]) => <li key={l} className="flex items-center gap-2"><span className="size-2.5 rounded-sm" style={{ background: c }} />{tr(l)}<b className="ml-auto">{tr(bn(n))}</b></li>)}</ul>
      </div>
      <p className="mt-4 flex gap-2 rounded-lg bg-paper p-3 text-sm text-ink-soft"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-leaf" />{tr("গোপনীয়তার জন্য নাম, ফোন নম্বর ও সঠিক ঠিকানা এখানে দেখানো হয় না।")}</p>
      <Link to={`/apply?district=${encodeURIComponent(p.district)}&upazila=${encodeURIComponent(p.upazila)}`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-[10px] bg-forest font-semibold text-white hover:bg-leaf">{tr("এই এলাকায় সাহায্যের আবেদন")}</Link>
    </div>
  )
}
