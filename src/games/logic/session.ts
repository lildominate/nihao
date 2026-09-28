// OWNER: Games agent. Collects answers during a game → LessonResult for finishSession (pure).
import type { ItemRef, ItemResult, LessonResult } from '../../types'

/** First attempt per item decides SRS; every wrong answer counts as a mistake. */
export class AnswerTracker {
  private first = new Map<string, ItemResult>()
  private wrong = 0
  private answers = 0

  record(item: ItemRef, correct: boolean): void {
    this.answers++
    if (!correct) this.wrong++
    const k = `${item.kind}:${item.id}`
    if (!this.first.has(k)) this.first.set(k, { item, correct })
  }

  get items(): ItemResult[] { return [...this.first.values()] }
  get mistakes(): number { return this.wrong }
  get answered(): number { return this.answers }

  /** Was this item first answered correctly? undefined if never answered. */
  firstResult(item: ItemRef): boolean | undefined {
    return this.first.get(`${item.kind}:${item.id}`)?.correct
  }

  result(durationMs: number): LessonResult {
    const items = this.items
    return {
      lessonId: null,
      source: 'game',
      total: items.length,
      correct: items.filter((i) => i.correct).length,
      mistakes: this.wrong,
      durationMs: Math.max(0, Math.round(durationMs)),
      items,
    }
  }
}

export const wordRef = (id: string): ItemRef => ({ kind: 'word', id })
