import { useState, useEffect, useCallback, useRef } from 'react'
import { type CardData, type AppData, createCard } from '@/lib/types'
import * as githubStorage from '@/lib/github-storage'
import * as auth from '@/lib/auth'

export type DeleteOlderPeriod = 'day' | 'week' | 'month'

/**
 * Format current time as DD.MM.YYYY HH:MM for use in commit messages.
 * Returns Moscow time (UTC+3) — matches user's locale.
 * Date is intentionally granular to the minute (not second) to avoid
 * any chance of it being a fingerprint of a specific card content.
 */
function nowFmt(): string {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface UseCardsReturn {
  cards: CardData[]
  isLoading: boolean
  isSaving: boolean
  error: string | null
  addCard: (originalText: string, translatedText: string, sourceLang: string, targetLang: string, tags?: string[]) => Promise<void>
  updateCard: (id: string, updates: Partial<Pick<CardData, 'originalText' | 'translatedText' | 'sourceLang' | 'targetLang' | 'tags'>>) => Promise<void>
  deleteCard: (id: string) => Promise<void>
  deleteAll: () => Promise<void>
  deleteOlderThan: (period: DeleteOlderPeriod) => Promise<number>
  duplicateCard: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

// Save queue — ensures only one write to GitHub at a time
class SaveQueue {
  private queue: Array<{ task: () => Promise<void>; resolve: () => void; reject: (e: unknown) => void }> = []
  private running = false

  enqueue(task: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject })
      this.process()
    })
  }

  private async process() {
    if (this.running) return
    this.running = true

    while (this.queue.length > 0) {
      const item = this.queue.shift()!
      try {
        await item.task()
        item.resolve()
      } catch (e) {
        item.reject(e)
      }
    }

    this.running = false
  }
}

const saveQueue = new SaveQueue()

function getCutoffDate(period: DeleteOlderPeriod): Date {
  const now = new Date()
  switch (period) {
    case 'day':
      now.setDate(now.getDate() - 1)
      break
    case 'week':
      now.setDate(now.getDate() - 7)
      break
    case 'month':
      now.setMonth(now.getMonth() - 1)
      break
  }
  return now
}

export function useCards(): UseCardsReturn {
  const [cards, setCards] = useState<CardData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cardsRef = useRef<CardData[]>([])

  const loadCards = useCallback(async () => {
    if (!githubStorage.isConfigured()) {
      setCards([])
      cardsRef.current = []
      setIsLoading(false)
      return
    }
    const password = auth.getSessionPassword()
    if (!password) {
      setError('Не удалось получить пароль сессии. Перезайдите в систему.')
      setIsLoading(false)
      return
    }
    try {
      setIsLoading(true)
      setError(null)
      const data = await githubStorage.loadData<AppData>(password)
      const loaded = (data?.cards || []).map(c => ({
        ...c,
        tags: c.tags || [],
      }))
      setCards(loaded)
      cardsRef.current = loaded
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCards()
  }, [loadCards])

  const saveCards = useCallback(async (updatedCards: CardData[], message: string) => {
    setIsSaving(true)
    try {
      const password = auth.getSessionPassword()
      if (!password) {
        throw new Error('Не удалось получить пароль сессии. Перезайдите в систему.')
      }
      const data: AppData = { cards: updatedCards, version: 1 }
      await saveQueue.enqueue(async () => {
        await githubStorage.saveData(data, password, message)
      })
      setCards(updatedCards)
      cardsRef.current = updatedCards
      try {
        const verified = await githubStorage.loadData<AppData>(password)
        if (verified?.cards) {
          const withTags = verified.cards.map(c => ({ ...c, tags: c.tags || [] }))
          setCards(withTags)
          cardsRef.current = withTags
        }
      } catch {
        // Verification failed but save succeeded
      }
    } finally {
      setIsSaving(false)
    }
  }, [])

  const addCard = useCallback(async (
    originalText: string,
    translatedText: string,
    sourceLang: string,
    targetLang: string,
    tags: string[] = []
  ): Promise<void> => {
    const card = createCard(originalText, translatedText, sourceLang, targetLang, tags)
    const updated = [card, ...cardsRef.current]
    await saveCards(updated, `Добавлена карточка ${nowFmt()}`)
  }, [saveCards])

  const updateCard = useCallback(async (
    id: string,
    updates: Partial<Pick<CardData, 'originalText' | 'translatedText' | 'sourceLang' | 'targetLang' | 'tags'>>
  ) => {
    const updated = cardsRef.current.map(c =>
      c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
    )
    await saveCards(updated, `Обновлена карточка ${nowFmt()}`)
  }, [saveCards])

  const deleteCard = useCallback(async (id: string) => {
    const updated = cardsRef.current.filter(c => c.id !== id)
    await saveCards(updated, `Удалена карточка ${nowFmt()}`)
  }, [saveCards])

  const deleteAll = useCallback(async () => {
    await saveCards([], `Удалены все карточки ${nowFmt()}`)
  }, [saveCards])

  const deleteOlderThan = useCallback(async (period: DeleteOlderPeriod): Promise<number> => {
    const cutoff = getCutoffDate(period)
    const before = cardsRef.current.length
    const updated = cardsRef.current.filter(c => new Date(c.createdAt) >= cutoff)
    const deleted = before - updated.length
    if (deleted > 0) {
      const periodLabel = period === 'day' ? '1 день' : period === 'week' ? '1 неделю' : '1 месяц'
      await saveCards(updated, `Удалены карточки старше ${periodLabel} ${nowFmt()} (${deleted} шт.)`)
    }
    return deleted
  }, [saveCards])

  const duplicateCard = useCallback(async (id: string) => {
    const card = cardsRef.current.find(c => c.id === id)
    if (!card) return
    const newCard = createCard(card.originalText, card.translatedText, card.sourceLang, card.targetLang, card.tags)
    const idx = cardsRef.current.findIndex(c => c.id === id)
    const updated = [...cardsRef.current]
    updated.splice(idx + 1, 0, newCard)
    await saveCards(updated, `Дублирована карточка ${nowFmt()}`)
  }, [saveCards])

  return {
    cards,
    isLoading,
    isSaving,
    error,
    addCard,
    updateCard,
    deleteCard,
    deleteAll,
    deleteOlderThan,
    duplicateCard,
    refresh: loadCards,
  }
}
