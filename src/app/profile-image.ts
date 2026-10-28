export const MAX_PROFILE_IMAGE_LENGTH = 180_000
const MAX_FILE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export function isProfileImage(value: unknown): boolean {
  return value === undefined || value === "" ||
    (typeof value === "string" &&
      value.length <= MAX_PROFILE_IMAGE_LENGTH &&
      /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))
}

export async function prepareProfileImage(file: File): Promise<string> {
  if (!IMAGE_TYPES.has(file.type)) {
    throw new Error("JPG, PNG অথবা WebP ছবি বেছে নিন।")
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("ছবির আকার ৫ মেগাবাইটের মধ্যে হতে হবে।")
  }

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error("ছবিটি পড়া যায়নি। অন্য একটি ছবি বেছে নিন।"))
      image.src = url
    })
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("ছবিটি পড়া যায়নি। অন্য একটি ছবি বেছে নিন।")
    }
    const canvas = document.createElement("canvas")
    for (const size of [384, 288, 216, 162, 121, 96]) {
      const ratio = Math.min(1, size / Math.max(image.naturalWidth, image.naturalHeight))
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))
      const context = canvas.getContext("2d")
      if (!context) throw new Error("ছবিটি প্রস্তুত করা যায়নি। আবার চেষ্টা করুন।")
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const result = canvas.toDataURL("image/webp", 0.82)
      if (isProfileImage(result)) return result
    }
    throw new Error("ছবির আকার কমিয়ে আবার চেষ্টা করুন।")
  } finally {
    URL.revokeObjectURL(url)
  }
}
