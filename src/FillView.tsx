import type { DayInfo } from './types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

type FillViewProps = {
  days: DayInfo[]
  cols: number
  rows: number
  cellSize: number
  fontSize: number
  showAnnotationDate: boolean
  selectedDayIndex: number | null
  startDate: Date
  annotationEmojis: Record<string, string>
  onDayPointerDown: (e: PointerEvent, day: DayInfo) => void
}

function getAnnotationDisplay(
  text: string,
  cellSize: number,
  fontSize: number,
  annotationEmojis: Record<string, string>
): string {
  const longestWord = text.split(' ').reduce((a, b) => a.length > b.length ? a : b, '')
  const estimatedWidth = longestWord.length * fontSize * 0.55
  const availableWidth = cellSize * 0.85
  if (estimatedWidth <= availableWidth) {
    return text
  }
  return annotationEmojis[text] || text
}

export function FillView({
  days,
  cols,
  rows,
  cellSize,
  fontSize,
  showAnnotationDate,
  selectedDayIndex,
  startDate,
  annotationEmojis,
  onDayPointerDown,
}: FillViewProps) {
  return (
    <div
      class="grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {days.map((day) => (
        <div
          key={day.index}
          class={`day ${day.passed ? 'passed' : 'future'} ${day.color ? 'milestone' : ''} ${day.isUncoloredMilestone ? 'uncolored-milestone' : ''} ${day.isOddWeek ? 'odd-week' : 'even-week'} ${day.isToday ? 'today' : ''} ${day.annotation ? 'has-annotation' : ''} ${selectedDayIndex === day.index ? 'selected' : ''}`}
          style={day.color ? { background: `var(--color-${day.color})`, color: `var(--color-${day.color}-text)` } : undefined}
          onPointerDown={(e) => onDayPointerDown(e as unknown as PointerEvent, day)}
        >
          {day.annotation ? (
            cellSize >= 50 ? (
              <>
                <span class="date-label" style={{ fontSize: `${fontSize}px` }}>{formatDate(addDays(startDate, day.index))}</span>
                <span class="annotation-text visible" style={{ fontSize: `${fontSize}px` }}>{getAnnotationDisplay(day.annotation, cellSize, fontSize, annotationEmojis)}</span>
              </>
            ) : (
              <span class="annotation-container" style={{ fontSize: `${fontSize}px` }}>
                <span class={`annotation-text ${showAnnotationDate ? 'hidden' : 'visible'}`}>{getAnnotationDisplay(day.annotation, cellSize, fontSize, annotationEmojis)}</span>
                <span class={`annotation-date ${showAnnotationDate ? 'visible' : 'hidden'}`}>{formatDate(addDays(startDate, day.index))}</span>
              </span>
            )
          ) : (
            <span class="date-label" style={{ fontSize: `${fontSize}px` }}>{day.dateLabel}</span>
          )}
        </div>
      ))}
    </div>
  )
}
