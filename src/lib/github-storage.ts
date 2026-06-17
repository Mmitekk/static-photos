import { encryptData, decryptData, isEncrypted } from '@/lib/crypto'

const GITHUB_API = 'https://api.github.com'

export interface GitHubConfig {
  token: string
  owner: string
  repo: string
  branch: string
}

function getConfig(): GitHubConfig {
  const config = localStorage.getItem('github_config')
  if (!config) throw new Error('GitHub config not set')
  return JSON.parse(config)
}

export function setConfig(config: GitHubConfig): void {
  localStorage.setItem('github_config', JSON.stringify(config))
  lastWriteSha = null
}

export function getConfigOrNull(): GitHubConfig | null {
  const config = localStorage.getItem('github_config')
  return config ? JSON.parse(config) : null
}

export function isConfigured(): boolean {
  return !!getConfigOrNull()
}

const DATA_FILE_PATH = 'data/cards.json'

async function githubRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const config = getConfig()
  const url = `${GITHUB_API}${path}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  }

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || `GitHub API error: ${response.status}`)
  }

  return response
}

export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const config = getConfig()
    const response = await fetch(`${GITHUB_API}/repos/${config.owner}/${config.repo}`, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      return { success: false, error: error.message || `Ошибка: ${response.status}` }
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

function encodeBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
}

function decodeBase64(base64: string): string {
  return decodeURIComponent(escape(atob(base64.replace(/\n/g, ''))))
}

/**
 * Get the correct SHA for the data file using the Git Data API.
 */
async function getFileShaViaGitApi(): Promise<string | null> {
  try {
    const config = getConfig()

    const refResponse = await githubRequest(
      `/repos/${config.owner}/${config.repo}/git/refs/heads/${config.branch}`
    )
    const ref = await refResponse.json()
    const commitSha = ref.object.sha

    const commitResponse = await githubRequest(
      `/repos/${config.owner}/${config.repo}/git/commits/${commitSha}`
    )
    const commit = await commitResponse.json()
    const treeSha = commit.tree.sha

    const treeResponse = await githubRequest(
      `/repos/${config.owner}/${config.repo}/git/trees/${treeSha}?recursive=1`
    )
    const tree = await treeResponse.json()

    const fileEntry = tree.tree.find(
      (item: { path: string; sha: string; type: string }) => item.path === DATA_FILE_PATH && item.type === 'blob'
    )

    return fileEntry?.sha || null
  } catch {
    return null
  }
}

async function getFileShaFromContents(): Promise<string | null> {
  try {
    const config = getConfig()
    const url = `/repos/${config.owner}/${config.repo}/contents/${DATA_FILE_PATH}?ref=${config.branch}&_t=${Date.now()}`
    const response = await githubRequest(url)
    const data = await response.json()
    return data.sha
  } catch {
    return null
  }
}

let lastWriteSha: string | null = null

/**
 * Check if the data file exists in the repo (without loading content).
 * Used by login flow to determine "first time setup" vs "enter password".
 */
export async function dataFileExists(): Promise<boolean> {
  try {
    const config = getConfig()
    const url = `/repos/${config.owner}/${config.repo}/contents/${DATA_FILE_PATH}?ref=${config.branch}&_t=${Date.now()}`
    const response = await githubRequest(url)
    return response.ok
  } catch {
    return false
  }
}

/**
 * Load raw encrypted content from GitHub (base64-decoded into string).
 * Does NOT decrypt — caller must handle that.
 */
async function loadRawContent(): Promise<string | null> {
  try {
    const config = getConfig()
    const url = `/repos/${config.owner}/${config.repo}/contents/${DATA_FILE_PATH}?ref=${config.branch}&_t=${Date.now()}`
    const response = await githubRequest(url)
    const data = await response.json()
    return decodeBase64(data.content)
  } catch {
    return null
  }
}

/**
 * Verify that a password can decrypt the existing data.
 * Used by login flow.
 * Returns true if:
 *   - data doesn't exist (first time — any password is valid)
 *   - data is plaintext (migration mode — any password is valid, will be encrypted on next save)
 *   - data is encrypted and password decrypts it successfully
 * Returns false if:
 *   - data is encrypted and password fails to decrypt
 */
export async function verifyPasswordAgainstData(password: string): Promise<boolean> {
  const raw = await loadRawContent()
  if (raw === null) return true  // no data file — first time setup
  if (!isEncrypted(raw)) return true  // plaintext — accept any password (migration)
  try {
    await decryptData(raw, password)
    return true
  } catch {
    return false
  }
}

/**
 * Load and decrypt data.
 * If data is plaintext (legacy), returns it as-is without decryption.
 * If data is encrypted, decrypts with provided password.
 * Throws if password is wrong.
 */
export async function loadData<T>(password: string): Promise<T | null> {
  const raw = await loadRawContent()
  if (raw === null) return null
  const decrypted = await decryptData(raw, password)
  return JSON.parse(decrypted) as T
}

/**
 * Encrypt and save data.
 */
export async function saveData<T>(
  data: T,
  password: string,
  message: string = 'Update cards data'
): Promise<void> {
  const MAX_RETRIES = 3
  const plaintext = JSON.stringify(data, null, 2)
  // Always encrypt on save (even if it was plaintext before — migration)
  const encryptedContent = await encryptData(plaintext, password)

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const config = getConfig()
    const body: Record<string, unknown> = {
      message,
      content: encodeBase64(encryptedContent),
      branch: config.branch,
    }

    let sha: string | null = null

    if (lastWriteSha) {
      sha = lastWriteSha
    } else {
      sha = await getFileShaViaGitApi()
      if (!sha) {
        sha = await getFileShaFromContents()
      }
    }

    if (sha) {
      body.sha = sha
    }

    try {
      const response = await githubRequest(
        `/repos/${config.owner}/${config.repo}/contents/${DATA_FILE_PATH}`,
        {
          method: 'PUT',
          body: JSON.stringify(body),
        }
      )
      const result = await response.json()
      if (result.content?.sha) {
        lastWriteSha = result.content.sha
      }
      return
    } catch (e) {
      const errorMsg = (e as Error).message

      if (errorMsg.includes('does not match') || errorMsg.includes('conflict')) {
        lastWriteSha = null

        if (attempt < MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
          continue
        }
      }

      throw e
    }
  }

  throw new Error('Не удалось сохранить данные после нескольких попыток. Попробуйте ещё раз.')
}

// Crypto helpers re-exported for callers that need them
export { encryptData, decryptData, isEncrypted } from '@/lib/crypto'
