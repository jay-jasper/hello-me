// 活跃涟漪的环形缓冲。满了踢最旧的。pack 出的 Float32Array 直接喂 shader uniform。
export type Ripple = { x: number; t0: number; amp: number; pitch: number; self: boolean }

// 衰减率随音高的映射：低音（pitch→0）慢衰减、长余韵；高音（pitch→1）快衰减、短余韵。
// 唯一定义在这里——water.ts 的 WebGL shader（GLSL mix）与 Canvas 2D 降级路径都从这两个
// 常量算出同一条衰减曲线，不允许各自抄一份数字导致三处漂移。
export const MIN_DECAY = 0.45 // 最低音（pitch=0）的衰减率
export const MAX_DECAY = 1.7 // 最高音（pitch=1）的衰减率

export function decayRateFor(pitch: number): number {
  return MIN_DECAY + (MAX_DECAY - MIN_DECAY) * pitch
}

// 振幅包络是 exp(-decay * age)，与音高、力度无关（那些只缩放振幅，不改变形状）。
// 认为衰减到初始振幅的 1% 以下就已经视觉不可见，据此反解每条涟漪自己的存活时长：
// age = ln(1/0.01) / decay。最慢的衰减（decay=0.45，最低音）算出来约 10.2 秒；
// 之前写死的 6 秒在 decay=0.45 时 exp(-0.45*6) ≈ 6.7%，仍清晰可见，等于砍断了低音本该
// 有的长余韵——这正是"低音慢衰减"这条设计要求要保证的效果。
const AUDIBLE_FLOOR = 0.01
const LIFETIME_LN = Math.log(1 / AUDIBLE_FLOOR) // ln(100) ≈ 4.6052

export function lifetimeFor(pitch: number): number {
  return LIFETIME_LN / decayRateFor(pitch)
}

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
        // 按各自音高反解出的存活时长做截断，而不是一刀切的常量：
        // 高音本来就该早点被踢掉（省计算），低音则要留够长的余韵。
        if (age < 0 || age > lifetimeFor(r.pitch)) continue
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
