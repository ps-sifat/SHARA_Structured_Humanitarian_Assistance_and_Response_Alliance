import { useState } from "react"
import { useNavigate, useSearchParams, Navigate } from "react-router"
import { useLanguage } from "./i18n"
import { useAuth, preferredWorkspacePath, safeReturnPath } from "./auth"
import { Alert, Button, Card, Field, Input, PageHead, Spinner } from "./ui"
import { api } from "./api"

export function LoginPage() {
  const { tr } = useLanguage()
  const { login, status, error: authError } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const nextPath = params.get("next")

  const submit = async (event) => {
    event.preventDefault()
    setError("")
    setBusy(true)
    try {
      const user = await login(identifier, password)
      navigate(safeReturnPath(nextPath, user), { replace: true })
    } catch (requestError) {
      setError(requestError.message || tr("লগইন করা যায়নি। তথ্য আবার দেখুন।"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <PageHead title={tr("লগইন")} sub={tr("আপনার নিবন্ধিত অ্যাকাউন্টে প্রবেশ করুন")} />
      {status === "error" && (
        <div className="mb-4">
          <Alert kind="warn" title={tr("সার্ভারের অবস্থা যাচাই করা যায়নি")}>{tr(authError)}</Alert>
        </div>
      )}
      {params.get("registered") === "1" && (
        <div className="mb-4"><Alert kind="success">{tr("অ্যাকাউন্ট তৈরি হয়েছে। এখন লগইন করুন।")}</Alert></div>
      )}
      <Card>
        <form className="space-y-5" onSubmit={submit}>
          {error && <Alert kind="error">{tr(error)}</Alert>}
          <Field label="ইমেইল অথবা মোবাইল নম্বর" required htmlFor="login-identifier">
            <Input
              id="login-identifier"
              autoComplete="username"
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          </Field>
          <Field label={tr("পাসওয়ার্ড")} required htmlFor="login-password">
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? tr("প্রবেশ করা হচ্ছে…") : tr("প্রবেশ করুন")}
          </Button>
          <div className="flex flex-wrap gap-3">
            <Button
              to={`/volunteer/register${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
              variant="ghost"
            >
              {tr("স্বেচ্ছাসেবক নিবন্ধন")}
            </Button>
            <Button to="/organization/register" variant="ghost">
              {tr("সংগঠন নিবন্ধন")}
            </Button>
          </div>
          <p className="text-sm text-ink-soft">
            {tr("পাসওয়ার্ড পুনরুদ্ধারের জন্য কোনো ইমেইল বা এসএমএস পাঠানো হয় না। সহায়তার জন্য প্ল্যাটফর্ম প্রশাসকের সঙ্গে যোগাযোগ করুন।")}
          </p>
        </form>
      </Card>
    </div>
  )
}

export function WorkspacePicker() {
  const { tr } = useLanguage()
  const { user, status, selectOrganization } = useAuth()
  const navigate = useNavigate()

  if (status === "loading") return <div className="mx-auto max-w-3xl px-4 py-12"><Spinner /></div>
  if (status === "error") return <div className="mx-auto max-w-3xl px-4 py-12"><Alert kind="error">{tr("অ্যাকাউন্ট লোড করা যায়নি। আবার চেষ্টা করুন।")}</Alert></div>
  if (!user) return <Navigate to="/login?next=%2Fworkspaces" replace />
  if (user.workspaces.length === 1) return <Navigate to={preferredWorkspacePath(user)} replace />
  if (!user.workspaces.length) return <Navigate to="/organization/status" replace />

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <PageHead title={tr("কর্মক্ষেত্র বেছে নিন")} sub={tr("আপনার অ্যাকাউন্টে অনুমোদিত পোর্টালগুলোর একটি নির্বাচন করুন")} />
      <div className="grid gap-4 sm:grid-cols-2">
        {user.workspaces.map((workspace) => (
          <Card key={`${workspace.type}-${workspace.organization_id ?? "main"}`}>
            <p className="font-display text-xl font-bold text-forest">{tr(workspace.label)}</p>
            <p className="mt-2 text-sm text-ink-soft">{tr(workspace.type === "organization_admin" ? "অনুমোদিত সংগঠন কর্মক্ষেত্র" : workspace.type === "super_admin" ? "সিস্টেম প্রশাসন" : "স্বেচ্ছাসেবক পোর্টাল")}</p>
            <Button
              className="mt-5 w-full"
              onClick={() => {
                if (workspace.organization_id) selectOrganization(workspace.organization_id)
                navigate(workspace.path, { replace: true })
              }}
            >
              {tr("এই কর্মক্ষেত্রে যান")}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function PasswordChangePage() {
  const { tr } = useLanguage()
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent("/account/password")}`} replace />

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
      await api("/api/auth/password/", {
        method: "POST",
        body: { current_password: currentPassword, new_password: newPassword },
      })
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
    <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
      <PageHead title={tr("পাসওয়ার্ড পরিবর্তন")} sub={tr("আপনার SHARA অ্যাকাউন্ট সুরক্ষিত রাখুন")} />
      <Card>
        <form className="space-y-5" onSubmit={submit}>
          {error && <Alert kind="error">{tr(error)}</Alert>}
          {saved && <Alert kind="success">{tr("পাসওয়ার্ড পরিবর্তন করা হয়েছে।")}</Alert>}
          <Field label={tr("বর্তমান পাসওয়ার্ড")} required htmlFor="current-password"><Input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></Field>
          <Field label={tr("নতুন পাসওয়ার্ড")} required htmlFor="new-password"><Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></Field>
          <Field label={tr("নতুন পাসওয়ার্ড নিশ্চিত করুন")} required htmlFor="confirm-new-password"><Input id="confirm-new-password" type="password" autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></Field>
          <div className="flex justify-end"><Button type="submit" disabled={busy}>{tr(busy ? "পরিবর্তন করা হচ্ছে…" : "পাসওয়ার্ড সংরক্ষণ")}</Button></div>
        </form>
      </Card>
    </div>
  )
}
