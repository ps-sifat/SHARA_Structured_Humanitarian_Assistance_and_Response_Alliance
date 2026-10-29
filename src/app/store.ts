import { useSyncExternalStore } from "react"
import { seed, transition, VERSION, type Action, type DemoState } from "./model"

export const STORAGE_KEY = "shara-demo-v1"
let storageWarning = ""
function readState(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (
        parsed.version === VERSION &&
        [
          "accounts",
          "requests",
          "missions",
          "teams",
          "organizations",
          "memberships",
          "volunteers",
          "suppliers",
        ].every((key) => Array.isArray(parsed[key]))
      ) {
        // The legacy demo store may contain a mock account selection. Never persist or
        // restore it as an application session; Django owns real authentication.
        parsed.sessionId = null
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
        return parsed
      }
      storageWarning = "সংরক্ষিত তথ্যের সংস্করণ বদলেছে; প্রাথমিক তথ্য ব্যবহার হচ্ছে।"
    }
  } catch {
    storageWarning =
      "সংরক্ষিত তথ্য পড়া যায়নি; এই সেশনে প্রাথমিক তথ্য ব্যবহার হচ্ছে।"
  }
  return seed()
}
let state = readState()
const listeners = new Set<() => void>()
const publish = (next: DemoState) => {
  state = { ...next, sessionId: null }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    storageWarning =
      "ব্রাউজারে তথ্য সংরক্ষণ করা যায়নি। রিফ্রেশে এই সেশনের পরিবর্তন হারাতে পারে।"
  }
  listeners.forEach((fn) => fn())
}
export const uid = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().slice(0, 8)}`
export function act(action: Action): {
  ok: boolean
  error: string
} {
  try {
    publish(transition(state, action))
    return { ok: true, error: "" }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "আবার চেষ্টা করুন।",
    }
  }
}
export const resetDemo = () => {
  storageWarning = ""
  publish(seed())
}
export const getState = () => state
export const getStorageWarning = () => storageWarning
export const useDemo = () =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    () => state,
  )
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY) {
    state = readState()
    listeners.forEach((fn) => fn())
  }
})
