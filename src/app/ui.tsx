import { useLanguage } from "./i18n"
import { matchesSearch } from "./locale"
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react"
import { createPortal } from "react-dom"
import { Link } from "react-router"
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleCheck,
  Info,
  Loader2,
  Search,
  X,
} from "lucide-react"
import { statusLabel } from "./data"
import { labels } from "./model"

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <rect
          width="34"
          height="34"
          rx="9"
          fill={light ? "#EAF4EE" : "#12372A"}
        />
        <path
          d="M17 7.5c-2.6 3.4-6 6-6 9.6a6 6 0 0 0 12 0c0-3.6-3.4-6.2-6-9.6Z"
          fill={light ? "#12372A" : "#EAF4EE"}
        />
        <path
          d="M7 24.5c3 0 3-1.6 5.2-1.6s2.8 1.6 4.8 1.6 2.8-1.6 4.8-1.6 2.2 1.6 5.2 1.6"
          stroke="#2E6B4F"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <span
        className={`font-display text-xl font-bold tracking-wide ${
          light ? "text-white" : "text-forest"
        }`}
      >
        SHARA
      </span>
    </span>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost"
  size?: "md" | "lg" | "sm"
  to?: string
}
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed select-none whitespace-nowrap"
const btnVar = {
  primary: "bg-forest text-white hover:bg-leaf",
  secondary: "bg-white text-forest border border-forest/30 hover:bg-mint",
  danger: "bg-alert text-white hover:bg-red-700",
  ghost: "text-forest hover:bg-mint",
}
const btnSize = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-[15px]",
  lg: "min-h-[52px] px-6 text-lg",
}
export function Button({
  variant = "primary",
  size = "md",
  to,
  className = "",
  children,
  ...p
}: BtnProps) {
  const { tr } = useLanguage()
  const cls = `${btnBase} ${btnVar[variant]} ${btnSize[size]} ${className}`
  if (to)
    return (
      <Link
        to={to}
        className={cls}
        aria-label={tr(p["aria-label"])}
      >
        {children}
      </Link>
    )
  return (
    <button type="button" className={cls} {...p}>
      {children}
    </button>
  )
}

const tone: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  verified: "bg-mint text-forest border-[#c5e0d1]",
  rejected: "bg-neutral-100 text-neutral-600 border-neutral-300",
  assigned: "bg-sky-50 text-sky-800 border-sky-200",
  ongoing: "bg-indigo-50 text-indigo-800 border-indigo-200",
  done: "bg-mint text-forest border-[#c5e0d1]",
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-800 border-amber-200",
  low: "bg-neutral-100 text-neutral-700 border-neutral-300",
  neutral: "bg-neutral-100 text-neutral-700 border-neutral-300",
}
export function Badge({
  s,
  children,
  dot = true,
}: {
  s: string
  children?: ReactNode
  dot?: boolean
}) {
  const { tr } = useLanguage()
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${tone[s] ?? tone.neutral}`}
    >
      {dot && (
        <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      )}
      {tr(children ?? labels[s] ?? statusLabel[s] ?? s)}
    </span>
  )
}

export function Field({
  label,
  required,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
  htmlFor?: string
}) {
  const { tr } = useLanguage()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[15px] font-semibold text-ink">
        {tr(label)}{" "}
        {required ? (
          <span className="text-alert" aria-label={tr("আবশ্যক")}>
            *
          </span>
        ) : (
          <span className="text-sm font-normal text-ink-soft">{tr("(ঐচ্ছিক)")}</span>
        )}
      </label>
      {children}
      {hint && !error && <p className="text-sm text-ink-soft">{tr(hint)}</p>}
      {error && (
        <p
          role="alert"
          className="flex items-center gap-1.5 text-sm font-medium text-alert"
        >
          <AlertTriangle size={15} />
          {tr(error)}
        </p>
      )}
    </div>
  )
}
export const inputCls =
  "min-h-12 w-full rounded-[10px] border border-[#c5d0c8] bg-white px-3.5 text-base text-ink placeholder:text-[#8a968e] hover:border-leaf aria-[invalid=true]:border-alert aria-[invalid=true]:bg-red-50/40"

export function SearchSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  invalid,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder: string
  disabled?: boolean
  invalid?: boolean
}) {
  const { tr } = useLanguage()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const list = useId()
  const filtered = useMemo(
    () => options.filter((o) => matchesSearch(o, q)),
    [options, q],
  )
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])
  return (
    <div
      ref={ref}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault()
          event.stopPropagation()
          setOpen(false)
          document.getElementById(id)?.focus()
        }
      }}
    >
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={list}
        aria-invalid={invalid}
        onClick={() => setOpen((o) => !o)}
        className={`${inputCls} flex items-center justify-between text-left disabled:bg-neutral-100 disabled:text-neutral-500`}
      >
        <span className={value ? "" : "text-[#8a968e]"}>
          {tr(value || placeholder)}
        </span>
        <ChevronDown size={18} className="text-ink-soft" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-[10px] border border-line bg-white p-2 shadow-lg">
          <div className="relative mb-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
            />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tr("খুঁজুন...")}
              aria-label={tr("খুঁজুন")}
              className="min-h-10 w-full rounded-lg border border-line pl-9 pr-2 text-[15px]"
            />
          </div>
          <ul id={list} role="listbox" className="max-h-52 overflow-auto">
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-sm text-ink-soft">{tr("কিছু পাওয়া যায়নি")}</li>
            )}
            {filtered.map((o) => (
              <li key={o} role="option" aria-selected={o === value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o)
                    setOpen(false)
                    setQ("")
                  }}
                  className="flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left text-[15px] hover:bg-mint"
                >
                  {tr(o)}
                  {o === value && <Check size={16} className="text-leaf" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function Alert({
  kind = "info",
  title,
  children,
}: {
  kind?: "info" | "error" | "success" | "warn"
  title?: string
  children?: ReactNode
}) {
  const { tr } = useLanguage()
  const m = {
    info: ["bg-mint border-[#c5e0d1] text-forest", Info],
    error: ["bg-red-50 border-red-200 text-red-800", AlertTriangle],
    success: ["bg-mint border-[#c5e0d1] text-forest", CircleCheck],
    warn: ["bg-amber-50 border-amber-200 text-amber-900", AlertTriangle],
  } as const
  const [c, Icon] = m[kind]
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`flex gap-3 rounded-[10px] border p-3.5 text-[15px] ${c}`}
    >
      <Icon size={20} className="mt-0.5 shrink-0" />
      <div>
        {title && <p className="font-semibold">{tr(title)}</p>}
        {children && (
          <div className={title ? "opacity-90" : ""}>{children}</div>
        )}
      </div>
    </div>
  )
}

export function Spinner({ label = "লোড হচ্ছে..." }: { label?: string }) {
  const { tr } = useLanguage()
  return (
    <div role="status" className="flex items-center gap-2 text-ink-soft">
      <Loader2 className="animate-spin" size={20} />
      {tr(label)}
    </div>
  )
}

export function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  const { tr } = useLanguage()
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#c5d0c8] bg-white px-6 py-10 text-center">
      {icon && (
        <div className="mb-1 grid size-12 place-items-center rounded-full bg-mint text-leaf">
          {icon}
        </div>
      )}
      <p className="text-lg font-semibold text-ink">{tr(title)}</p>
      {children && <p className="max-w-sm text-ink-soft">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const { tr } = useLanguage()
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!open || !ref.current) return
    const previousFocus = document.activeElement as HTMLElement | null
    const element = ref.current
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    element.showModal()
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return
      const controls = [
        ...element.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((control) => control.getClientRects().length > 0)
      const first = controls[0],
        last = controls[controls.length - 1]
      if (!first) {
        event.preventDefault()
        element.focus()
        return
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === element)
      ) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    element.addEventListener("keydown", trapFocus)
    return () => {
      document.body.style.overflow = overflow
      element.removeEventListener("keydown", trapFocus)
      element.close()
      previousFocus?.focus()
    }
  }, [open])
  if (!open) return null
  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const bounds = event.currentTarget.getBoundingClientRect()
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            onClose()
        }
      }}
      className="m-auto max-h-[92dvh] w-11/12 max-w-lg overflow-auto rounded-2xl border-0 bg-white p-6 text-ink shadow-2xl backdrop:bg-forest/40"
    >
      <div className="mb-3 flex items-start justify-between gap-4">
        <h2 id={titleId} className="font-display text-xl font-bold text-forest">
          {tr(title)}
        </h2>
        <Button variant="ghost" aria-label={tr("বন্ধ করুন")} onClick={onClose}>
          <X size={20} />
        </Button>
      </div>
      <div className="text-ink-soft">{children}</div>
      {footer && (
        <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div>
      )}
    </dialog>,
    document.body,
  )
}

export function Table({
  head,
  children,
}: {
  head: string[]
  children: ReactNode
}) {
  const { tr } = useLanguage()
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full min-w-[640px] text-left text-[15px]">
        <thead>
          <tr className="border-b border-line bg-paper text-sm text-ink-soft">
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-semibold">
                {tr(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-0 [&_td]:px-4 [&_td]:py-3 [&_td]:align-middle">
          {children}
        </tbody>
      </table>
    </div>
  )
}

export function Pager({
  page,
  pages,
  onChange,
}: {
  page: number
  pages: number
  onChange: (p: number) => void
}) {
  const { tr } = useLanguage()
  return (
    <nav
      aria-label={tr("পৃষ্ঠা")}
      className="flex items-center justify-between pt-3 text-sm text-ink-soft"
    >
      <span>
        {tr("পৃষ্ঠা ")}{tr(page)} / {tr(pages)}
      </span>
      <span className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          {tr("আগের")}</Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          {tr("পরের")}</Button>
      </span>
    </nav>
  )
}

export function Stepper({
  steps,
  current,
}: {
  steps: string[]
  current: number
}) {
  const { tr } = useLanguage()
  return (
    <ol className="flex flex-wrap items-center gap-y-2 text-sm">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center">
          <span
            className={`flex items-center gap-2 rounded-full px-3 py-1 font-medium ${
              i < current
                ? "bg-forest text-white"
                : i === current
                  ? "bg-mint text-forest ring-2 ring-leaf"
                  : "bg-neutral-100 text-neutral-500"
            }`}
          >
            {i < current ? <Check size={14} /> : <span>{tr(i + 1)}</span>}
            {tr(s)}
          </span>
          {i < steps.length - 1 && (
            <span
              className={`mx-1 h-px w-4 sm:w-6 ${
                i < current ? "bg-forest" : "bg-line"
              }`}
            />
          )}
        </li>
      ))}
    </ol>
  )
}

export function PageHead({
  title,
  sub,
  action,
}: {
  title: string
  sub?: string
  action?: ReactNode
}) {
  const { tr } = useLanguage()
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold text-forest sm:text-3xl">
          {tr(title)}
        </h1>
        {sub && <p className="mt-1 text-ink-soft">{tr(sub)}</p>}
      </div>
      {action}
    </div>
  )
}

export const Card = ({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) => (
  <section
    className={`rounded-xl border border-line bg-white p-5 ${className}`}
  >
    {children}
  </section>
)

// Small extensions of SHARA's existing form primitives; all share the original tokens.
export const Input = ({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={`${inputCls} ${className}`} {...props} />
)
export const Select = ({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={`${inputCls} ${className}`} {...props} />
)
export const TextArea = ({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={`${inputCls} py-3 ${className}`} {...props} />
)
export const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h2 className="mb-3 font-display text-xl font-bold text-forest">
    {children}
  </h2>
)
export function Choices({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  const { tr } = useLanguage()
  return (
    <fieldset>
      <legend className="mb-2 font-semibold text-ink">{tr(label)}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value.includes(option)
          return (
            <label
              key={option}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-leaf ${
                selected
                  ? "border-forest bg-forest text-white"
                  : "border-line bg-white text-ink hover:border-leaf"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={selected}
                onChange={() =>
                  onChange(
                    selected
                      ? value.filter((x) => x !== option)
                      : [...value, option],
                  )
                }
              />
              {selected && <Check size={15} aria-hidden="true" />}
              {tr(option)}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export function MemberChoices({
  options,
  value,
  onChange,
}: {
  options: {
    id: string
    name: string
  }[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  const { tr } = useLanguage()
  return (
    <fieldset>
      <legend className="mb-2 font-semibold text-ink">
        {tr("অনুমোদিত সদস্য (অন্তত একজন)")}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value.includes(option.id)
          return (
            <label
              key={option.id}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-leaf ${
                selected
                  ? "border-forest bg-forest text-white"
                  : "border-line bg-white text-ink hover:border-leaf"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={selected}
                onChange={() =>
                  onChange(
                    selected
                      ? value.filter((id) => id !== option.id)
                      : [...value, option.id],
                  )
                }
              />
              {selected && <Check size={15} aria-hidden="true" />}
              {option.name}
              <span className="sr-only"> — {tr(option.id)}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
