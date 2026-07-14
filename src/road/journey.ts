// 旧路纯逻辑：路程进度 → 时刻色 / 相位；年份 → 路程。零 DOM 依赖，node 可直接跑。

export type Oklch = { l: number; c: number; h: number }
export type Phase = 'dawn' | 'day' | 'dusk' | 'night'

// 时刻停靠点（spec token 逐字）：0 晨 / 0.35 昼 / 0.7 黄昏 / 1 夜
const STOPS = [0, 0.35, 0.7, 1] as const

const SKY: Oklch[] = [
  { l: 0.9, c: 0.04, h: 60 }, // --dawn-sky
  { l: 0.87, c: 0.05, h: 230 }, // --day-sky
  { l: 0.8, c: 0.09, h: 60 }, // --dusk-sky
  { l: 0.26, c: 0.04, h: 265 }, // --night-sky
]

const MEADOW: Oklch[] = [
  { l: 0.78, c: 0.05, h: 110 }, // 晨：草原带雾的灰绿
  { l: 0.74, c: 0.07, h: 125 }, // --meadow-day
  { l: 0.55, c: 0.07, h: 80 }, // --meadow-dusk
  { l: 0.28, c: 0.04, h: 260 }, // --meadow-night
]

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// 色相走最短弧
function lerpHue(a: number, b: number, t: number): number {
  let d = b - a
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return (a + d * t + 360) % 360
}

function rampAt(ramp: Oklch[], progress: number): Oklch {
  const p = Math.min(1, Math.max(0, progress))
  let i = 0
  while (i < STOPS.length - 2 && p > STOPS[i + 1]) i++
  const t = (p - STOPS[i]) / (STOPS[i + 1] - STOPS[i])
  const a = ramp[i]
  const b = ramp[i + 1]
  return {
    l: round(lerp(a.l, b.l, t)),
    c: round(lerp(a.c, b.c, t)),
    h: round(lerpHue(a.h, b.h, t)),
  }
}

// 消浮点尾差，让端值精确命中 token
const round = (n: number) => Math.round(n * 1000) / 1000

export const skyAt = (progress: number): Oklch => rampAt(SKY, progress)
export const meadowAt = (progress: number): Oklch => rampAt(MEADOW, progress)

export const oklchCss = (c: Oklch): string => `oklch(${c.l} ${c.c} ${c.h})`

// 空气透视：base 向天空色混 amount（0~1）
export function hazeMix(base: Oklch, sky: Oklch, amount: number): Oklch {
  return {
    l: round(lerp(base.l, sky.l, amount)),
    c: round(lerp(base.c, sky.c, amount)),
    h: round(lerpHue(base.h, sky.h, amount)),
  }
}

// 年份 → 路程。0.08~0.88，序章/终点留白
export function progressForYear(year: number, birthYear: number, nowYear: number): number {
  const t = (year - birthYear) / Math.max(1, nowYear - birthYear)
  return round(0.08 + Math.min(1, Math.max(0, t)) * 0.8)
}

// progress → 年份（HUD 路标用），钳在 [birthYear, nowYear]
export function yearForProgress(progress: number, birthYear: number, nowYear: number): number {
  const t = (progress - 0.08) / 0.8
  const y = Math.round(birthYear + Math.min(1, Math.max(0, t)) * (nowYear - birthYear))
  return y
}

export function phaseAt(progress: number): Phase {
  if (progress < 0.2) return 'dawn'
  if (progress < 0.55) return 'day'
  if (progress < 0.85) return 'dusk'
  return 'night'
}
