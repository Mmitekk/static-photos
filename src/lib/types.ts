export interface CardData {
  id: string
  originalText: string
  translatedText: string
  sourceLang: string
  targetLang: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface AppData {
  cards: CardData[]
  version: number
}

export function createCard(
  originalText: string,
  translatedText: string,
  sourceLang: string,
  targetLang: string,
  tags: string[] = []
): CardData {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    originalText,
    translatedText,
    sourceLang,
    targetLang,
    tags,
    createdAt: now,
    updatedAt: now,
  }
}

export function generateId(): string {
  return crypto.randomUUID()
}

// Collect all unique tags from a list of cards
export function collectAllTags(cards: CardData[]): string[] {
  const tagSet = new Set<string>()
  for (const card of cards) {
    for (const tag of card.tags) {
      tagSet.add(tag)
    }
  }
  return Array.from(tagSet).sort()
}
