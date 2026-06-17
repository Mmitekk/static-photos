import { type CardData } from '@/lib/types'

type TimeGroup = 'today' | 'week' | 'month' | 'year' | 'earlier'

interface GroupedCards {
  key: TimeGroup
  label: string
  cards: CardData[]
}

const GROUP_LABELS: Record<TimeGroup, string> = {
  today: 'Сегодня',
  week: 'На этой неделе',
  month: 'В этом месяце',
  year: 'В этом году',
  earlier: 'Ранее',
}

function getTimeGroup(date: Date): TimeGroup {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(today)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Monday
  if (weekStart > today) {
    weekStart.setDate(weekStart.getDate() - 7)
  }
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const yearStart = new Date(now.getFullYear(), 0, 1)

  if (date >= today) return 'today'
  if (date >= weekStart) return 'week'
  if (date >= monthStart) return 'month'
  if (date >= yearStart) return 'year'
  return 'earlier'
}

export function groupCardsByTime(cards: CardData[]): GroupedCards[] {
  const groups: Record<TimeGroup, CardData[]> = {
    today: [],
    week: [],
    month: [],
    year: [],
    earlier: [],
  }

  // Sort by updatedAt descending
  const sorted = [...cards].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  for (const card of sorted) {
    const date = new Date(card.updatedAt)
    if (isNaN(date.getTime())) {
      groups.earlier.push(card)
      continue
    }
    const group = getTimeGroup(date)
    groups[group].push(card)
  }

  const result: GroupedCards[] = []
  for (const key of ['today', 'week', 'month', 'year', 'earlier'] as TimeGroup[]) {
    if (groups[key].length > 0) {
      result.push({
        key,
        label: GROUP_LABELS[key],
        cards: groups[key],
      })
    }
  }

  return result
}
