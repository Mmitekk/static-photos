// Client-side AES-GCM encryption with PBKDF2 key derivation
// Uses Web Crypto API (available in all modern browsers)
// Encrypted format: "ENC1:" + base64(salt[16] + iv[12] + ciphertext)

const ENC_PREFIX = 'ENC1:'
const SALT_LENGTH = 16  // bytes
const IV_LENGTH = 12    // bytes (96 bits, recommended for AES-GCM)
const PBKDF2_ITERATIONS = 150000  // OWASP 2023 recommendation for SHA-256
const KEY_LENGTH = 256   // bits (AES-256)

function toArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  // Copy salt into a fresh ArrayBuffer to satisfy strict TS typing (avoid SharedArrayBuffer mismatch)
  const saltBuffer = new ArrayBuffer(salt.byteLength)
  new Uint8Array(saltBuffer).set(salt)
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt plaintext string with password.
 * Returns "ENC1:<base64>" where base64 = salt(16) + iv(12) + ciphertext.
 */
export async function encryptData(plaintext: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await deriveKey(password, salt)
  const encoder = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  )
  // Combine salt + iv + ciphertext into one buffer
  const combined = new Uint8Array(SALT_LENGTH + IV_LENGTH + ciphertext.byteLength)
  combined.set(salt, 0)
  combined.set(iv, SALT_LENGTH)
  combined.set(new Uint8Array(ciphertext), SALT_LENGTH + IV_LENGTH)
  return ENC_PREFIX + toBase64(combined.buffer)
}

/**
 * Decrypt encrypted string with password.
 * If input is not encrypted (no ENC1: prefix), returns it as-is (backward compat).
 * Throws if password is wrong or data is corrupted.
 */
export async function decryptData(encrypted: string, password: string): Promise<string> {
  if (!isEncrypted(encrypted)) {
    // Plaintext — return as-is (legacy/migration mode)
    return encrypted
  }
  const base64 = encrypted.slice(ENC_PREFIX.length)
  const combined = new Uint8Array(toArrayBuffer(base64))
  const salt = combined.slice(0, SALT_LENGTH)
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH)
  const key = await deriveKey(password, salt)
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )
  const decoder = new TextDecoder()
  return decoder.decode(plaintextBuffer)
}

/**
 * Check if a string is encrypted (starts with ENC1: prefix).
 */
export function isEncrypted(s: string): boolean {
  return s.startsWith(ENC_PREFIX)
}
