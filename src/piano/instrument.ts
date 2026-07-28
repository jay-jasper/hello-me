// 音源：把 Tone.Sampler 包起来，对外只暴露 midi 号与力度。
// 换掉 Tone 只需要保持下面这个 Instrument 接口不变。
import * as Tone from 'tone'
import { SAMPLE_NOTES, sampleMap } from './sample-map.ts'

export { SAMPLE_NOTES, sampleMap }

export type Instrument = {
  ready: Promise<void>
  attack(midi: number, vel: number, when?: number): void
  release(midi: number, when?: number): void
  strike(midi: number, vel: number, dur: number, when?: number): void
  setVolume(db: number): void
  dispose(): void
}

const noteOf = (midi: number) => Tone.Frequency(midi, 'midi').toNote()

export function createInstrument(baseUrl: string): Instrument {
  let resolveReady!: () => void
  const ready = new Promise<void>((r) => (resolveReady = r))

  const sampler = new Tone.Sampler({
    urls: sampleMap(),
    baseUrl,
    release: 1.2,
    onload: () => resolveReady(),
  }).toDestination()

  return {
    ready,
    attack: (midi, vel, when) => sampler.triggerAttack(noteOf(midi), when, vel),
    release: (midi, when) => sampler.triggerRelease(noteOf(midi), when),
    strike: (midi, vel, dur, when) =>
      sampler.triggerAttackRelease(noteOf(midi), dur, when, vel),
    setVolume: (db) => {
      sampler.volume.value = db
    },
    dispose: () => sampler.dispose(),
  }
}
