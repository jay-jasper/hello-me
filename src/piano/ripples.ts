// 活跃涟漪的环形缓冲。满了踢最旧的。pack 出的 Float32Array 直接喂 shader uniform。
export type Ripple = { x: number; t0: number; amp: number; pitch: number; self: boolean }

export function createRipples(cap: number) {
  const items: Ripple[] = []

  return {
    get capacity() {
      return cap
    },
    add(r: Ripple) {
      if (items.length >= cap) items.shift()
      items.push(r)
    },
    /** 打包成 vec4(x, t0, amp, ±pitch)，返回条数。self 用 pitch 的符号位表示。 */
    pack(now: number, out: Float32Array): number {
      let n = 0
      for (const r of items) {
        if (n >= cap) break
        const age = now - r.t0
        if (age < 0 || age > 6) continue // 6 秒后必然衰减殆尽
        out[n * 4 + 0] = r.x
        out[n * 4 + 1] = r.t0
        out[n * 4 + 2] = r.amp
        out[n * 4 + 3] = r.self ? -Math.max(0.001, r.pitch) : r.pitch
        n++
      }
      return n
    },
  }
}
