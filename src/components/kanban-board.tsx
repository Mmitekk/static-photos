import { type CardData } from '@/lib/types'
import { groupCardsByTime } from '@/lib/grouping'
import { TranslationCard } from './translation-card'

interface KanbanBoardProps {
  cards: CardData[]
  isSaving: boolean
  onEdit: (card: CardData) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onView: (card: CardData) => void
  onTagClick: (tag: string) => void
  selectedTags: string[]
}

export function KanbanBoard({ cards, isSaving, onEdit, onDelete, onDuplicate, onView, onTagClick, selectedTags }: KanbanBoardProps) {
  const groups = groupCardsByTime(cards)

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
          <span className="text-4xl">📝</span>
        </div>
        <h3 className="text-xl font-semibold text-[var(--muted-foreground)] mb-2">
          Нет карточек
        </h3>
        <p className="text-sm text-[var(--muted-foreground)] max-w-sm">
          Нажмите «Новая карточка» чтобы создать первую запись с переводом
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {groups.map(group => (
        <div key={group.key}>
          {/* Group header */}
          <div className="sticky top-0 z-10 bg-[var(--background)]/80 backdrop-blur-sm py-2 mb-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                {group.label}
              </h2>
              <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-[var(--muted-foreground)] rounded-full">
                {group.cards.length}
              </span>
            </div>
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {group.cards.map(card => (
              <TranslationCard
                key={card.id}
                card={card}
                isSaving={isSaving}
                onEdit={onEdit}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onView={onView}
                onTagClick={onTagClick}
                selectedTags={selectedTags}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
