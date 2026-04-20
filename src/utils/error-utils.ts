const SAFE_ERROR_PATTERNS = [
  /^Feed tidak dapat dimuat/i,
  /^Format feed tidak valid/i,
  /^Permintaan data gagal/i,
  /^Penyimpanan Supabase dinonaktifkan/i,
  /^VITE_/i,
]

function isSafeUserMessage(message: string) {
  if (!message || message.length > 180 || /[\r\n]/.test(message)) {
    return false
  }

  return SAFE_ERROR_PATTERNS.some((pattern) => pattern.test(message))
}

export function getUserFacingErrorMessage(
  error: unknown,
  fallback: string,
  context: string
) {
  console.error(`[${context}]`, error)

  if (typeof error === "string") {
    return isSafeUserMessage(error) ? error : fallback
  }

  if (error instanceof Error) {
    const message = error.message.trim()
    return isSafeUserMessage(message) ? message : fallback
  }

  return fallback
}
