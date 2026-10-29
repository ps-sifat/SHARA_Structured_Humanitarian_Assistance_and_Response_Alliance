const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"])

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.payload = payload
  }
}

function csrfCookie() {
  const item = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("csrftoken="))
  return item ? decodeURIComponent(item.slice("csrftoken=".length)) : ""
}

function messageFromPayload(payload) {
  if (typeof payload?.detail === "string") return payload.detail
  if (typeof payload?.reason === "string") return payload.reason
  if (payload && typeof payload === "object") {
    const messages = Object.entries(payload)
      .flatMap(([field, value]) => {
        const entries = Array.isArray(value) ? value : [value]
        return entries.map((entry) => `${field}: ${String(entry)}`)
      })
    if (messages.length) return messages.join(" ")
  }
  return "The request could not be completed. Please try again."
}

export async function ensureCsrfCookie() {
  const response = await fetch("/api/auth/csrf/", { credentials: "include" })
  if (!response.ok) throw new ApiError("Could not prepare a secure request.", response.status)
  return response.json()
}

export async function api(path, options = {}) {
  const method = (options.method ?? "GET").toUpperCase()
  const headers = new Headers(options.headers ?? {})
  headers.set("Accept", "application/json")

  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }

  if (unsafeMethods.has(method)) {
    if (!csrfCookie()) await ensureCsrfCookie()
    headers.set("X-CSRFToken", csrfCookie())
  }

  const response = await fetch(path, {
    ...options,
    method,
    headers,
    credentials: "include",
    body:
      options.body === undefined || options.body instanceof FormData
        ? options.body
        : JSON.stringify(options.body),
  })

  if (response.status === 204) return null
  const contentType = response.headers.get("content-type") ?? ""
  const payload = contentType.includes("application/json") ? await response.json() : null
  if (!response.ok) throw new ApiError(messageFromPayload(payload), response.status, payload)
  return payload
}
