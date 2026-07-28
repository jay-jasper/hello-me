// 音源：把 Tone.Sampler 包起来，对外只暴露 midi 号与力度。
// 换掉 Tone 只需要保持下面这个 Instrument 接口不变。
import * as Tone from 'tone'
import { SAMPLE_NOTES, sampleMap } from './sample-map.ts'

export { SAMPLE_NOTES, sampleMap }

// 采样加载给自己留的最长等待时间：加载成功/失败都必须在这个时限内有个交代。
// main.ts 的加载提示、player.ts 的播放调度共用同一个数字，不再各写一份、悄悄漂移。
export const READY_TIMEOUT_MS = 8000

export type Instrument = {
  /** 是否加载成功；无论成功还是超时失败，都保证在 READY_TIMEOUT_MS 内落定——
   *  player.ts 的 `await instrument.ready` 绝不能被无限期挂起，否则静音模式下
   *  连 Transport 都不会启动，画面（琴键高亮、涟漪、浮字）整场都开不了场。 */
  ready: Promise<boolean>
  attack(midi: number, vel: number, when?: number): void
  release(midi: number, when?: number): void
  strike(midi: number, vel: number, dur: number, when?: number): void
  setVolume(db: number): void
  dispose(): void
}

const noteOf = (midi: number) => Tone.Frequency(midi, 'midi').toNote()

export function createInstrument(baseUrl: string): Instrument {
  let settleReady!: (ok: boolean) => void
  let settled = false
  const ready = new Promise<boolean>((r) => (settleReady = r))
  // resolve 之后再调用 resolve 本来就是 no-op，但用 settled 挡一道更明确：
  // 避免超时定时器和 onload 谁先谁后全靠 Promise 语义兜底、意图看不出来。
  const settle = (ok: boolean) => {
    if (settled) return
    settled = true
    settleReady(ok)
  }

  const sampler = new Tone.Sampler({
    urls: sampleMap(),
    baseUrl,
    release: 1.2,
    onload: () => settle(true),
  }).toDestination()
  window.setTimeout(() => settle(false), READY_TIMEOUT_MS)

  // 静音模式（采样没加载完/加载失败）下，Sampler 对还没有 buffer 的音符会抛错。
  // player.ts 的 Tone.Part 回调里直接调这几个方法，一旦抛出就会打断那次调度，
  // 画面（琴键高亮、涟漪、浮字）的时间轴也会跟着卡住。包一层兜底，只在
  // 第一次失败时打一条日志（避免每个音符刷屏），后续静默跳过，让演出继续跑完。
  let warned = false
  const guard = (fn: () => void) => {
    try {
      fn()
    } catch (err) {
      if (!warned) {
        warned = true
        console.warn('[piano] 静音模式：音源调用失败，画面继续播放', err)
      }
    }
  }

  return {
    ready,
    attack: (midi, vel, when) => guard(() => sampler.triggerAttack(noteOf(midi), when, vel)),
    release: (midi, when) => guard(() => sampler.triggerRelease(noteOf(midi), when)),
    strike: (midi, vel, dur, when) =>
      guard(() => sampler.triggerAttackRelease(noteOf(midi), dur, when, vel)),
    setVolume: (db) => {
      sampler.volume.value = db
    },
    dispose: () => sampler.dispose(),
  }
}
