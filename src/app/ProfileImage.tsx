import { useEffect, useId, useRef, useState } from "react"
import { Building2, Camera, Loader2, Trash2, UserRound } from "lucide-react"
import { useLanguage } from "./i18n"
import { Alert, Button, Input } from "./ui"
import { isProfileImage, prepareProfileImage } from "./profile-image"

type ImageProps = {
  value?: string
  name: string
  organization?: boolean
  size?: "sm" | "md" | "lg"
}

export function ProfileImage({
  value,
  name,
  organization = false,
  size = "md",
}: ImageProps) {
  const { tr } = useLanguage()
  const [failed, setFailed] = useState<string>()
  const hasImage = !!value && value !== failed && isProfileImage(value)
  const initials = Array.from(name.trim()).slice(0, 2).join("")
  const dimensions = { sm: "size-14 text-lg", md: "size-20 text-2xl", lg: "size-24 text-3xl" }
  return (
    <span
      role="img"
      aria-label={`${name ? `${name} — ` : ""}${tr(organization ? "সংগঠনের ছবি" : "প্রোফাইল ছবি")}`}
      className={`inline-grid shrink-0 place-items-center overflow-hidden border border-line ${
        organization ? "rounded-2xl bg-white text-leaf" : "rounded-full bg-forest text-white"
      } ${dimensions[size]} font-semibold`}
    >
      {hasImage ? (
        <img
          src={value}
          alt=""
          className={`size-full ${organization ? "object-contain p-1" : "object-cover"}`}
          onError={() => setFailed(value)}
        />
      ) : organization ? (
        <Building2 size={size === "sm" ? 24 : 32} aria-hidden="true" />
      ) : initials ? (
        <span aria-hidden="true">{initials}</span>
      ) : (
        <UserRound size={32} aria-hidden="true" />
      )}
    </span>
  )
}

export function ProfileImageEditor({
  value,
  name,
  organization = false,
  onChange,
  onProcessingChange,
}: ImageProps & {
  onChange: (value: string) => void
  onProcessingChange: (processing: boolean) => void
}) {
  const { tr } = useLanguage()
  const id = useId()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const request = useRef(0)
  useEffect(() => () => {
    request.current++
    onProcessingChange(false)
  }, [onProcessingChange])

  return (
    <div className="rounded-xl border border-line bg-paper p-4" aria-busy={processing}>
      <div className="flex flex-wrap items-center gap-4">
        <ProfileImage value={value} name={name} organization={organization} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">
            {tr(organization ? "সংগঠনের ছবি" : "প্রোফাইল ছবি")}
          </p>
          <p id={`${id}-hint`} className="mt-1 text-sm text-ink-soft">
            {tr("JPG, PNG অথবা WebP · সর্বোচ্চ ৫ মেগাবাইট")}
          </p>
          <Input
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="!hidden"
            aria-label={tr(organization ? "সংগঠনের ছবি বেছে নিন" : "প্রোফাইল ছবি বেছে নিন")}
            disabled={processing}
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ""
              if (!file) return
              const current = ++request.current
              setError("")
              setProcessing(true)
              onProcessingChange(true)
              try {
                const result = await prepareProfileImage(file)
                if (current === request.current) onChange(result)
              } catch (cause) {
                if (current === request.current) {
                  setError(cause instanceof Error ? cause.message : "ছবিটি প্রস্তুত করা যায়নি। আবার চেষ্টা করুন।")
                }
              } finally {
                if (current === request.current) {
                  setProcessing(false)
                  onProcessingChange(false)
                }
              }
            }}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              id={`${id}-choose`}
              variant="secondary"
              disabled={processing}
              aria-describedby={`${id}-hint`}
              onClick={() => document.getElementById(id)?.click()}
            >
              {processing ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              {tr(processing ? "ছবি প্রস্তুত হচ্ছে..." : value ? "ছবি পরিবর্তন করুন" : "ছবি যুক্ত করুন")}
            </Button>
            {value && (
              <Button
                variant="ghost"
                className="!text-alert"
                disabled={processing}
                onClick={() => {
                  setError("")
                  onChange("")
                  document.getElementById(`${id}-choose`)?.focus()
                }}
              >
                <Trash2 size={16} />
                {tr("ছবি সরান")}
              </Button>
            )}
          </div>
        </div>
      </div>
      {error && <div className="mt-3"><Alert kind="error">{tr(error)}</Alert></div>}
    </div>
  )
}
