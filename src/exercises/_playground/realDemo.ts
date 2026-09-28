// Playground-only: new-type exercises built from the REAL course (dialogues + stories) for eyeballing content.
import type { Course, Exercise } from '../../types'

export function realDemo(course: Course, pick = 0): Exercise[] {
  const ds = Object.values(course.dialogues ?? {})
  if (!ds.length) return []
  const dialogue = ds.find((d) => d.kind === 'dialogue' && d.lines.length >= 3) ?? ds[0]
  const story = ds.find((d) => d.kind === 'story') ?? dialogue
  const allLines = ds.flatMap((d) => d.lines.map((l) => l.chunks.join(' ')))
  const out: Exercise[] = []
  const d = ds[pick % ds.length] ?? dialogue
  for (const [dlg, idx] of [[d, Math.min(2, d.lines.length - 1)], [story, Math.min(2, story.lines.length - 1)]] as const) {
    const answer = dlg.lines[idx].chunks.join(' ')
    const distractors = allLines.filter((x) => x !== answer).sort(() => Math.random() - 0.5).slice(0, 2)
    out.push({ type: 'dialogue-reply', item: { kind: 'line', id: `${dlg.id}:${idx}` }, options: [answer, ...distractors].sort(() => Math.random() - 0.5), answer })
  }
  const l1 = dialogue.lines[1] ?? dialogue.lines[0]
  out.push({ type: 'shadow', item: { kind: 'line', id: `${dialogue.id}:1` } })
  out.push({ type: 'listen-build', item: { kind: 'line', id: `${dialogue.id}:1` }, tiles: [...l1.chunks].sort(() => Math.random() - 0.5) })
  out.push({ type: 'fill-blank', item: { kind: 'line', id: `${dialogue.id}:1` }, blankIndex: 0, options: [l1.chunks[0], ...allLines.slice(0, 2).map((x) => x.split(' ')[0])], answer: l1.chunks[0] })
  return out
}
