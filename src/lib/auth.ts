// Client-side password authentication + encryption key holder
//
// Password is stored in TWO forms:
// 1. SHA-256 hash in localStorage (to detect "is password set" across browser sessions)
// 2. Plaintext in sessionStorage (to derive AES key during current tab session)
//
// sessionStorage is cleared when tab closes — password is only retained while user is active.
// localStorage hash cannot be reversed back into the password.

const PASSWORD_HASH_KEY = 'app_password_hash'
const AUTH_SESSION_KEY = 'app_auth_session'
const SESSION_PASSWORD_KEY = 'app_session_password'  // sessionStorage — plaintext for AES

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + '__translate_cards_salt__')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export function isPasswordSet(): boolean {
  return !!localStorage.getItem(PASSWORD_HASH_KEY)
}

export async function setPassword(password: string): Promise<void> {
  const hash = await hashPassword(password)
  localStorage.setItem(PASSWORD_HASH_KEY, hash)
  // Also store plaintext in sessionStorage for AES decryption
  sessionStorage.setItem(SESSION_PASSWORD_KEY, password)
}

/**
 * Verify password against stored hash.
 * Also tries to decrypt actual data via the provided verifier (if data is encrypted).
 * If verifier is provided and returns false, password is rejected even if hash matches.
 */
export async function verifyPassword(
  password: string,
  verifier?: (password: string) => Promise<boolean>
): Promise<boolean> {
  const storedHash = localStorage.getItem(PASSWORD_HASH_KEY)

  // If we have data verifier (data is encrypted), use it as primary check
  if (verifier) {
    const ok = await verifier(password)
    if (ok) {
      // Sync the hash so future isPasswordSet() works without fetching data
      if (!storedHash) {
        const hash = await hashPassword(password)
        localStorage.setItem(PASSWORD_HASH_KEY, hash)
      }
      sessionStorage.setItem(SESSION_PASSWORD_KEY, password)
      return true
    }
    return false
  }

  // No verifier — fall back to hash comparison (legacy flow, e.g. empty data)
  if (!storedHash) return false
  const hash = await hashPassword(password)
  if (hash === storedHash) {
    sessionStorage.setItem(SESSION_PASSWORD_KEY, password)
    return true
  }
  return false
}

/**
 * Get the plaintext password from sessionStorage (for AES encryption/decryption).
 * Returns null if user is not authenticated in this tab session.
 */
export function getSessionPassword(): string | null {
  return sessionStorage.getItem(SESSION_PASSWORD_KEY)
}

export function isAuthenticated(): boolean {
  const session = localStorage.getItem(AUTH_SESSION_KEY)
  if (!session) return false
  try {
    const data = JSON.parse(session)
    if (Date.now() - data.timestamp > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(AUTH_SESSION_KEY)
      return false
    }
    return data.authenticated === true
  } catch {
    return false
  }
}

export function setAuthenticated(): void {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
    authenticated: true,
    timestamp: Date.now(),
  }))
}

export function logout(): void {
  localStorage.removeItem(AUTH_SESSION_KEY)
  sessionStorage.removeItem(SESSION_PASSWORD_KEY)
}
