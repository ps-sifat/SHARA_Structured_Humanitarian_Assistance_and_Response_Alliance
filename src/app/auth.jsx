import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { api } from "./api"

const ACTIVE_ORGANIZATION_KEY = "shara.active-organization"
const AuthContext = createContext(null)

/**
 * @typedef {{id:number,name:string}} AuthorizedOrganization
 * @typedef {{id:number,name:string,phone_number:string,email:string|null,is_super_admin:boolean,is_volunteer:boolean,is_organization_admin:boolean,volunteer_profile_id:number|null,organizations:AuthorizedOrganization[],organization_applications:Array,workspaces:Array}} SessionUser
 * @typedef {{user:SessionUser|null,status:"loading"|"ready"|"error",error:string,activeOrganizationId:number|null,refreshUser:()=>Promise<SessionUser|null>,login:(identifier:string,password:string)=>Promise<SessionUser>,register:(form:Object)=>Promise<SessionUser>,logout:()=>Promise<void>,selectOrganization:(id:number)=>boolean,setUser:(user:SessionUser|null)=>void}} AuthValue
 */

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState("loading")
  const [error, setError] = useState("")
  const [activeOrganizationId, setActiveOrganizationId] = useState(null)

  const acceptUser = useCallback((nextUser) => {
    setUser(nextUser)
    const authorizedIds = nextUser?.organizations?.map((organization) => organization.id) ?? []
    let storedId = null
    try {
      storedId = Number(window.sessionStorage.getItem(ACTIVE_ORGANIZATION_KEY)) || null
    } catch {
      storedId = null
    }
    const nextOrganizationId = authorizedIds.includes(storedId) ? storedId : authorizedIds[0] ?? null
    setActiveOrganizationId(nextOrganizationId)
    try {
      if (nextOrganizationId) window.sessionStorage.setItem(ACTIVE_ORGANIZATION_KEY, String(nextOrganizationId))
      else window.sessionStorage.removeItem(ACTIVE_ORGANIZATION_KEY)
    } catch {
      // Workspace selection is a convenience; server permissions remain authoritative.
    }
    setError("")
    setStatus("ready")
    return nextUser
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const payload = await api("/api/auth/me/")
      return acceptUser(payload.user)
    } catch (requestError) {
      setUser(null)
      setActiveOrganizationId(null)
      setStatus("error")
      setError(requestError.message || "Could not load your account.")
      throw requestError
    }
  }, [acceptUser])

  useEffect(() => {
    refreshUser().catch(() => {})
  }, [refreshUser])

  const login = useCallback(async (identifier, password) => {
    const payload = await api("/api/auth/login/", {
      method: "POST",
      body: { identifier, password },
    })
    return acceptUser(payload.user)
  }, [acceptUser])

  const register = useCallback(async (form) => {
    const payload = await api("/api/auth/register/", { method: "POST", body: form })
    return acceptUser(payload.user)
  }, [acceptUser])

  const logout = useCallback(async () => {
    await api("/api/auth/logout/", { method: "POST", body: {} })
    acceptUser(null)
  }, [acceptUser])

  const selectOrganization = useCallback((id) => {
    const numericId = Number(id)
    if (!user?.organizations?.some((organization) => organization.id === numericId)) return false
    setActiveOrganizationId(numericId)
    try {
      window.sessionStorage.setItem(ACTIVE_ORGANIZATION_KEY, String(numericId))
    } catch {
      // Workspace selection is revalidated against the current session on load.
    }
    return true
  }, [user])

  const value = useMemo(() => ({
    user,
    status,
    error,
    activeOrganizationId,
    refreshUser,
    login,
    register,
    logout,
    selectOrganization,
    setUser: acceptUser,
  }), [user, status, error, activeOrganizationId, refreshUser, login, register, logout, selectOrganization, acceptUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** @returns {AuthValue} */
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth must be used within AuthProvider")
  return value
}

export function preferredWorkspacePath(user) {
  if (!user) return "/login"
  if (user.workspaces?.length > 1) return "/workspaces"
  if (user.workspaces?.length === 1) return user.workspaces[0].path
  if (user.organization_applications?.length) return "/organization/status"
  return "/login"
}

export function canAccessPath(user, path) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return false
  const pathname = path.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/"
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return Boolean(user?.is_super_admin)
  if (pathname === "/org" || pathname.startsWith("/org/")) return Boolean(user?.organizations?.length)
  if (pathname === "/volunteer" || pathname.startsWith("/volunteer/")) return Boolean(user?.is_volunteer)
  if (pathname === "/workspaces") return Boolean(user?.workspaces?.length)
  if (pathname === "/organization/status") return Boolean(user?.organization_applications?.length)
  return true
}

export function safeReturnPath(candidate, user) {
  if (typeof candidate !== "string" || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return preferredWorkspacePath(user)
  }
  return canAccessPath(user, candidate) ? candidate : preferredWorkspacePath(user)
}
