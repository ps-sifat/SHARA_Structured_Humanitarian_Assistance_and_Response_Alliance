import english from "./en.json"

export type Language = "bn" | "en"
export const LANGUAGE_KEY = "shara-language"
const messages: Record<string, string> = english
const listeners = new Set<() => void>()

function readLanguage(): Language {
  try {
    return localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "bn"
  } catch {
    return "bn"
  }
}

let language = readLanguage()
export const getLanguage = () => language
export const subscribeLanguage = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function publish(next: Language) {
  language = next
  if (typeof document !== "undefined") document.documentElement.lang = next
  listeners.forEach((listener) => listener())
}

export function setLanguage(next: Language) {
  try {
    localStorage.setItem(LANGUAGE_KEY, next)
  } catch {
    // Switching still works for this session when browser storage is blocked.
  }
  publish(next)
}

if (typeof window !== "undefined") {
  document.documentElement.lang = language
  window.addEventListener("storage", (event) => {
    if (event.key === LANGUAGE_KEY || event.key === null) publish(readLanguage())
  })
}

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const phrases = new RegExp(
  `(?<![\\u0980-\\u09ff])(?:${Object.keys(messages).sort((a, b) => b.length - a.length).map(escapeRegExp).join("|")})(?![\\u0980-\\u09ff])`,
  "g",
)
const latinDigits = (value: string) =>
  value.replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit)))

// Translate presentation only: canonical option values and stored records stay unchanged.
export function translate<T>(value: T, target: Language): T {
  if (target === "bn" || typeof value !== "string" || !/[\u0980-\u09ff]/.test(value)) return value
  const normalized = value.replace(/\s+/g, " ").trim()
  const result = messages[normalized]
  if (result === undefined) {
    return latinDigits(value).replace(phrases, (match) => messages[match]) as T
  }
  return (
    (value.match(/^\s*/)?.[0] ?? "") +
    latinDigits(result) +
    (value.match(/\s*$/)?.[0] ?? "")
  ) as T
}

export function matchesSearch(value: string, query: string) {
  const needle = query.trim().toLocaleLowerCase()
  return value.toLocaleLowerCase().includes(needle) ||
    translate(value, "en").toLocaleLowerCase().includes(needle)
}
