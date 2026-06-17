import { type CardData } from '@/lib/types'
import { getLangName, getLangFlag } from '@/lib/translate'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { X, Copy, Languages, Loader2, Tag } from 'lucide-react'
import { showToast } from './toaster'

interface CardViewDialogProps {
  card: CardData
  isSaving: boolean
  onClose: () => void
  onEdit: (card: CardData) => void
  onDelete: (id: string) => void
  onTranslate: (card: CardData) => void
  onTagClick?: (tag: string) => void
  selectedTags?: string[]
}

const TAG_COLORS = [
  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
  'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
]

function getTagColor(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

export function CardViewDialog({ card, isSaving, onClose, onEdit, onDelete, onTranslate, onTagClick, selectedTags = [] }: CardViewDialogProps) {
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`${label} скопирован!`, 'success')
    })
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return 'Неизвестно'
    try {
      return formatDistanceToNow(date, { addSuffix: true, locale: ru })
    } catch {
      return 'Неизвестно'
    }
  }

  return (
    <div className="dialog-overlay" onClick={isSaving ? undefined : onClose}>
      <div
        className="dialog-content w-full sm:max-w-3xl p-6 mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-sm px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium">
              {getLangFlag(card.sourceLang)} {getLangName(card.sourceLang)}
            </span>
            <span className="text-gray-400">→</span>
            <span className="inline-flex items-center gap-1 text-sm px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full font-medium">
              {getLangFlag(card.targetLang)} {getLangName(card.targetLang)}
            </span>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tags */}
        {card.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            <Tag className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            {card.tags.map(tag => {
              const isSelected = selectedTags.includes(tag)
              const TagEl = onTagClick ? 'button' : 'span'
              return (
                <TagEl
                  key={tag}
                  {...(onTagClick ? { onClick: () => { onTagClick(tag); onClose() } } : {})}
                  className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium transition-all ${
                    onTagClick ? 'cursor-pointer' : ''
                  } ${
                    isSelected
                      ? 'bg-purple-600 text-white ring-1 ring-purple-400'
                      : getTagColor(tag) + (onTagClick ? ' hover:ring-1 hover:ring-purple-300' : '')
                  }`}
                  title={onTagClick ? (isSelected ? 'Убрать фильтр: ' + tag : 'Фильтр по тегу: ' + tag) : undefined}
                >
                  {tag}
                </TagEl>
              )
            })}
          </div>
        )}

        {/* Original text */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
              Оригинал ({getLangName(card.sourceLang)})
            </h3>
            <button
              onClick={() => handleCopy(card.originalText, 'Оригинал')}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
            >
              <Copy className="w-3 h-3" />
              Копировать
            </button>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-[var(--border)]">
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-[var(--card-foreground)]">
              {card.originalText}
            </p>
          </div>
        </div>

        {/* Translated text */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
              Перевод ({getLangName(card.targetLang)})
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onTranslate(card)}
                disabled={isSaving}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-500 transition-colors disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Languages className="w-3 h-3" />}
                {isSaving ? 'Сохранение...' : 'Перевести'}
              </button>
              {card.translatedText && (
                <button
                  onClick={() => handleCopy(card.translatedText, 'Перевод')}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  Копировать
                </button>
              )}
            </div>
          </div>
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800/30">
            {card.translatedText ? (
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-purple-900 dark:text-purple-200">
                {card.translatedText}
              </p>
            ) : (
              <p className="text-[15px] text-purple-400 italic">Перевод отсутствует</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
          <div className="text-xs text-[var(--muted-foreground)]">
            <p>Создано: {new Date(card.createdAt).toLocaleString('ru-RU')}</p>
            <p>Обновлено: {formatDate(card.updatedAt)} ({new Date(card.updatedAt).toLocaleString('ru-RU')})</p>
          </div>
          <div className="flex items-center gap-2">
            {isSaving && (
              <span className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Сохранение...
              </span>
            )}
            <button
              onClick={() => onEdit(card)}
              disabled={isSaving}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Редактировать
            </button>
            <button
              onClick={() => {
                if (isSaving) return
                if (confirm('Удалить карточку?')) {
                  onDelete(card.id)
                  onClose()
                }
              }}
              disabled={isSaving}
              className="px-4 py-2 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Удалить
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
