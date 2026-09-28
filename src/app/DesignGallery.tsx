// Dev-only gallery (open #/design in `npm run dev`): mascot moods, unit art and UI primitives.
import { useState } from 'react'
import { Panda, PandaFace, type PandaMood } from '../mascot/Panda'
import { UnitArt, UNIT_ART_IDS } from '../ui/art/UnitArt'
import { Button, type ButtonVariant } from '../ui/Button'
import { Card } from '../ui/Card'
import { ProgressBar, ProgressRing } from '../ui/ProgressRing'
import { Toggle } from '../ui/Toggle'
import { Badge, Chip, EmptyState, IconButton, SectionHeader, SegmentedControl, Stat } from '../ui/kit'
import { BoltIcon, FlameIcon, SpeakerIcon } from './icons'

const MOODS: PandaMood[] = ['happy', 'cheer', 'sad', 'think', 'sleep', 'wave', 'surprised', 'proud']
const VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'accent', 'gold', 'sky', 'plum', 'soft', 'danger', 'ghost']

export function DesignGallery() {
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a')
  const [on, setOn] = useState(true)
  const theme = () => { const r = document.documentElement; r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark' }
  return (
    <div className="fixed inset-0 overflow-y-auto bg-canvas"><div className="mx-auto max-w-md space-y-6 p-4 pb-20">
      <div className="flex items-center justify-between"><h1 className="font-display text-2xl font-semibold">Design gallery</h1><Button size="sm" variant="secondary" onClick={theme}>Tema</Button></div>
      <SectionHeader title="Pānpan" />
      <div className="grid grid-cols-4 gap-2">
        {MOODS.map((m) => <div key={m} className="flex flex-col items-center rounded-2xl bg-surface p-1 text-xs font-bold"><Panda mood={m} size={80} />{m}</div>)}
      </div>
      <div className="flex items-end gap-3">{MOODS.map((m) => <Panda key={m} mood={m} size={40} />)}<PandaFace size={32} /></div>
      <Panda mood="cheer" size={200} />
      <SectionHeader title="Unit art" />
      <div className="grid grid-cols-5 gap-2">{UNIT_ART_IDS.map((id) => <div key={id} className="rounded-2xl bg-brand p-1"><UnitArt unitId={id} size={60} /></div>)}</div>
      <SectionHeader title="Buttons" />
      <div className="grid grid-cols-2 gap-3">{VARIANTS.map((v) => <Button key={v} variant={v}>{v}</Button>)}</div>
      <div className="flex gap-2"><Button size="sm">Small</Button><Button size="lg">Large</Button><IconButton variant="solid" aria-label="x"><SpeakerIcon /></IconButton><IconButton variant="raised" aria-label="y"><SpeakerIcon /></IconButton></div>
      <SectionHeader title="Kit" />
      <div className="flex flex-wrap gap-2"><Badge>brand</Badge><Badge tone="gold">gold</Badge><Badge tone="lacquer" solid>solid</Badge><Chip selected>Vald</Chip><Chip>Chip</Chip></div>
      <SegmentedControl value={seg} onChange={setSeg} options={[{ value: 'a', label: 'System' }, { value: 'b', label: 'Ljust' }, { value: 'c', label: 'Mörkt' }]} />
      <div className="grid grid-cols-2 gap-2"><Stat tone="flame" icon={<FlameIcon />} value={12} label="Dagar i rad" /><Stat tone="warn" icon={<BoltIcon />} value={340} label="XP" /></div>
      <Card><Toggle checked={on} onChange={setOn} label="Toggle" description="Beskrivning" /><ProgressBar value={0.6} /><div className="mt-3 flex gap-3"><ProgressRing value={0.7} gradient={['#ffd35c', '#f59e0b']} /><ProgressRing value={0.3} size={60} stroke={7} color="var(--color-sky)" /></div></Card>
      <EmptyState title="Tomt här" mood="sleep">Inget att visa.</EmptyState>
    </div></div>
  )
}
