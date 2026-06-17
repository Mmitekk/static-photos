import { useState, useEffect, useRef } from 'react'
import { type CardData, collectAllTags } from '@/lib/types'
import { translateText, getLangName, getLangFlag, detectLanguage, getOppositeLang } from '@/lib/translate'
import { X, ArrowLeftRight, Loader2, Save, Globe, Plus } from 'lucide-react'
import { showToast } from './toaster'

interface CardEditDialogProps {
  card?: CardData | null
  allCards: CardData[]
  onClose: () => void
  onSave: (data: {
    originalText: string
    translatedText: string
    sourceLang: string
    targetLang: string
    tags: string[]
  }) => Promise<void>
  isSaving?: boolean
}

export function CardEditDialog({ card, allCards, onClose, onSave, isSaving = false }: CardEditDialogProps) {
  const [originalText, setOriginalText] = useState(card?.originalText || '')
  const [translatedText, setTranslatedText] = useState(card?.translatedText || '')
  const [sourceLang, setSourceLang] = useState(card?.sourceLang || 'ru')
  const [targetLang, setTargetLang] = useState(card?.targetLang || 'en')
  const [tags, setTags] = useState<string[]>(card?.tags || [])
  const [tagInput, setTagInput] = useState('')
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [autoTranslate, setAutoTranslate] = useState(true)
  const [autoDetect, setAutoDetect] = useState(true)
  const lastDetectedLang = useRef<'ru' | 'en' | null>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)

  const isEditing = !!card
  const isBusy = isTranslating || isSaving

  // All existing tags for suggestions
  const allTags = collectAllTags(allCards)
  const filteredSuggestions = tagInput.trim()
    ? allTags.filter(t => t.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(t))
    : allTags.filter(t => !tags.includes(t))

  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
    }
    setTagInput('')
    setShowTagSuggestions(false)
    tagInputRef.current?.focus()
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (tagInput.trim()) {
        addTag(tagInput)
      }
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  const handleSwapLanguages = () => {
    const prevSource = sourceLang
    const prevTarget = targetLang
    setSourceLang(prevTarget)
    setTargetLang(prevSource)
    setOriginalText(translatedText)
    setTranslatedText(originalText)
    setAutoDetect(false)
  }

  // Auto-detect language when user types
  useEffect(() => {
    if (!autoDetect || isEditing || !originalText.trim()) return

    const detected = detectLanguage(originalText)
    if (detected !== lastDetectedLang.current) {
      lastDetectedLang.current = detected
      setSourceLang(detected)
      setTargetLang(getOppositeLang(detected))
    }
  }, [originalText, autoDetect, isEditing])

  const handleTranslate = async () => {
    if (!originalText.trim() || isTranslating) return

    let src = sourceLang
    let tgt = targetLang
    if (src === tgt) {
      const detected = detectLanguage(originalText)
      src = detected
      tgt = getOppositeLang(detected)
      setSourceLang(src)
      setTargetLang(tgt)
    }

    setIsTranslating(true)
    try {
      const translated = await translateText(originalText, src, tgt)
      setTranslatedText(translated)
      showToast('Перевод выполнен!', 'success')
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setIsTranslating(false)
    }
  }

  // Auto-translate when text changes (with debounce)
  useEffect(() => {
    if (!autoTranslate || isEditing || !originalText.trim() || originalText.trim().length <= 2) return

    const timer = setTimeout(() => {
      if (sourceLang === targetLang) {
        const detected = detectLanguage(originalText)
        setSourceLang(detected)
        setTargetLang(getOppositeLang(detected))
      }
      handleTranslate()
    }, 800)
    return () => clearTimeout(timer)
  }, [originalText, sourceLang, targetLang, autoTranslate, isEditing])

  const handleSave = async () => {
    if (!originalText.trim()) {
      showToast('Введите текст для перевода', 'error')
      return
    }

    let src = sourceLang
    let tgt = targetLang
    if (src === tgt) {
      const detected = detectLanguage(originalText)
      src = detected
      tgt = getOppositeLang(detected)
      setSourceLang(src)
      setTargetLang(tgt)
    }

    if (autoTranslate && !translatedText.trim() && originalText.trim().length > 0) {
      setIsTranslating(true)
      try {
        const translated = await translateText(originalText, src, tgt)
        setTranslatedText(translated)
        await onSave({ originalText, translatedText: translated, sourceLang: src, targetLang: tgt, tags })
      } catch (e) {
        showToast('Перевод не удался, сохраняем без перевода', 'info')
        await onSave({ originalText, translatedText: '', sourceLang: src, targetLang: tgt, tags })
      } finally {
        setIsTranslating(false)
      }
    } else {
      await onSave({ originalText, translatedText, sourceLang: src, targetLang: tgt, tags })
    }
  }

  const detectedLabel = autoDetect && !isEditing && originalText.trim()
    ? detectLanguage(originalText) === 'ru' ? '🇷🇺 RU → 🇬🇧 EN' : '🇬🇧 EN → 🇷🇺 RU'
    : null

  return (
    <div className="dialog-overlay" onClick={isBusy ? undefined : onClose}>
      <div
        className="dialog-content w-full sm:max-w-6xl p-6 mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">
            {isEditing ? 'Редактирование' : 'Новая карточка'}
          </h2>
          <button
            onClick={onClose}
            disabled={isBusy}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Language selector */}
        <div className="flex items-center gap-3 mb-4">
          <select
            value={sourceLang}
            onChange={e => {
              setSourceLang(e.target.value as 'ru' | 'en')
              setTargetLang(e.target.value === 'ru' ? 'en' : 'ru')
              setAutoDetect(false)
            }}
            disabled={isBusy}
            className="px-3 py-2 border border-[var(--border)] rounded-lg bg-white dark:bg-gray-700 text-sm outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          >
            <option value="ru">{getLangFlag('ru')} {getLangName('ru')}</option>
            <option value="en">{getLangFlag('en')} {getLangName('en')}</option>
          </select>

          <button
            onClick={handleSwapLanguages}
            disabled={isBusy}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-purple-600 dark:text-purple-400 transition-colors disabled:opacity-50"
            title="Поменять языки местами"
          >
            <ArrowLeftRight className="w-5 h-5" />
          </button>

          <select
            value={targetLang}
            onChange={e => {
              setTargetLang(e.target.value as 'ru' | 'en')
              setSourceLang(e.target.value === 'ru' ? 'en' : 'ru')
              setAutoDetect(false)
            }}
            disabled={isBusy}
            className="px-3 py-2 border border-[var(--border)] rounded-lg bg-white dark:bg-gray-700 text-sm outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          >
            <option value="en">{getLangFlag('en')} {getLangName('en')}</option>
            <option value="ru">{getLangFlag('ru')} {getLangName('ru')}</option>
          </select>

          <div className="ml-auto flex items-center gap-3">
            {detectedLabel && (
              <span className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 font-medium">
                <Globe className="w-3 h-3" />
                {detectedLabel}
              </span>
            )}
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] cursor-pointer">
              <input
                type="checkbox"
                checked={autoDetect}
                onChange={e => setAutoDetect(e.target.checked)}
                className="rounded"
              />
              Авто
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] cursor-pointer">
              <input
                type="checkbox"
                checked={autoTranslate}
                onChange={e => setAutoTranslate(e.target.checked)}
                className="rounded"
              />
              Перевод
            </label>
          </div>
        </div>

        {/* Original text */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">
            Текст на {getLangName(sourceLang).toLowerCase()}
          </label>
          <textarea
            value={originalText}
            onChange={e => setOriginalText(e.target.value)}
            rows={12}
            disabled={isBusy}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-white dark:bg-gray-700 text-[var(--foreground)] focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-y text-sm leading-relaxed disabled:opacity-50"
            placeholder="Введите текст на любом языке..."
            autoFocus
          />
        </div>

        {/* Translation */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-[var(--muted-foreground)]">
              Перевод на {getLangName(targetLang).toLowerCase()}
            </label>
            <button
              onClick={handleTranslate}
              disabled={isTranslating || isSaving || !originalText.trim()}
              className="flex items-center gap-1.5 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50"
            >
              {isTranslating ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {isTranslating ? 'Перевод...' : 'Перевести'}
            </button>
          </div>
          <textarea
            value={translatedText}
            onChange={e => setTranslatedText(e.target.value)}
            rows={12}
            disabled={isBusy}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-purple-50 dark:bg-purple-900/10 text-[var(--foreground)] focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-y text-sm leading-relaxed disabled:opacity-50"
            placeholder="Перевод появится здесь..."
          />
        </div>

        {/* Tags */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">
            Теги
          </label>
          <div className="flex flex-wrap items-center gap-1.5 p-2 border border-[var(--border)] rounded-lg bg-white dark:bg-gray-700 min-h-[38px]">
            {tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  disabled={isBusy}
                  className="hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <div className="relative flex-1 min-w-[120px]">
              <input
                ref={tagInputRef}
                type="text"
                value={tagInput}
                onChange={e => {
                  setTagInput(e.target.value)
                  setShowTagSuggestions(true)
                }}
                onFocus={() => setShowTagSuggestions(true)}
                onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                onKeyDown={handleTagKeyDown}
                disabled={isBusy}
                className="w-full border-0 outline-none bg-transparent text-sm text-[var(--foreground)] placeholder:text-gray-400 p-0 focus:ring-0"
                placeholder={tags.length === 0 ? 'Добавьте тег...' : ''}
              />
              {showTagSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute left-0 top-full mt-1 w-48 max-h-40 overflow-y-auto bg-white dark:bg-gray-800 border border-[var(--border)] rounded-lg shadow-lg z-50 py-1">
                  {filteredSuggestions.slice(0, 10).map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onMouseDown={e => {
                        e.preventDefault()
                        addTag(tag)
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-purple-50 dark:hover:bg-purple-900/30 text-[var(--foreground)] transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {tagInput.trim() && !filteredSuggestions.includes(tagInput.trim().toLowerCase()) && (
              <button
                type="button"
                onClick={() => addTag(tagInput)}
                disabled={isBusy}
                className="p-1 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400 transition-colors disabled:opacity-50"
                title="Добавить новый тег"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
            Нажмите Enter или запятую чтобы добавить тег
          </p>
        </div>

        {/* Saving indicator */}
        {isSaving && (
          <div className="mb-4 flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Сохранение...
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isBusy}
            className="px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={isBusy}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? 'Сохранение...' : isTranslating ? 'Перевод...' : isEditing ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  )
}
