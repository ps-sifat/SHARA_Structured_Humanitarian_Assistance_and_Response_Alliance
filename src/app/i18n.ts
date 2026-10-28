import { useSyncExternalStore } from "react"
import { getLanguage, setLanguage, subscribeLanguage, translate } from "./locale"

export function useLanguage() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, () => "bn" as const)
  return {
    language,
    setLanguage,
    tr: <T,>(value: T) => translate(value, language),
  }
}
