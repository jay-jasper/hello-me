// WebGL 粒子层：单 Points ≤2000 + 流星小池。形态随路段切换，风向 = 行进反向。
// WebGL 不可用返回 null，调用方直接跳过（CSS 场景完整）。

import * as THREE from 'three'
import { phaseAt, type Phase } from './journey'

export type Particles = {
  update(progress: number, velocity: number): void
  burst(): void // 启程签名时刻：风粒子脉冲
  meteorShower(on: boolean): void // 终点流星群密度
}

const COUNT_DESKTOP = 2000
const METEORS = 10

// 各相位粒子基色 [r,g,b] 0~1
const PHASE_COLOR: Record<Phase, [number, number, number]> = {
  dawn: [1.0, 0.95, 0.86], // 暖白种子/雾尘
  day: [1.0, 0.97, 0.92], // 花瓣草絮
  dusk: [1.0, 0.85, 0.55], // 金色浮尘
  night: [0.75, 0.72, 1.0], // 蓝月草辉光/星
}

// 各相位可见密度（seed 阈值）：稀疏是构图律，池满而灯稀
const PHASE_DENSITY: Record<Phase, number> = {
  dawn: 0.14,
  day: 0.22,
  dusk: 0.18,
  night: 0.3,
}

function softSprite(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

function streakSprite(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 16
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 128, 0)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(0.85, 'rgba(255,255,255,0.9)')
  grad.addColorStop(1, 'rgba(255,255,255,1)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 16)
  return new THREE.CanvasTexture(c)
}

export function createParticles(container: HTMLElement, mobile: boolean): Particles | null {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false })
  } catch {
    return null
  }

  const W = window.innerWidth
  const H = window.innerHeight
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio)) // DPR ≤ 2
  renderer.setSize(W, H)
  renderer.domElement.className = 'particle-canvas'
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(0, W, 0, H, -10, 10) // y 向下，同屏幕坐标
  const count = mobile ? COUNT_DESKTOP / 2 : COUNT_DESKTOP

  // ---- 主粒子池 ----
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const vel = new Float32Array(count * 2)
  const seed = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    pos[i * 3] = Math.random() * W
    pos[i * 3 + 1] = Math.random() * H
    seed[i] = Math.random()
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const mat = new THREE.PointsMaterial({
    size: 3,
    map: softSprite(),
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  scene.add(new THREE.Points(geo, mat))

  // ---- 星星（夜空固定，渐显） ----
  const starCount = mobile ? 120 : 240
  const starPos = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i++) {
    starPos[i * 3] = Math.random() * W
    starPos[i * 3 + 1] = Math.random() * H * 0.6 // 上 60% 天区
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  const starMat = new THREE.PointsMaterial({
    size: 2,
    map: softSprite(),
    color: 0xfff6e8,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  scene.add(new THREE.Points(starGeo, starMat))

  // ---- 流星池（拉长 sprite，移动端关） ----
  const meteors: THREE.Sprite[] = []
  if (!mobile) {
    const tex = streakSprite()
    for (let i = 0; i < METEORS; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
        }),
      )
      s.scale.set(140, 10, 1)
      s.material.rotation = -Math.PI / 7 // 划向行进方向前方（右下）
      scene.add(s)
      meteors.push(s)
    }
  }
  const meteorState = meteors.map(() => ({ t: 2 + Math.random() * 4, active: false, x: 0, y: 0 }))
  let shower = false

  let burstPower = 0
  let last = performance.now()

  function update(progress: number, velocity: number) {
    const now = performance.now()
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now

    const phase = phaseAt(progress)
    const base = PHASE_COLOR[phase]
    const wind = -velocity * W * 6 - burstPower // 行进反向 + 启程脉冲
    burstPower *= 0.94

    for (let i = 0; i < count; i++) {
      const s = seed[i]
      // 相位速度个性：晨升、昼飘落、昏悬浮、夜浮游
      const drift =
        phase === 'dawn' ? -8 - s * 10 : phase === 'day' ? 10 + s * 14 : phase === 'dusk' ? 3 - s * 6 : -4 + s * 8
      vel[i * 2] += (wind * (0.4 + s * 0.6) - vel[i * 2]) * 0.05
      vel[i * 2 + 1] += (drift - vel[i * 2 + 1]) * 0.03
      let x = pos[i * 3] + vel[i * 2] * dt + Math.sin(now * 0.001 + s * 20) * 0.3
      let y = pos[i * 3 + 1] + vel[i * 2 + 1] * dt
      if (x < -20) x += W + 40
      if (x > W + 20) x -= W + 40
      if (y < -20) y += H + 40
      if (y > H + 20) y -= H + 40
      pos[i * 3] = x
      pos[i * 3 + 1] = y
      // 颜色向相位基色缓动；seed 超过相位密度阈值的粒子隐去（加色混合下黑=不可见）
      const density = PHASE_DENSITY[phase]
      const vis = s < density ? 0.35 + (s / density) * 0.65 : 0
      col[i * 3] += (base[0] * vis - col[i * 3]) * 0.02
      col[i * 3 + 1] += (base[1] * vis - col[i * 3 + 1]) * 0.02
      col[i * 3 + 2] += (base[2] * vis - col[i * 3 + 2]) * 0.02
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true

    // 夜段星星渐显
    const night = progress > 0.72 ? Math.min(1, (progress - 0.72) / 0.16) : 0
    starMat.opacity = night * 0.9

    // 流星
    if (night > 0.5) {
      for (let i = 0; i < meteors.length; i++) {
        const m = meteorState[i]
        const sp = meteors[i]
        if (!m.active) {
          m.t -= dt
          if (m.t <= 0) {
            m.active = true
            m.x = Math.random() * W * 0.9
            m.y = Math.random() * H * 0.3
            sp.material.opacity = 0.9
          }
        } else {
          m.x += 620 * dt
          m.y += 300 * dt
          sp.material.opacity -= dt * 1.1
          if (sp.material.opacity <= 0) {
            m.active = false
            m.t = (shower ? 0.4 : 2.5) + Math.random() * (shower ? 1 : 4)
          }
        }
        sp.position.set(m.x, m.y, 0)
      }
    } else {
      for (const sp of meteors) sp.material.opacity = 0
    }

    renderer.render(scene, camera)
  }

  return {
    update,
    burst() {
      burstPower = 260
    },
    meteorShower(on: boolean) {
      shower = on
    },
  }
}
