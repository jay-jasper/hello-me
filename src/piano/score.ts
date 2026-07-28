// 曲谱数据与乐理纯函数。零依赖，可被 node 直接跑。

export type Note = {
  midi: number // 21–108
  t: number // 起始秒
  d: number // 持续秒
  v: number // 力度 0–1
}
export type Anchor = { t: number; memory: string }
export type Piece = {
  id: string
  title: string
  latin: string
  mood: string
  duration: number
  notes: Note[]
  anchors: Anchor[]
}

const PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }

/** 'c4' → 60，'db4' → 61。超出 21–108 抛错。 */
export function noteToMidi(name: string): number {
  const m = /^([a-gA-G])([#b]?)(-?\d)$/.exec(name.trim())
  if (!m) throw new Error(`非法音名：${name}`)
  const [, letter, accidental, octave] = m
  const base = PC[letter.toLowerCase()]
  const acc = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0
  const midi = (Number(octave) + 1) * 12 + base + acc
  if (midi < 21 || midi > 108) throw new Error(`音高超出钢琴范围：${name}`)
  return midi
}

type MelOpts = { start: number; step: number; dur?: number; v?: number }

/**
 * 'c4 e4 - g4 . a4' →
 *   音名产生音符；'-' 把上一个音的时值延长一个 step；'.' 是休止，只推进时间。
 */
export function mel(names: string, opts: MelOpts): Note[] {
  const { start, step, dur = step, v = 0.6 } = opts
  const out: Note[] = []
  let t = start
  for (const tok of names.trim().split(/\s+/)) {
    if (tok === '-') {
      if (out.length) out[out.length - 1].d += step
      t += step
      continue
    }
    if (tok === '.') {
      t += step
      continue
    }
    out.push({ midi: noteToMidi(tok), t, d: dur, v })
    t += step
  }
  return out
}

type ArpOpts = { start: number; step: number; dur?: number; v?: number; times?: number }

/** 分解和弦：把 chord 依次弹出，重复 times 轮。 */
export function arp(chord: string[], opts: ArpOpts): Note[] {
  const { start, step, dur = step * 2, v = 0.35, times = 1 } = opts
  const out: Note[] = []
  let i = 0
  for (let round = 0; round < times; round++) {
    for (const name of chord) {
      out.push({ midi: noteToMidi(name), t: start + i * step, d: dur, v })
      i++
    }
  }
  return out
}

/** 柱式和弦：同起点、同时值。 */
export function pad(chord: string[], opts: { start: number; d: number; v?: number }): Note[] {
  const { start, d, v = 0.4 } = opts
  return chord.map((name) => ({ midi: noteToMidi(name), t: start, d, v }))
}

/** 最晚的结束时刻。 */
export function endOf(notes: Note[]): number {
  return notes.reduce((max, n) => Math.max(max, n.t + n.d), 0)
}
