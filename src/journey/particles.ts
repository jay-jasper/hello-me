// Canvas 2D 粒子层：幕1 蒲公英絮 / 幕2 金尘 / 幕3 流星+火星+星闪。
// 密度随各幕透明度过渡；≤400 粒，DPR ≤ 2。

import { frameOpacity } from './acts'

export type Particles = { update(progress: number): void }

type P = { x: number; y: number; vx: number; vy: number; r: number; seed: number; kind: 1 | 2 | 3 }

export function createParticles(canvas: HTMLCanvasElement, mobile: boolean): Particles {
  const ctx = canvas.getContext('2d')!
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const W = window.innerWidth
  const H = window.innerHeight
  canvas.width = W * dpr
  canvas.height = H * dpr
  ctx.scale(dpr, dpr)

  const N = mobile ? 200 : 400
  const pool: P[] = []
  for (let i = 0; i < N; i++) {
    const kind = ((i % 3) + 1) as 1 | 2 | 3
    pool.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: 0,
      vy: 0,
      r: 1 + Math.random() * 2.2,
      seed: Math.random(),
      kind,
    })
  }

  // 流星池
  const meteors = Array.from({ length: 3 }, () => ({ t: 3 + Math.random() * 3, active: false, x: 0, y: 0, life: 0 }))
  // 篝火位置（第三幕帧内人物旁，视口比例）
  const FIRE = { x: 0.56, y: 0.8 }

  let last = performance.now()

  function update(progress: number) {
    const now = performance.now()
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    ctx.clearRect(0, 0, W, H)

    const o1 = frameOpacity(1, progress)
    const o2 = frameOpacity(2, progress)
    const o3 = frameOpacity(3, progress)

    for (const p of pool) {
      // 各 kind 只在对应幕显形，透明度乘该幕 opacity
      const alpha = p.kind === 1 ? o1 : p.kind === 2 ? o2 : o3
      if (alpha < 0.02) continue

      if (p.kind === 1) {
        // 蒲公英絮：缓慢横漂 + 上浮 + 摇曳
        p.vx += (14 + p.seed * 12 - p.vx) * 0.02
        p.vy += (-6 - p.seed * 8 - p.vy) * 0.02
        p.x += p.vx * dt + Math.sin(now * 0.001 + p.seed * 10) * 0.4
        p.y += p.vy * dt
        ctx.fillStyle = `oklch(0.97 0.02 90 / ${0.5 * alpha * (0.4 + p.seed * 0.6)})`
      } else if (p.kind === 2) {
        // 金尘：悬浮微闪
        p.x += Math.sin(now * 0.0008 + p.seed * 20) * 0.25
        p.y += Math.cos(now * 0.0006 + p.seed * 14) * 0.2 - 2 * dt
        const tw = 0.5 + 0.5 * Math.sin(now * 0.003 + p.seed * 30)
        ctx.fillStyle = `oklch(0.85 0.12 75 / ${0.55 * alpha * tw})`
      } else {
        // 幕3：上 60% 是星（微闪、不动），下方近火处是火星（上升）
        const isEmber = p.seed < 0.3
        if (isEmber) {
          p.y -= (26 + p.seed * 40) * dt
          p.x += Math.sin(now * 0.004 + p.seed * 40) * 0.5
          if (p.y < H * FIRE.y - H * 0.3 || p.y > H) {
            p.x = W * FIRE.x + (Math.random() - 0.5) * 30
            p.y = H * FIRE.y + Math.random() * 10
          }
          ctx.fillStyle = `oklch(0.75 0.16 50 / ${0.8 * alpha * (0.3 + p.seed)})`
        } else {
          const tw = 0.4 + 0.6 * Math.abs(Math.sin(now * 0.0015 + p.seed * 50))
          if (p.y > H * 0.6) p.y = Math.random() * H * 0.55 // 星只在上空
          ctx.fillStyle = `oklch(0.95 0.02 90 / ${0.7 * alpha * tw})`
        }
      }
      if (p.x > W + 10) p.x -= W + 20
      if (p.x < -10) p.x += W + 20
      if (p.y < -10) p.y += H + 20
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fill()
    }

    // 流星（幕3，3~6s 一颗，划向右下）
    if (o3 > 0.5 && !mobile) {
      for (const m of meteors) {
        if (!m.active) {
          m.t -= dt
          if (m.t <= 0) {
            m.active = true
            m.life = 1
            m.x = W * (0.1 + Math.random() * 0.6)
            m.y = H * (0.05 + Math.random() * 0.2)
          }
        } else {
          const sp = 560
          const nx = m.x + sp * dt
          const ny = m.y + sp * 0.48 * dt
          const grad = ctx.createLinearGradient(m.x - 90, m.y - 43, nx, ny)
          grad.addColorStop(0, 'oklch(0.95 0.02 90 / 0)')
          grad.addColorStop(1, `oklch(0.97 0.01 90 / ${0.9 * m.life * o3})`)
          ctx.strokeStyle = grad
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.moveTo(m.x - 90, m.y - 43)
          ctx.lineTo(nx, ny)
          ctx.stroke()
          m.x = nx
          m.y = ny
          m.life -= dt * 0.9
          if (m.life <= 0) {
            m.active = false
            m.t = 3 + Math.random() * 3
          }
        }
      }
    }
  }

  return { update }
}
