import { useState } from 'react'
import { type CardData } from '@/lib/types'
import { translateText, getLangName, getLangFlag } from '@/lib/translate'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Copy,
  Eye,
  Edit3,
  Trash2,
  CopyPlus,
  Clock,
  Languages,
  Loader2,
  Tag,
} from 'lucide-react'
import { showToast } from './toaster'

interface TranslationCardProps {
  card: CardData
  isSaving: boolean
  onEdit: (card: CardData) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onView: (card: CardData) => void
  onTagClick: (tag: string) => void
  selectedTags: string[]
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

export function TranslationCard({ card, isSaving, onEdit, onDelete, onDuplicate, onView, onTagClick, selectedTags }: TranslationCardProps) {
  const [isTranslating, setIsTranslating] = useState(false)
  const isBusy = isTranslating || isSaving

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`${label} скопирован!`, 'success')
    })
  }

  const handleTranslate = async () => {
    if (isTranslating || isSaving) return
    setIsTranslating(true)
    try {
      const translated = await translateText(card.originalText, card.sourceLang, card.targetLang)
      onEdit({ ...card, translatedText: translated })
      showToast('Перевод обновлён!', 'success')
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setIsTranslating(false)
    }
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

  const previewText = card.originalText.length > 150
    ? card.originalText.substring(0, 150) + '...'
    : card.originalText

  const title = card.originalText.length > 80
    ? card.originalText.substring(0, 80) + '...'
    : card.originalText

  return (
    <div className={`group bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 hover:shadow-lg transition-all duration-200 hover:border-purple-300 dark:hover:border-purple-700 flex flex-col ${isSaving ? 'opacity-70 pointer-events-none' : ''}`}>
      {/* Title */}
      <h3
        className="font-semibold text-[var(--card-foreground)] line-clamp-2 mb-2 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors text-[18px] leading-snug"
        onClick={() => onView(card)}
        title="Нажмите для полного просмотра"
      >
        {title}
      </h3>

      {/* Preview text */}
      <p className="text-[13px] text-[var(--muted-foreground)] line-clamp-3 mb-3 flex-1 leading-relaxed">
        {previewText}
      </p>

      {/* Translation preview */}
      {card.translatedText && (
        <div className="mb-3 px-2 py-1.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800/30">
          <p className="text-[12px] text-purple-700 dark:text-purple-300 line-clamp-2 leading-relaxed">
            {card.translatedText.length > 100
              ? card.translatedText.substring(0, 100) + '...'
              : card.translatedText}
          </p>
        </div>
      )}

      {/* Tags */}
      {card.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mb-3">
          <Tag className="w-3 h-3 text-gray-400 flex-shrink-0" />
          {card.tags.slice(0, 4).map(tag => {
            const isSelected = selectedTags.includes(tag)
            return (
              <button
                key={tag}
                onClick={e => { e.stopPropagation(); onTagClick(tag) }}
                className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-purple-600 text-white ring-1 ring-purple-400'
                    : getTagColor(tag) + ' hover:ring-1 hover:ring-purple-300'
                }`}
                title={isSelected ? 'Убрать фильтр: ' + tag : 'Фильтр по тегу: ' + tag}
              >
                {tag}
              </button>
            )
          })}
          {card.tags.length > 4 && (
            <span className="text-[10px] text-[var(--muted-foreground)]">+{card.tags.length - 4}</span>
          )}
        </div>
      )}

      {/* Language badges */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium">
          {getLangFlag(card.sourceLang)} {getLangName(card.sourceLang)}
        </span>
        <span className="text-[11px] text-gray-400">→</span>
        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full font-medium">
          {getLangFlag(card.targetLang)} {getLangName(card.targetLang)}
        </span>
      </div>

      {/* Date */}
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)] mb-3">
        <Clock className="w-3 h-3" />
        <span>{formatDate(card.updatedAt)}</span>
        <span className="text-gray-300 dark:text-gray-600">•</span>
        <span>{new Date(card.updatedAt).toLocaleDateString('ru-RU')}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 pt-2 border-t border-[var(--border)]">
        <button
          onClick={() => handleCopy(card.originalText, 'Оригинал')}
          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          title="Копировать оригинал"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        {card.translatedText && (
          <button
            onClick={() => handleCopy(card.translatedText, 'Перевод')}
            className="p-1.5 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
            title="Копировать перевод"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={handleTranslate}
          disabled={isBusy}
          className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors disabled:opacity-50"
          title={isSaving ? 'Сохранение...' : 'Перевести заново'}
        >
          {isTranslating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => onView(card)}
          className="p-1.5 rounded-md hover:bg-green-100 dark:hover:bg-green-900/30 text-green-500 hover:text-green-700 dark:hover:text-green-300 transition-colors"
          title="Просмотр"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDuplicate(card.id)}
          disabled={isSaving}
          className="p-1.5 rounded-md hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-500 hover:text-orange-700 dark:hover:text-orange-300 transition-colors disabled:opacity-50"
          title={isSaving ? 'Сохранение...' : 'Дублировать'}
        >
          <CopyPlus className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1" />
        <button
          onClick={() => onEdit(card)}
          disabled={isSaving}
          className="p-1.5 rounded-md hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-300 transition-colors disabled:opacity-50"
          title={isSaving ? 'Сохранение...' : 'Редактировать'}
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            if (isSaving) return
            if (confirm('Удалить карточку?')) onDelete(card.id)
          }}
          disabled={isSaving}
          className="p-1.5 rounded-md hover:bg-red-100 dark:bg-red-900/30 text-red-500 hover:text-red-700 dark:hover:text-red-300 transition-colors disabled:opacity-50"
          title={isSaving ? 'Сохранение...' : 'Удалить'}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
