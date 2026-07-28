// 88 键的纯几何。x / w 都是 0–1 归一化，渲染与水面都用这套坐标。

export type KeyGeom = { midi: number; black: boolean; x: number; w: number }

const LOW = 21 // A0
const HIGH = 108 // C8
const BLACK_PC = new Set([1, 3, 6, 8, 10])
const WHITE_COUNT = 52
const WHITE_W = 1 / WHITE_COUNT
// 真琴上黑键宽约为白键的 0.55–0.58，取 0.56；0.62 会显得又胖又挤
const BLACK_W = WHITE_W * 0.56

function build(): KeyGeom[] {
  const out: KeyGeom[] = []
  let whiteIndex = 0
  for (let midi = LOW; midi <= HIGH; midi++) {
    const black = BLACK_PC.has(midi % 12)
    if (black) {
      // 黑键压在刚放下的那个白键的右边界上
      out.push({ midi, black, x: whiteIndex * WHITE_W - BLACK_W / 2, w: BLACK_W })
    } else {
      out.push({ midi, black, x: whiteIndex * WHITE_W, w: WHITE_W })
      whiteIndex++
    }
  }
  return out
}

export const LAYOUT: KeyGeom[] = build()

const BY_MIDI = new Map(LAYOUT.map((k) => [k.midi, k]))

/** 键的水平中心，0–1。水面涟漪的发源点。 */
export function centerX(midi: number): number {
  const k = BY_MIDI.get(midi)
  if (!k) throw new Error(`midi ${midi} 不在 88 键内`)
  return k.x + k.w / 2
}

/** 音高归一化：A0 = 0，C8 = 1。决定涟漪的波长与颜色。 */
export function pitch01(midi: number): number {
  return (Math.min(HIGH, Math.max(LOW, midi)) - LOW) / (HIGH - LOW)
}

/** 电脑键盘 → 相对基准八度根音的半音偏移 */
export const KEY_MAP: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6,
  g: 7, y: 8, h: 9, u: 10, j: 11, k: 12,
}
