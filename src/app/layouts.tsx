import { useLanguage } from "./i18n"
import { useEffect, useState } from "react"
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router"
import {
  Building2,
  ClipboardList,
  Flag,
  HeartHandshake,
  LayoutDashboard,
  Languages,
  Menu,
  Package,
  ShieldCheck,
  Users,
} from "lucide-react"
import { Alert, Button, Dialog, Field, Logo, Select } from "./ui"
import { type Role } from "./model"
import { getStorageWarning, resetDemo, useDemo } from "./store"
import { useAuth } from "./auth"

export const roleNav = {
  volunteer: [
    ["/volunteer", "ড্যাশবোর্ড", LayoutDashboard],
    ["/volunteer/missions", "আমার কার্যক্রম", Flag],
    ["/volunteer/organization", "আমার সংগঠন", Building2],
    ["/volunteer/team", "আমার ছোট দল", Users],
    ["/volunteer/requests", "সহায়তার আবেদন", ClipboardList],
    ["/volunteer/profile/edit", "প্রোফাইল ও প্রাপ্যতা", HeartHandshake],
  ],
  org: [
    ["/org", "ড্যাশবোর্ড", LayoutDashboard],
    ["/org/memberships", "সদস্যপদের অনুরোধ", ClipboardList],
    ["/org/volunteers", "স্বেচ্ছাসেবক", Users],
    ["/org/teams", "ছোট দলসমূহ", Users],
    ["/org/missions", "কার্যক্রম", Flag],
    ["/org/profile", "সংগঠনের প্রোফাইল", Building2],
  ],
  admin: [
    ["/admin", "সারসংক্ষেপ", LayoutDashboard],
    ["/admin/requests", "সহায়তার আবেদন", ClipboardList],
    ["/admin/missions", "কার্যক্রম", Flag],
    ["/admin/organizations", "সংগঠন যাচাই", Building2],
    ["/admin/teams", "দল ও প্রাপ্যতা", Users],
    ["/admin/suppliers", "সরবরাহকারী ও সম্পদ", Package],
  ],
} as const
const publicNav = [
  ["/", "হোম"],
  ["/apply", "সাহায্যের আবেদন"],
  ["/map", "বন্যা পরিস্থিতি"],
  ["/track", "আবেদন ট্র্যাক করুন"],
  ["/volunteer/register", "স্বেচ্ছাসেবক নিবন্ধন"],
  ["/organization/register", "সংগঠন নিবন্ধন"],
  ["/login", "লগইন"],
] as const
function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}
function LanguageSwitcher() {
  const { language, setLanguage, tr } = useLanguage()
  return (
    <div
      role="group"
      aria-label={tr("ভাষা নির্বাচন করুন")}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line bg-white p-1 text-forest"
    >
      <Languages size={16} aria-hidden="true" className="mx-1" />
      {([
        ["bn", "বাংলা"],
        ["en", "English"],
      ] as const).map(([value, label]) => (
        <Button
          key={value}
          size="sm"
          variant={language === value ? "primary" : "ghost"}
          className="!min-h-8 !rounded-md !px-3"
          lang={value}
          aria-pressed={language === value}
          onClick={() => setLanguage(value)}
        >
          {label}
        </Button>
      ))}
    </div>
  )
}
function NavItems({
  items,
  close,
  dark = false,
}: {
  items: ReadonlyArray<readonly [string, string, ...unknown[]]>
  close?: () => void
  dark?: boolean
}) {
  const { tr } = useLanguage()
  return (
    <>
      {items.map(([to, label]) => (
        <NavLink
          key={to}
          to={to}
          end={["/", "/org", "/volunteer", "/admin"].includes(to)}
          onClick={close}
          className={({ isActive }) =>
            `flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-3 font-medium ${
              isActive
                ? dark
                  ? "bg-white text-forest"
                  : "bg-mint text-forest"
                : dark
                  ? "text-mint hover:bg-white/10"
                  : "text-ink-soft hover:bg-mint"
            }`
          }
        >
          {tr(label)}
        </NavLink>
      ))}
    </>
  )
}
function DemoControl() {
  const { tr } = useLanguage()
  useDemo()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [reset, setReset] = useState(false)
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        {tr("ডেভেলপমেন্ট নমুনা ডেটা")}</Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false)
          setReset(false)
        }}
        title={tr("ডেভেলপমেন্ট নমুনা ডেটা")}
      >
        <div className="space-y-4">
          <Alert kind="info">
            {tr("এই ডেভেলপমেন্ট নিয়ন্ত্রণ শুধু স্থানীয় নমুনা ডেটা রিসেট করে। এটি কোনো অ্যাকাউন্টে লগইন বা পোর্টালের অনুমতি দেয় না।")}
          </Alert>
          {reset ? (
            <Alert kind="warn" title={tr("সব স্থানীয় পরিবর্তন মুছে যাবে")}>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="danger"
                  onClick={() => {
                    resetDemo()
                    setOpen(false)
                    nav("/")
                  }}
                >
                  {tr("হ্যাঁ, তথ্য রিসেট করুন")}</Button>
                <Button variant="secondary" onClick={() => setReset(false)}>
                  {tr("বাতিল")}</Button>
              </div>
            </Alert>
          ) : (
            <Button variant="secondary" onClick={() => setReset(true)}>
              {tr("তথ্য রিসেট করুন")}</Button>
          )}
        </div>
      </Dialog>
    </>
  )
}
export function PublicLayout() {
  const { tr, language, setLanguage } = useLanguage()
  useDemo()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollTop />
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-3 px-4 py-2 sm:px-6">
          <Link to="/" aria-label={tr("SHARA হোম")}>
            <Logo />
          </Link>
          <nav aria-label={tr("প্রধান মেনু")} className="ml-3 hidden gap-1 xl:flex">
            <NavItems items={publicNav.filter(([to]) => ["/", "/map", "/track"].includes(to))} />
          </nav>
          <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>
            <Button
              variant="secondary"
              className="!px-3 sm:!hidden"
              aria-label={tr("ভাষা নির্বাচন করুন")}
              aria-haspopup="dialog"
              aria-expanded={languageOpen}
              onClick={() => setLanguageOpen(true)}
            >
              <Languages size={20} aria-hidden="true" />
            </Button>
            <Button
              to="/login"
              variant="ghost"
              className="!hidden sm:!inline-flex"
            >
              {tr("লগইন")}</Button>
            <Button to="/apply" className="!bg-alert hover:!bg-red-700">{tr("সাহায্যের আবেদন")}</Button>
            <Button
              variant="secondary"
              aria-label={tr("প্রধান মেনু খুলুন")}
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu size={20} />
            </Button>
          </div>
        </div>
      </header>
      <Dialog
        open={languageOpen}
        onClose={() => setLanguageOpen(false)}
        title={tr("ভাষা নির্বাচন করুন")}
      >
        <div className="flex gap-3">
          {([
            ["bn", "বাংলা"],
            ["en", "English"],
          ] as const).map(([value, label]) => (
            <Button
              key={value}
              variant={language === value ? "primary" : "secondary"}
              className="flex-1"
              lang={value}
              aria-pressed={language === value}
              onClick={() => {
                setLanguage(value)
                setLanguageOpen(false)
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </Dialog>
      <Dialog open={open} onClose={() => setOpen(false)} title={tr("প্রধান মেনু")}>
        <nav className="grid gap-1">
          <NavItems items={publicNav} close={() => setOpen(false)} />
        </nav>
      </Dialog>
      <main id="main" className="flex-1">
        {getStorageWarning() && <div className="mx-auto max-w-7xl p-4"><Alert kind="warn">{tr(getStorageWarning())}</Alert></div>}
        {pathname === "/" && (
          <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
            <Alert kind="warn" title={tr("নমুনা ডেটা")}>
              {tr("হোমের সারসংক্ষেপে নমুনা তথ্য আছে। আবেদন, মানচিত্র ও ট্র্যাকিং এখন ডাটাবেসের তথ্য ব্যবহার করে।")}
            </Alert>
          </div>
        )}
        <Outlet />
      </main>
      <footer className="bg-forest text-mint">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-2">
          <div>
            <Logo light />
            <p className="mt-4 max-w-lg">
              SHARA — Structured Humanitarian Assistance and Response Alliance
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {import.meta.env.DEV && <DemoControl />}
              <Button
                to="/privacy"
                variant="ghost"
                className="text-mint hover:text-forest"
              >
                {tr("গোপনীয়তা নীতি")}</Button>
            </div>
          </div>
          <nav aria-label={tr("ফুটার মেনু")} className="grid sm:grid-cols-2">
            <NavItems items={publicNav} dark />
          </nav>
        </div>
      </footer>
    </div>
  )
}
export function DashLayout({ role }: { role: Role }) {
  const { tr } = useLanguage()
  useDemo()
  const { user, status, error, logout, activeOrganizationId, selectOrganization, refreshUser } = useAuth()
  const location = useLocation()
  const nav = useNavigate()
  if (status === "loading") return <div className="p-8"><Alert>{tr("অ্যাকাউন্ট যাচাই করা হচ্ছে…")}</Alert></div>
  if (status === "error")
    return (
      <div className="mx-auto max-w-2xl p-8">
        <Alert kind="error" title={tr("সার্ভারে সংযোগ করা যায়নি")}>{tr(error)}</Alert>
        <Button className="mt-4" onClick={() => refreshUser().catch(() => {})}>{tr("আবার চেষ্টা করুন")}</Button>
      </div>
    )
  if (!user)
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    )
  const allowed = role === "admin"
    ? user.is_super_admin
    : role === "org"
      ? user.organizations.length > 0
      : user.is_volunteer
  if (!allowed) return <Navigate to="/access-denied" replace />
  if (role === "org" && !user.organizations.some((organization) => organization.id === activeOrganizationId)) {
    const firstOrganizationId = user.organizations[0]?.id
    if (firstOrganizationId) selectOrganization(firstOrganizationId)
  }
  const displayRole = role === "admin" ? "সুপার অ্যাডমিন" : role === "org" ? "সংগঠনের প্রশাসক" : "স্বেচ্ছাসেবক"
  const pathname = location.pathname.replace(/\/+$/, "") || "/"
  const livePaths = [
    "/volunteer", "/volunteer/profile/edit", "/volunteer/organizations", "/volunteer/organization",
    "/volunteer/requests", "/volunteer/team", "/volunteer/missions",
    "/org", "/org/memberships", "/org/volunteers", "/org/profile", "/org/teams", "/org/missions",
    "/admin", "/admin/requests", "/admin/missions", "/admin/teams", "/admin/organizations",
  ]
  const isLivePage = livePaths.some((path) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)))
  const handleLogout = async () => {
    try {
      await logout()
      nav("/", { replace: true })
    } catch {
      // Keep the current page and session state visible when the server is unreachable.
    }
  }
  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[250px_1fr]">
      <ScrollTop />
      <aside className="border-b border-line bg-forest text-mint lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 lg:block lg:p-5">
          <Link to="/">
            <Logo light />
          </Link>
          <div className="lg:mt-4">
            <LanguageSwitcher />
          </div>
          <div className="lg:mt-5">
            <p className="text-sm">{tr(displayRole)}</p>
            <p className="font-semibold text-white">{user.name}</p>
          </div>
          {role === "org" && user.organizations.length > 1 && (
            <div className="mt-4">
              <Field label={tr("সংগঠন কর্মক্ষেত্র")} htmlFor="active-organization">
                <Select
                  id="active-organization"
                  value={String(activeOrganizationId ?? "")}
                  onChange={(event) => selectOrganization(Number(event.target.value))}
                >
                  {user.organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>{organization.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
        </div>
        <nav
          aria-label={tr("ড্যাশবোর্ড মেনু")}
          className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col"
        >
          <NavItems
            items={roleNav[role]}
            dark
          />
        </nav>
        <div className="flex flex-wrap gap-3 border-t border-white/20 p-4 lg:mt-6">
          {user.workspaces.length > 1 && (
            <Button to="/workspaces" variant="ghost" className="text-mint hover:text-forest">
              {tr("কর্মক্ষেত্র বদলান")}
            </Button>
          )}
          <Button to="/account/password" variant="ghost" className="text-mint hover:text-forest">
            {tr("পাসওয়ার্ড পরিবর্তন")}
          </Button>
          {import.meta.env.DEV && <DemoControl />}
          <Button
            to="/"
            variant="ghost"
            className="text-mint hover:text-forest"
          >
            {tr("পাবলিক হোম")}</Button>
          <Button
            variant="ghost"
            className="text-mint hover:text-forest"
            onClick={handleLogout}
          >
            {tr("লগআউট")}</Button>
        </div>
      </aside>
      <main id="main" className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
        {getStorageWarning() && (
          <Alert kind="warn">{tr(getStorageWarning())}</Alert>
        )}
        {!isLivePage && (
          <div className="mb-5">
            <Alert kind="warn" title={tr("নমুনা ডেটা")}>
              {tr("এই অনুরোধ, দল, কার্যক্রম ও সরবরাহকারী অংশগুলো এখনো স্থানীয় নমুনা ডেটা ব্যবহার করে। প্রোফাইল, সংগঠন নিবন্ধন, যাচাই ও সদস্যপদের তথ্য ডাটাবেস থেকে আসে।")}
            </Alert>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}
