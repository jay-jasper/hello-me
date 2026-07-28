// 演出调度。吃一个 Piece，吐事件。不认识 DOM，也不认识水面。
import * as Tone from 'tone'
import type { Instrument } from './instrument.ts'
import type { Piece } from './score.ts'

/** 视觉回调比发声提前的秒数，让琴键在出声那一刻恰好压到底 */
const LEAD = 0.08

export type PlayerEvents = {
  onNote(midi: number, vel: number): void
  onAnchor(memory: string): void
  onEnd(): void
}

export type Player = {
  play(piece: Piece): Promise<void>
  pause(): void
  resume(): void
  stop(): void
  readonly playing: boolean
  progress(): number
}

/** Fisher–Yates。rng 可注入，便于复现。 */
export function shuffled<T>(items: T[], rng: () => number = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function createPlayer(instrument: Instrument, ev: PlayerEvents): Player {
  const parts: Tone.Part[] = []
  let current: Piece | null = null
  let playing = false

  const clear = () => {
    for (const p of parts) p.dispose()
    parts.length = 0
    Tone.getTransport().cancel()
    Tone.getTransport().stop()
    Tone.getTransport().seconds = 0
  }

  return {
    get playing() {
      return playing
    },
    progress() {
      if (!current) return 0
      return Math.min(1, Tone.getTransport().seconds / current.duration)
    },
    async play(piece) {
      clear()
      current = piece
      await instrument.ready

      // Tone.Part<ValueType> 的回调类型由 ValueType 反推：传元组数组时
      // 泛型要标注成元组本身 [number, T]，而不是裸的 T，否则 CallbackType<T>
      // 推导不出 { time } 或 ArrayLike 分支，落到 never。
      const notePart = new Tone.Part<[number, Piece['notes'][number]]>((time, n) => {
        instrument.strike(n.midi, n.v, n.d, time)
        Tone.getDraw().schedule(() => ev.onNote(n.midi, n.v), Math.max(0, time - LEAD))
      }, piece.notes.map((n) => [n.t, n] as [number, Piece['notes'][number]])).start(0)

      const anchorPart = new Tone.Part<[number, Piece['anchors'][number]]>((time, a) => {
        Tone.getDraw().schedule(() => ev.onAnchor(a.memory), time)
      }, piece.anchors.map((a) => [a.t, a] as [number, Piece['anchors'][number]])).start(0)

      parts.push(notePart, anchorPart)

      Tone.getTransport().scheduleOnce(() => {
        playing = false
        ev.onEnd()
      }, piece.duration + 2)

      playing = true
      Tone.getTransport().start()
    },
    pause() {
      Tone.getTransport().pause()
      playing = false
    },
    resume() {
      Tone.getTransport().start()
      playing = true
    },
    stop() {
      clear()
      playing = false
      current = null
    },
  }
}
