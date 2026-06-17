// Free translation APIs + DeepL support

const DEEPL_KEY_STORAGE = 'deepl_api_key'
const CHUNK_SIZE = 450

export function getDeepLKey(): string | null {
  return localStorage.getItem(DEEPL_KEY_STORAGE)
}

export function setDeepLKey(key: string): void {
  if (key.trim()) {
    localStorage.setItem(DEEPL_KEY_STORAGE, key.trim())
  } else {
    localStorage.removeItem(DEEPL_KEY_STORAGE)
  }
}

function splitTextIntoChunks(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= CHUNK_SIZE) {
      chunks.push(remaining)
      break
    }

    let splitPos = -1
    const searchRange = remaining.substring(0, CHUNK_SIZE)

    for (let i = searchRange.length - 1; i >= Math.max(0, CHUNK_SIZE - 200); i--) {
      const ch = searchRange[i]
      if (ch === '.' || ch === '!' || ch === '?' || ch === '。' || ch === '\n') {
        splitPos = i + 1
        break
      }
    }

    if (splitPos === -1) {
      for (let i = searchRange.length - 1; i >= Math.max(0, CHUNK_SIZE - 200); i--) {
        if (searchRange[i] === ' ') {
          splitPos = i + 1
          break
        }
      }
    }

    if (splitPos === -1 || splitPos === 0) {
      splitPos = CHUNK_SIZE
    }

    chunks.push(remaining.substring(0, splitPos))
    remaining = remaining.substring(splitPos)
  }

  return chunks
}

// DeepL API Free — best quality, 500K chars/month free
async function translateWithDeepL(text: string, source: string, target: string): Promise<string> {
  const apiKey = getDeepLKey()
  if (!apiKey) throw new Error('DeepL API ключ не задан')

  const sourceCode = source === 'ru' ? 'RU' : 'EN'
  const targetCode = target === 'ru' ? 'RU' : 'EN'

  const response = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [text],
      source_lang: sourceCode,
      target_lang: targetCode,
    }),
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(`DeepL: ${err.message || response.status}`)
  }

  const data = await response.json()
  if (data.translations?.[0]?.text) {
    return data.translations[0].text
  }
  throw new Error('DeepL: перевод не получен')
}

/**
 * Google Translate — direct API (client=gtx).
 * This is the same backend that Lingva used, but without the broken middleman.
 * Supports chunking for long texts.
 */
async function translateWithGoogle(text: string, source: string, target: string): Promise<string> {
  const sourceCode = source === 'ru' ? 'ru' : 'en'
  const targetCode = target === 'ru' ? 'ru' : 'en'

  const chunks = splitTextIntoChunks(text)
  const translatedChunks: string[] = []

  for (const chunk of chunks) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceCode}&tl=${targetCode}&dt=t&q=${encodeURIComponent(chunk)}`
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      throw new Error(`Google Translate: ${response.status}`)
    }

    const data = await response.json()
    
    // Response format: [[["translated text","original text",...],...], ...]
    if (data && data[0]) {
      const translated = data[0]
        .map((segment: unknown[]) => segment[0])
        .filter(Boolean)
        .join('')
      
      if (translated) {
        translatedChunks.push(translated)
        continue
      }
    }
    
    throw new Error('Google Translate: перевод не получен')
  }

  return translatedChunks.join(' ')
}

// LibreTranslate — with chunking
async function translateWithLibre(text: string, source: string, target: string): Promise<string> {
  const sourceCode = source === 'ru' ? 'ru' : 'en'
  const targetCode = target === 'ru' ? 'ru' : 'en'

  const instances = [
    'https://libretranslate.de',
    'https://translate.argosopentech.com',
    'https://translate.terraprint.co',
  ]

  const chunks = splitTextIntoChunks(text)
  const translatedChunks: string[] = []

  for (const chunk of chunks) {
    let chunkTranslated = false

    for (const instance of instances) {
      try {
        const response = await fetch(`${instance}/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: chunk,
            source: sourceCode,
            target: targetCode,
            format: 'text',
          }),
          signal: AbortSignal.timeout(15000),
        })
        if (response.ok) {
          const data = await response.json()
          if (data.translatedText) {
            translatedChunks.push(data.translatedText)
            chunkTranslated = true
            break
          }
        }
      } catch {
        continue
      }
    }

    if (!chunkTranslated) {
      throw new Error('Серверы LibreTranslate недоступны')
    }
  }

  return translatedChunks.join(' ')
}

// MyMemory — chunked for long texts
async function translateWithMyMemory(text: string, source: string, target: string): Promise<string> {
  const langPair = `${source === 'ru' ? 'ru' : 'en'}|${target === 'ru' ? 'ru' : 'en'}`
  const chunks = splitTextIntoChunks(text)
  const translatedChunks: string[] = []

  for (const chunk of chunks) {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${langPair}`,
      { signal: AbortSignal.timeout(15000) }
    )
    if (!response.ok) throw new Error('MyMemory API error')
    const data = await response.json()

    if (data.responseStatus === 403 || data.responseData?.translatedText?.includes('QUERY LENGTH LIMIT')) {
      throw new Error('MyMemory: лимит длины запроса')
    }

    // Check for daily quota limit
    if (data.responseData?.translatedText?.includes('MYMEMORY WARNING')) {
      throw new Error('MyMemory: дневной лимит исчерпан')
    }

    if (data.responseData?.translatedText) {
      let translated = data.responseData.translatedText
      if (translated === chunk.toUpperCase() && chunk !== chunk.toUpperCase()) {
        throw new Error('MyMemory: перевод недоступен')
      }
      translatedChunks.push(translated)
    } else {
      throw new Error('MyMemory: перевод не получен')
    }
  }

  return translatedChunks.join(' ')
}

export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  if (!text.trim()) throw new Error('Пустой текст')
  if (sourceLang === targetLang) return text

  // API chain: DeepL → Google Translate → LibreTranslate → MyMemory
  const apis: { name: string; fn: (text: string, source: string, target: string) => Promise<string> }[] = []

  if (getDeepLKey()) {
    apis.push({ name: 'DeepL', fn: translateWithDeepL })
  }

  // Google Translate direct — best free option (same as Lingva but without broken middleman)
  apis.push({ name: 'Google', fn: translateWithGoogle })
  apis.push({ name: 'LibreTranslate', fn: translateWithLibre })
  apis.push({ name: 'MyMemory', fn: translateWithMyMemory })

  const failedApis: string[] = []
  let lastError: Error | null = null

  for (const api of apis) {
    try {
      const result = await api.fn(text, sourceLang, targetLang)
      if (result && result.trim().length > 0) {
        return result
      }
      throw new Error('Пустой результат')
    } catch (e) {
      failedApis.push(api.name)
      lastError = e as Error
      continue
    }
  }

  const triedList = failedApis.join(' → ')
  throw new Error(`Не удалось перевести. Пробовали: ${triedList}. Ошибка: ${lastError?.message || 'неизвестна'}`)
}

/**
 * Detect language of text — returns 'ru' or 'en'.
 */
export function detectLanguage(text: string): 'ru' | 'en' {
  const sample = text.substring(0, 500)
  const cyrillicMatches = sample.match(/[а-яА-ЯёЁ]/g)
  const cyrillicCount = cyrillicMatches?.length || 0
  return cyrillicCount > 0 ? 'ru' : 'en'
}

export function getOppositeLang(lang: string): 'ru' | 'en' {
  return lang === 'ru' ? 'en' : 'ru'
}

export function getLangName(code: string): string {
  return code === 'ru' ? 'Русский' : 'English'
}

export function getLangFlag(code: string): string {
  return code === 'ru' ? '🇷🇺' : '🇬🇧'
}
