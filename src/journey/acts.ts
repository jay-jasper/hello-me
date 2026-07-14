// 旅路三幕纯逻辑：进度 → 帧透明度 / 推镜 / 年份；记忆 → 触发进度。零 DOM，node 可跑。

export type Act = 1 | 2 | 3
export type Slot = { index: number; year: number; act: 1 | 2; trigger: number; slotIndex: number }

const CF = 1 / 18 // 渐变带半宽（整带 ≈ 1/9 ≈ 1 屏 / 9 屏）
const B1 = 1 / 3 // 幕1→幕2 边界
const B2 = 2 / 3 // 幕2→幕3 边界

const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const round3 = (n: number) => Math.round(n * 1000) / 1000

/** 三帧透明度：渐变带内线性过渡，任意进度三者之和 = 1 */
export function frameOpacity(act: Act, p: number): number {
  const up = (edge: number) => clamp01((p - (edge - CF)) / (2 * CF)) // 0→1 经过 edge
  if (act === 1) return round3(1 - up(B1))
  if (act === 2) return round3(up(B1) - up(B2))
  return round3(up(B2))
}

export function actAt(p: number): Act {
  return p < B1 ? 1 : p < B2 ? 2 : 3
}

/** 幕内推镜：scale 1.02→1.07，向画面焦点轻移（% 单位，act2 反向增加变化） */
export function kenBurns(act: Act, p: number): { scale: number; tx: number; ty: number } {
  const local = clamp01((p - (act - 1) * (1 / 3)) / (1 / 3))
  return {
    scale: round3(1.02 + 0.05 * local),
    tx: round3((act === 2 ? 1 : -1) * 1.2 * local),
    ty: round3(-0.8 * local),
  }
}

/** 记忆分幕与触发进度：≤ birthYear+22 归幕1，否则幕2；某幕为空则对半分。幕内均布、避开渐变带 */
export function layout(years: number[], birthYear: number): Slot[] {
  const thr = birthYear + 22
  let acts: (1 | 2)[] = years.map((y) => (y <= thr ? 1 : 2))
  if (!acts.includes(1) || !acts.includes(2)) {
    acts = years.map((_, i) => (i < Math.ceil(years.length / 2) ? 1 : 2))
  }
  const slots: Slot[] = []
  for (const act of [1, 2] as const) {
    const idx = years.map((_, i) => i).filter((i) => acts[i] === act)
    const start = (act - 1) / 3 + 2 * CF
    const span = 1 / 3 - 4 * CF
    idx.forEach((memIndex, j) => {
      slots.push({
        index: memIndex,
        year: years[memIndex],
        act,
        trigger: round3(start + ((j + 1) / (idx.length + 1)) * span),
        slotIndex: j,
      })
    })
  }
  return slots.sort((a, b) => a.trigger - b.trigger)
}

/** HUD 年份：过 (0,出生) 与各记忆点的分段线性，第三幕恒为当下 */
export function yearAt(p: number, slots: Slot[], birthYear: number, nowYear: number): number {
  const pts: [number, number][] = [[0, birthYear], ...slots.map((s) => [s.trigger, s.year] as [number, number]), [B2, nowYear]]
  if (p >= B2) return nowYear
  for (let i = 1; i < pts.length; i++) {
    if (p <= pts[i][0]) {
      const [x0, y0] = pts[i - 1]
      const [x1, y1] = pts[i]
      return Math.round(y0 + ((p - x0) / Math.max(1e-6, x1 - x0)) * (y1 - y0))
    }
  }
  return nowYear
}
