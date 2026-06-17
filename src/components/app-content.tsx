import { useState, useRef, useEffect } from 'react'
import { type CardData, collectAllTags } from '@/lib/types'
import { useCards, type DeleteOlderPeriod } from '@/hooks/use-cards'
import { useAuth } from '@/hooks/use-auth'
import { useTheme } from '@/hooks/use-theme'
import { translateText } from '@/lib/translate'
import * as githubStorage from '@/lib/github-storage'
import { KanbanBoard } from './kanban-board'
import { CardEditDialog } from './card-edit-dialog'
import { CardViewDialog } from './card-view-dialog'
import { SettingsPage } from './settings-page'
import { Toaster, showToast } from './toaster'
import {
  Plus,
  Sun,
  Moon,
  LogOut,
  Settings,
  RefreshCw,
  Cloud,
  CloudOff,
  Search,
  X,
  Trash2,
  ChevronDown,
  Calendar,
  CalendarDays,
  CalendarRange,
  Tag,
  Filter,
} from 'lucide-react'

function DeleteMenu({
  cardsCount,
  onDeleteAll,
  onDeleteOlder,
  isSaving,
}: {
  cardsCount: number
  onDeleteAll: () => void
  onDeleteOlder: (period: DeleteOlderPeriod) => void
  isSaving: boolean
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  if (cardsCount === 0) return null

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        disabled={isSaving}
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
        title="Удалить карточки"
      >
        <Trash2 className="w-4 h-4" />
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 border border-[var(--border)] rounded-lg shadow-lg z-50 py-1">
          <div className="px-3 py-1.5 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            Удалить старше:
          </div>
          <button
            onClick={() => { onDeleteOlder('day'); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Calendar className="w-4 h-4 text-orange-500" />
            <span>Старше 1 дня</span>
          </button>
          <button
            onClick={() => { onDeleteOlder('week'); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <CalendarDays className="w-4 h-4 text-orange-500" />
            <span>Старше 1 недели</span>
          </button>
          <button
            onClick={() => { onDeleteOlder('month'); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <CalendarRange className="w-4 h-4 text-orange-500" />
            <span>Старше 1 месяца</span>
          </button>
          <div className="my-1 border-t border-[var(--border)]" />
          <button
            onClick={() => { onDeleteAll(); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Удалить ВСЕ</span>
          </button>
        </div>
      )}
    </div>
  )
}

export function AppContent() {
  const { logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { cards, isLoading, isSaving, error, addCard, updateCard, deleteCard, deleteAll, deleteOlderThan, duplicateCard, refresh } = useCards()

  const [editDialog, setEditDialog] = useState<{
    card: CardData | null | undefined
    open: boolean
  }>({ card: null, open: false })

  const [viewDialog, setViewDialog] = useState<{
    card: CardData | null
    open: boolean
  }>({ card: null, open: false })

  const [settingsOpen, setSettingsOpen] = useState(!githubStorage.isConfigured())
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showAllTags, setShowAllTags] = useState(false)

  const isConfigured = githubStorage.isConfigured()
  const allTags = collectAllTags(cards)
  const VISIBLE_TAGS = 20
  const visibleTags = showAllTags ? allTags : allTags.slice(0, VISIBLE_TAGS)
  const hasMoreTags = allTags.length > VISIBLE_TAGS

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const clearTagFilter = () => setSelectedTags([])

  const handleSaveCard = async (data: {
    originalText: string
    translatedText: string
    sourceLang: string
    targetLang: string
    tags: string[]
  }) => {
    try {
      if (editDialog.card) {
        await updateCard(editDialog.card.id, data)
        showToast('Карточка обновлена!', 'success')
      } else {
        await addCard(data.originalText, data.translatedText, data.sourceLang, data.targetLang, data.tags)
        showToast('Карточка создана!', 'success')
      }
      setEditDialog({ card: null, open: false })
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const handleDeleteCard = async (id: string) => {
    try {
      await deleteCard(id)
      showToast('Карточка удалена', 'info')
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm(`Удалить ВСЕ карточки (${cards.length} шт.)? Это действие нельзя отменить!`)) return
    try {
      await deleteAll()
      showToast('Все карточки удалены', 'info')
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const handleDeleteOlder = async (period: DeleteOlderPeriod) => {
    const periodLabel = period === 'day' ? '1 день' : period === 'week' ? '1 неделю' : '1 месяц'
    if (!confirm(`Удалить карточки старше ${periodLabel}?`)) return
    try {
      const count = await deleteOlderThan(period)
      if (count === 0) {
        showToast('Нет карточек для удаления', 'info')
      } else {
        showToast(`Удалено ${count} карточек`, 'info')
      }
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const handleDuplicateCard = async (id: string) => {
    try {
      await duplicateCard(id)
      showToast('Карточка дублирована!', 'success')
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const handleTranslateInView = async (card: CardData) => {
    try {
      const translated = await translateText(card.originalText, card.sourceLang, card.targetLang)
      await updateCard(card.id, { translatedText: translated })
      setViewDialog({ card: { ...card, translatedText: translated }, open: true })
      showToast('Перевод обновлён!', 'success')
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const handleRefresh = async () => {
    try {
      await refresh()
      showToast('Данные обновлены!', 'success')
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  // Filter cards by search (includes tags) and selected tags
  const filteredCards = cards
    .filter(c => {
      // Tag filter
      if (selectedTags.length > 0) {
        return selectedTags.every(tag => c.tags.includes(tag))
      }
      return true
    })
    .filter(c => {
      // Text search
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        c.originalText.toLowerCase().includes(q) ||
        c.translatedText.toLowerCase().includes(q) ||
        c.tags.some(t => t.toLowerCase().includes(q))
      )
    })

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[var(--background)]/80 backdrop-blur-sm border-b border-[var(--border)]">
        <div className="px-4 sm:px-6 py-3 flex items-center gap-3">
          <h1 className="text-lg font-bold text-purple-600 dark:text-purple-400 whitespace-nowrap">
            📝 Перевод-Карточки
          </h1>

          {/* Search */}
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-white dark:bg-gray-800 text-[var(--foreground)] focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              placeholder="Поиск..."
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Connection status */}
            {isConfigured ? (
              <Cloud className="w-4 h-4 text-green-500" />
            ) : (
              <CloudOff className="w-4 h-4 text-red-500" />
            )}

            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors disabled:opacity-50"
              title="Обновить"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {/* Delete menu */}
            <DeleteMenu
              cardsCount={cards.length}
              onDeleteAll={handleDeleteAll}
              onDeleteOlder={handleDeleteOlder}
              isSaving={isSaving}
            />

            <button
              onClick={() => setEditDialog({ card: null, open: true })}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{isSaving ? 'Сохранение...' : 'Новая карточка'}</span>
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
              title="Сменить тему"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
              title="Настройки"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
              title="Выйти"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div className="sticky top-[57px] z-20 bg-[var(--background)]/80 backdrop-blur-sm border-b border-[var(--border)] px-4 sm:px-6 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-[var(--muted-foreground)] flex-shrink-0" />
            {visibleTags.map(tag => {
              const isActive = selectedTags.includes(tag)
              const count = cards.filter(c => c.tags.includes(tag)).length
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-[var(--muted-foreground)] hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-700 dark:hover:text-purple-300'
                  }`}
                >
                  {tag}
                  <span className={`text-[10px] ${isActive ? 'text-purple-200' : 'text-gray-400'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
            {hasMoreTags && !showAllTags && (
              <button
                onClick={() => setShowAllTags(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-[var(--muted-foreground)] hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
              >
                Ещё {allTags.length - VISIBLE_TAGS}...
              </button>
            )}
            {showAllTags && hasMoreTags && (
              <button
                onClick={() => setShowAllTags(false)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-[var(--muted-foreground)] hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
              >
                Свернуть
              </button>
            )}
            {selectedTags.length > 0 && (
              <button
                onClick={clearTagFilter}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <X className="w-3 h-3" />
                Сбросить
              </button>
            )}
            {selectedTags.length > 0 && (
              <span className="text-xs text-[var(--muted-foreground)]">
                Найдено: {filteredCards.length} из {cards.length}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="px-4 sm:px-6 py-6">
        {!isConfigured && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              ⚠️ GitHub не настроен. Данные не будут сохраняться. Откройте <button onClick={() => setSettingsOpen(true)} className="underline font-medium">настройки</button> для подключения.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">Ошибка: {error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : (
          <KanbanBoard
            cards={filteredCards}
            isSaving={isSaving}
            onEdit={card => setEditDialog({ card, open: true })}
            onDelete={handleDeleteCard}
            onDuplicate={handleDuplicateCard}
            onView={card => setViewDialog({ card, open: true })}
            onTagClick={toggleTag}
            selectedTags={selectedTags}
          />
        )}
      </main>

      {/* Dialogs */}
      {editDialog.open && (
        <CardEditDialog
          card={editDialog.card}
          allCards={cards}
          onClose={() => setEditDialog({ card: null, open: false })}
          onSave={handleSaveCard}
          isSaving={isSaving}
        />
      )}

      {viewDialog.open && viewDialog.card && (
        <CardViewDialog
          card={viewDialog.card}
          isSaving={isSaving}
          onClose={() => setViewDialog({ card: null, open: false })}
          onEdit={card => {
            setViewDialog({ card: null, open: false })
            setEditDialog({ card, open: true })
          }}
          onDelete={id => {
            handleDeleteCard(id)
            setViewDialog({ card: null, open: false })
          }}
          onTranslate={handleTranslateInView}
          onTagClick={toggleTag}
          selectedTags={selectedTags}
        />
      )}

      {settingsOpen && (
        <SettingsPage
          onClose={() => setSettingsOpen(false)}
          onConfigured={() => {
            setSettingsOpen(false)
            refresh()
          }}
        />
      )}

      <Toaster />
    </div>
  )
}
