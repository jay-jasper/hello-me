import * as THREE from 'three'
import type { Mood } from './main'

// 世界坐标约定：1 unit = 100px（S），y 向下为负；相机在 z=10 看向 z=0 内容平面。
const S = 0.01
const CAM_Z = 10

type Kind = 'milestone' | 'moment'
type Marker = { x: number; y: number; kind: Kind }
type Opts = { reduced: boolean; coarse: boolean; mood: Mood }

const COLORS = {
  snow: 0xcfe4ee,
  lureCore: 0xffd9ad,
  lureHalo: 0xf2a35e,
  planktonCore: 0xbfe9f2,
  planktonHalo: 0x4b93a7,
  seabed: 0xf2a35e,
}

function radialTexture(stops: [number, string][]): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  for (const [o, col] of stops) grad.addColorStop(o, col)
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  dither(c, 4)
  return new THREE.CanvasTexture(c)
}

// 抖动：给 alpha 通道加噪点，打碎大面积低透明度渐变的色阶断层（banding）
function dither(c: HTMLCanvasElement, amp = 6) {
  const g = c.getContext('2d')!
  const img = g.getImageData(0, 0, c.width, c.height)
  const d = img.data
  for (let i = 3; i < d.length; i += 4) {
    const a = d[i]!
    if (a > 0 && a < 250) d[i] = Math.max(0, Math.min(255, a + (Math.random() * 2 - 1) * amp))
  }
  g.putImageData(img, 0, 0)
}

// 整个表层光（光晕 + 参差光柱）烘焙成一张抖动过的贴图，单次绘制，无叠加伪影
function surfaceLightTexture(): THREE.CanvasTexture {
  const W = 1024
  const H = 768
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  // 光晕
  const halo = g.createRadialGradient(512, 210, 0, 512, 210, 320)
  halo.addColorStop(0, 'rgba(255,255,255,0.9)')
  halo.addColorStop(0.3, 'rgba(255,255,255,0.42)')
  halo.addColorStop(0.65, 'rgba(255,255,255,0.1)')
  halo.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = halo
  g.fillRect(0, 0, W, H)
  // 光柱：位置/宽度/长度/亮度各不相同，向下渐隐
  const shafts: [number, number, number, number, number][] = [
    // [x, 顶宽, 长度, 倾斜, 亮度]
    [150, 60, 500, 0.06, 0.16],
    [340, 110, 640, 0.02, 0.24],
    [510, 150, 700, -0.01, 0.3],
    [690, 80, 560, -0.04, 0.2],
    [880, 120, 620, -0.07, 0.22],
  ]
  g.filter = 'blur(16px)' // 侧边羽化，光柱不再是硬边梯形
  for (const [x, w, len, tilt, amp] of shafts) {
    const grad = g.createLinearGradient(0, 60, 0, 60 + len)
    grad.addColorStop(0, `rgba(255,255,255,${amp})`)
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.beginPath()
    g.moveTo(x - w / 2, 20)
    g.lineTo(x + w / 2, 20)
    g.lineTo(x + w * 0.32 + tilt * len, 40 + len)
    g.lineTo(x - w * 0.32 + tilt * len, 40 + len)
    g.closePath()
    g.fill()
  }
  g.filter = 'none'
  dither(c, 7)
  return new THREE.CanvasTexture(c)
}

/* ---------- 物种剪影（白色绘制，材质染色） ---------- */

function speciesTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = '#fff'
  g.strokeStyle = '#fff'
  draw(g)
  return new THREE.CanvasTexture(c)
}

const TAU = Math.PI * 2

const drawSardine = (g: CanvasRenderingContext2D) => {
  g.beginPath()
  g.ellipse(56, 32, 30, 9, 0, 0, TAU)
  g.fill()
  g.beginPath()
  g.moveTo(84, 32)
  g.lineTo(104, 22)
  g.lineTo(104, 42)
  g.closePath()
  g.fill()
}

const drawTurtle = (g: CanvasRenderingContext2D) => {
  g.beginPath()
  g.ellipse(64, 34, 26, 17, 0, 0, TAU)
  g.fill()
  g.beginPath()
  g.ellipse(30, 30, 9, 7, 0, 0, TAU)
  g.fill()
  for (const [x, y, rx, ry, rot] of [
    [50, 15, 12, 4.5, -0.5],
    [80, 16, 10, 4, 0.5],
    [54, 53, 10, 4, 0.5],
    [82, 51, 9, 4, -0.4],
  ] as const) {
    g.beginPath()
    g.ellipse(x, y, rx, ry, rot, 0, TAU)
    g.fill()
  }
}

const drawManta = (g: CanvasRenderingContext2D) => {
  g.beginPath()
  g.moveTo(8, 42)
  g.quadraticCurveTo(56, 2, 64, 30)
  g.quadraticCurveTo(72, 2, 120, 42)
  g.quadraticCurveTo(64, 56, 8, 42)
  g.fill()
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(64, 48)
  g.lineTo(100, 60)
  g.stroke()
}

const drawJelly = (g: CanvasRenderingContext2D) => {
  g.globalAlpha = 0.55
  g.beginPath()
  g.arc(32, 32, 24, Math.PI, 0)
  g.quadraticCurveTo(32, 44, 8, 32)
  g.fill()
  g.globalAlpha = 0.9
  g.beginPath()
  g.arc(32, 26, 12, Math.PI, 0)
  g.fill()
  g.lineWidth = 2
  g.globalAlpha = 0.65
  for (let i = 0; i < 5; i++) {
    const x = 14 + i * 9
    g.beginPath()
    g.moveTo(x, 38)
    g.quadraticCurveTo(x + 5, 70, x - 3, 108)
    g.stroke()
  }
}

const drawLantern = (g: CanvasRenderingContext2D) => {
  g.globalAlpha = 0.3
  drawSardine(g)
  g.globalAlpha = 1
  for (const [x, y] of [
    [34, 38],
    [46, 40],
    [58, 40],
    [70, 38],
    [30, 29],
  ] as const) {
    g.beginPath()
    g.arc(x, y, 2.6, 0, TAU)
    g.fill()
  }
}

const drawSquid = (g: CanvasRenderingContext2D) => {
  g.beginPath()
  g.moveTo(14, 32)
  g.lineTo(66, 21)
  g.lineTo(66, 43)
  g.closePath()
  g.fill()
  g.beginPath()
  g.arc(74, 32, 9, 0, TAU)
  g.fill()
  g.lineWidth = 2.5
  g.globalAlpha = 0.8
  for (const dy of [-6, -2, 2, 6]) {
    g.beginPath()
    g.moveTo(82, 32 + dy * 0.6)
    g.quadraticCurveTo(96, 32 + dy, 112, 32 + dy * 1.6)
    g.stroke()
  }
}

const drawDumbo = (g: CanvasRenderingContext2D) => {
  g.beginPath()
  g.arc(48, 52, 22, 0, TAU)
  g.fill()
  g.beginPath()
  g.ellipse(30, 26, 10, 6, -0.4, 0, TAU)
  g.fill()
  g.beginPath()
  g.ellipse(66, 26, 10, 6, 0.4, 0, TAU)
  g.fill()
  g.globalAlpha = 0.6
  g.lineWidth = 3
  for (const dx of [-10, -3, 4, 11]) {
    g.beginPath()
    g.moveTo(48 + dx, 70)
    g.quadraticCurveTo(48 + dx * 1.4, 80, 48 + dx, 88)
    g.stroke()
  }
}

const drawGulper = (g: CanvasRenderingContext2D) => {
  g.lineWidth = 5
  g.globalAlpha = 0.45
  g.beginPath()
  g.moveTo(8, 38)
  g.quadraticCurveTo(36, 26, 60, 36)
  g.quadraticCurveTo(84, 46, 100, 32)
  g.stroke()
  g.globalAlpha = 0.7
  g.beginPath()
  g.ellipse(104, 31, 13, 8, -0.15, 0, TAU)
  g.fill()
}

const drawAngler = (g: CanvasRenderingContext2D) => {
  g.globalAlpha = 0.18
  g.beginPath()
  g.arc(76, 38, 21, 0, TAU)
  g.fill()
  g.beginPath()
  g.moveTo(56, 34)
  g.lineTo(30, 44)
  g.lineTo(58, 50)
  g.closePath()
  g.fill()
  g.globalAlpha = 0.5
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(66, 18)
  g.quadraticCurveTo(48, 4, 36, 10)
  g.stroke()
  g.globalAlpha = 1
  g.beginPath()
  g.arc(34, 10, 4.5, 0, TAU)
  g.fill()
}

const drawTuna = (g: CanvasRenderingContext2D) => {
  g.beginPath()
  g.ellipse(56, 32, 34, 11, 0, 0, TAU)
  g.fill()
  g.beginPath()
  g.moveTo(86, 32)
  g.quadraticCurveTo(96, 30, 108, 18)
  g.quadraticCurveTo(102, 32, 108, 46)
  g.quadraticCurveTo(96, 34, 86, 32)
  g.fill()
  g.beginPath()
  g.moveTo(48, 22)
  g.lineTo(58, 8)
  g.lineTo(66, 22)
  g.closePath()
  g.fill()
}

const drawWhale = (g: CanvasRenderingContext2D) => {
  g.beginPath()
  g.moveTo(8, 38)
  g.quadraticCurveTo(30, 14, 70, 18)
  g.quadraticCurveTo(96, 20, 108, 30)
  g.lineTo(122, 18)
  g.quadraticCurveTo(116, 30, 122, 46)
  g.lineTo(106, 36)
  g.quadraticCurveTo(80, 48, 40, 46)
  g.quadraticCurveTo(18, 44, 8, 38)
  g.fill()
  g.beginPath()
  g.ellipse(46, 44, 10, 4, 0.5, 0, TAU)
  g.fill()
}

const drawHatchet = (g: CanvasRenderingContext2D) => {
  g.beginPath()
  g.ellipse(32, 42, 13, 24, 0, 0, TAU)
  g.fill()
  g.beginPath()
  g.moveTo(42, 40)
  g.lineTo(56, 36)
  g.lineTo(56, 46)
  g.closePath()
  g.fill()
  g.globalAlpha = 1
  for (let i = 0; i < 4; i++) {
    g.beginPath()
    g.arc(24 + i * 5, 62, 1.8, 0, TAU)
    g.fill()
  }
}

const drawKrill = (g: CanvasRenderingContext2D) => {
  g.beginPath()
  g.ellipse(28, 32, 8, 5, -0.3, 0, TAU)
  g.fill()
  g.lineWidth = 2
  g.globalAlpha = 0.7
  g.beginPath()
  g.moveTo(34, 34)
  g.quadraticCurveTo(44, 38, 50, 34)
  g.stroke()
  g.beginPath()
  g.moveTo(22, 28)
  g.lineTo(12, 22)
  g.stroke()
}

const drawCombJelly = (g: CanvasRenderingContext2D) => {
  g.globalAlpha = 0.5
  g.beginPath()
  g.ellipse(32, 48, 18, 30, 0, 0, TAU)
  g.fill()
  g.globalAlpha = 1
  g.lineWidth = 2
  for (const dx of [-10, 0, 10]) {
    g.beginPath()
    g.moveTo(32 + dx, 20)
    g.quadraticCurveTo(32 + dx * 1.5, 48, 32 + dx, 76)
    g.stroke()
  }
}

const drawBarreleye = (g: CanvasRenderingContext2D) => {
  g.globalAlpha = 0.35
  g.beginPath()
  g.ellipse(60, 34, 26, 16, 0, 0, TAU)
  g.fill()
  g.beginPath()
  g.moveTo(84, 34)
  g.lineTo(100, 26)
  g.lineTo(100, 42)
  g.closePath()
  g.fill()
  g.globalAlpha = 1
  g.beginPath()
  g.arc(48, 28, 5, 0, TAU)
  g.fill()
}

const drawViperfish = (g: CanvasRenderingContext2D) => {
  g.lineWidth = 6
  g.globalAlpha = 0.4
  g.beginPath()
  g.moveTo(112, 32)
  g.quadraticCurveTo(70, 24, 40, 34)
  g.quadraticCurveTo(24, 39, 12, 34)
  g.stroke()
  g.globalAlpha = 0.6
  g.beginPath()
  g.moveTo(112, 26)
  g.lineTo(124, 20)
  g.lineTo(118, 32)
  g.closePath()
  g.fill()
  g.globalAlpha = 1
  for (let i = 0; i < 6; i++) {
    g.beginPath()
    g.arc(34 + i * 14, 38 - i * 1.2, 1.6, 0, TAU)
    g.fill()
  }
}

const drawShrimp = (g: CanvasRenderingContext2D) => {
  g.lineWidth = 5
  g.globalAlpha = 0.8
  g.beginPath()
  g.arc(32, 28, 12, 0.3, Math.PI * 0.9)
  g.stroke()
  g.lineWidth = 1.5
  g.beginPath()
  g.moveTo(44, 24)
  g.lineTo(56, 14)
  g.moveTo(44, 26)
  g.lineTo(58, 22)
  g.stroke()
}

type Behavior = 'school' | 'glide' | 'drift' | 'dart'
type FishSpec = {
  key: string
  wh: [number, number]
  draw: (g: CanvasRenderingContext2D) => void
  count: number
  countCoarse: number // 0 = 移动端不出场
  depth: [number, number] // 米
  size: [number, number] // 世界单位（宽）
  speed: number
  wobble: number
  behavior: Behavior
  color: number
  opacity: number
  additive: boolean
  pods?: number // 拆成几群散布在深度带内（默认 1）
  z?: number // 所在层（默认 -1；更远 = 背景剪影）
}

// 深度分带的物种表：浅层是逆光剪影，深层只剩生物荧光。
// 深度带刻意重叠，任何深度同屏 3~5 种。
const FISH_SPECS: FishSpec[] = [
  // —— 阳光层 ——
  { key: 'sardine', wh: [128, 64], draw: drawSardine, count: 34, countCoarse: 16, depth: [30, 170], size: [0.45, 0.65], speed: 1.5, wobble: 0.25, behavior: 'school', color: 0x3d5a7a, opacity: 0.9, additive: false, pods: 2 },
  { key: 'tuna', wh: [128, 64], draw: drawTuna, count: 5, countCoarse: 3, depth: [60, 220], size: [0.8, 1.1], speed: 1.1, wobble: 0.18, behavior: 'school', color: 0x2c455e, opacity: 0.9, additive: false },
  { key: 'turtle', wh: [128, 64], draw: drawTurtle, count: 1, countCoarse: 1, depth: [80, 200], size: [2.0, 2.4], speed: 0.22, wobble: 0.12, behavior: 'glide', color: 0x24384e, opacity: 0.95, additive: false },
  { key: 'manta', wh: [128, 64], draw: drawManta, count: 1, countCoarse: 0, depth: [140, 300], size: [2.9, 3.4], speed: 0.45, wobble: 0.15, behavior: 'glide', color: 0x1e3044, opacity: 0.95, additive: false },
  { key: 'whale', wh: [128, 64], draw: drawWhale, count: 1, countCoarse: 1, depth: [180, 360], size: [5.6, 6.4], speed: 0.12, wobble: 0.1, behavior: 'glide', color: 0x14263a, opacity: 0.9, additive: false, z: -6 },
  // —— 暮光层 ——
  { key: 'krill', wh: [64, 64], draw: drawKrill, count: 24, countCoarse: 12, depth: [200, 500], size: [0.12, 0.2], speed: 0.25, wobble: 0.35, behavior: 'school', color: 0x6fc4ce, opacity: 0.5, additive: true, pods: 2 },
  { key: 'jelly', wh: [64, 128], draw: drawJelly, count: 8, countCoarse: 4, depth: [230, 520], size: [0.8, 1.3], speed: 0.06, wobble: 0.22, behavior: 'drift', color: 0x7fd4de, opacity: 0.5, additive: true, pods: 2 },
  { key: 'hatchet', wh: [64, 96], draw: drawHatchet, count: 10, countCoarse: 5, depth: [300, 580], size: [0.35, 0.5], speed: 0.5, wobble: 0.25, behavior: 'school', color: 0xa8c4d4, opacity: 0.38, additive: true, pods: 2 },
  { key: 'lantern', wh: [128, 64], draw: drawLantern, count: 16, countCoarse: 8, depth: [350, 650], size: [0.4, 0.55], speed: 0.9, wobble: 0.3, behavior: 'school', color: 0xf2a35e, opacity: 0.8, additive: true, pods: 2 },
  { key: 'comb', wh: [64, 96], draw: drawCombJelly, count: 4, countCoarse: 2, depth: [350, 650], size: [0.5, 0.7], speed: 0.05, wobble: 0.2, behavior: 'drift', color: 0x9fb8e8, opacity: 0.4, additive: true },
  // —— 深渊层 ——
  { key: 'squid', wh: [128, 64], draw: drawSquid, count: 3, countCoarse: 2, depth: [450, 750], size: [1.2, 1.6], speed: 0.5, wobble: 0.1, behavior: 'dart', color: 0x9db8c9, opacity: 0.32, additive: true },
  { key: 'barreleye', wh: [128, 64], draw: drawBarreleye, count: 2, countCoarse: 1, depth: [550, 760], size: [0.7, 0.9], speed: 0.12, wobble: 0.12, behavior: 'glide', color: 0xbcd4de, opacity: 0.32, additive: true },
  { key: 'dumbo', wh: [96, 96], draw: drawDumbo, count: 1, countCoarse: 0, depth: [600, 850], size: [1.0, 1.2], speed: 0.08, wobble: 0.18, behavior: 'drift', color: 0xd8a8c0, opacity: 0.35, additive: true },
  { key: 'viper', wh: [128, 64], draw: drawViperfish, count: 2, countCoarse: 1, depth: [650, 890], size: [1.3, 1.6], speed: 0.25, wobble: 0.1, behavior: 'glide', color: 0xd9a06a, opacity: 0.42, additive: true },
  { key: 'shrimp', wh: [64, 64], draw: drawShrimp, count: 8, countCoarse: 4, depth: [700, 950], size: [0.18, 0.28], speed: 0.08, wobble: 0.3, behavior: 'drift', color: 0xe8b8a8, opacity: 0.45, additive: true, pods: 2 },
  { key: 'gulper', wh: [128, 64], draw: drawGulper, count: 1, countCoarse: 1, depth: [740, 940], size: [2.4, 2.8], speed: 0.18, wobble: 0.08, behavior: 'glide', color: 0x8fb4c9, opacity: 0.3, additive: true },
  { key: 'angler', wh: [128, 64], draw: drawAngler, count: 1, countCoarse: 1, depth: [800, 950], size: [1.6, 1.9], speed: 0.1, wobble: 0.06, behavior: 'glide', color: 0xf2a35e, opacity: 0.85, additive: true },
]

export function initAbyss(canvas: HTMLCanvasElement, opts: Opts) {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
    })
  } catch {
    return null
  }
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(devicePixelRatio, opts.coarse ? 1.5 : 2))

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60)
  camera.position.z = CAM_Z

  const softTex = radialTexture([
    [0, 'rgba(255,255,255,1)'],
    [0.35, 'rgba(255,255,255,0.32)'],
    [1, 'rgba(255,255,255,0)'],
  ])
  // 大尺寸光晕专用：长尾衰减，放大后不出现可见圆边（马赫带）
  const wideTex = radialTexture([
    [0, 'rgba(255,255,255,1)'],
    [0.2, 'rgba(255,255,255,0.5)'],
    [0.45, 'rgba(255,255,255,0.16)'],
    [0.75, 'rgba(255,255,255,0.03)'],
    [1, 'rgba(255,255,255,0)'],
  ])

  const makeSprite = (color: number, opacity: number) =>
    new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: softTex,
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )

  /* ---- 视口几何 ---- */
  let vw = innerWidth
  let vh = innerHeight
  const viewH = (z: number) => vh * S * ((CAM_Z - z) / CAM_Z)
  const viewW = (z: number) => viewH(z) * (vw / vh)

  /* ---- 海雪（远近两层） ---- */
  type SnowLayer = { points: THREE.Points; z: number; speeds: Float32Array; count: number }
  const snowLayers: SnowLayer[] = []

  function buildSnow() {
    for (const l of snowLayers) {
      scene.remove(l.points)
      l.points.geometry.dispose()
      ;(l.points.material as THREE.Material).dispose()
    }
    snowLayers.length = 0
    const defs = opts.coarse
      ? [
          { count: 90, z: -5, size: 0.05 },
          { count: 70, z: 2, size: 0.09 },
        ]
      : [
          { count: 220, z: -5, size: 0.05 },
          { count: 160, z: 2, size: 0.1 },
        ]
    for (const def of defs) {
      const pos = new Float32Array(def.count * 3)
      const speeds = new Float32Array(def.count)
      const w = viewW(def.z) * 1.5
      const h = viewH(def.z) * 3
      for (let i = 0; i < def.count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * w
        pos[i * 3 + 1] = (Math.random() - 0.5) * h
        pos[i * 3 + 2] = def.z
        speeds[i] = 0.02 + Math.random() * 0.05
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      const mat = new THREE.PointsMaterial({
        map: softTex,
        color: COLORS.snow,
        size: def.size,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const points = new THREE.Points(geo, mat)
      scene.add(points)
      snowLayers.push({ points, z: def.z, speeds, count: def.count })
    }
  }

  /* ---- 表层：天光（光晕+光柱一张贴图，颜色随现实时刻） ---- */
  const surfaceLight = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: surfaceLightTexture(),
      color: opts.mood.ray,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  surfaceLight.position.set(0, 0, -6)
  scene.add(surfaceLight)

  // 天体本体：小而亮的核，尺寸小到不会产生色阶断层
  const celestial = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: wideTex,
      color: opts.mood.sun,
      transparent: true,
      opacity: opts.mood.sunOp,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  celestial.scale.setScalar(4.5)
  celestial.position.set(0, 1.2, -5.9)
  scene.add(celestial)

  /* ---- 海底暖光 ---- */
  const seabedGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: wideTex,
      color: COLORS.seabed,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  seabedGlow.position.set(0, -100, -5)
  scene.add(seabedGlow)

  /* ---- 记忆生物 ---- */
  type Creature = {
    group: THREE.Group
    halo: THREE.Sprite
    core: THREE.Sprite
    phase: number
    baseHalo: number
    baseScale: number
  }
  let creatures: Creature[] = []

  function setMarkers(markers: Marker[]) {
    for (const c of creatures) scene.remove(c.group)
    creatures = markers.map((m, i) => {
      const milestone = m.kind === 'milestone'
      const baseScale = milestone ? 2.6 : 2.0
      const halo = makeSprite(milestone ? COLORS.lureHalo : COLORS.planktonHalo, milestone ? 0.4 : 0.32)
      halo.scale.setScalar(baseScale)
      const core = makeSprite(milestone ? COLORS.lureCore : COLORS.planktonCore, 0.95)
      core.scale.setScalar(milestone ? 0.5 : 0.38)
      const group = new THREE.Group()
      group.add(halo, core)
      group.position.set((m.x - vw / 2) * S, -m.y * S, 0)
      scene.add(group)
      return { group, halo, core, phase: i * 1.7, baseHalo: halo.material.opacity, baseScale }
    })
  }

  let seabedDocY = 0
  let ambient: THREE.Points | null = null
  function setSeabedY(docY: number) {
    seabedDocY = docY
    seabedGlow.position.y = -docY * S
    // 环境浮游生物：贯穿整条水柱的微光，非交互，让深处也有生命
    if (ambient) {
      scene.remove(ambient)
      ambient.geometry.dispose()
      ;(ambient.material as THREE.Material).dispose()
    }
    const count = opts.coarse ? 40 : 80
    const pos = new Float32Array(count * 3)
    const colH = docY * S
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * viewW(-2) * 1.3
      pos[i * 3 + 1] = -Math.random() * colH
      pos[i * 3 + 2] = -2 - Math.random() * 4
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    ambient = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        map: softTex,
        color: COLORS.planktonHalo,
        size: 0.14,
        transparent: true,
        opacity: 0.5,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    scene.add(ambient)
  }

  /* ---- 鱼群 ---- */
  type FishMember = { spr: THREE.Sprite; ox: number; oy: number; ph: number }
  type School = {
    spec: FishSpec
    x: number
    y: number
    vx: number
    dartT: number
    members: FishMember[]
  }
  let schools: School[] = []
  const fishTextures = new Map<string, THREE.CanvasTexture>()
  let depthToDocY: ((d: number) => number) | null = null

  function spawnFish() {
    if (!depthToDocY) return
    for (const sc of schools) {
      for (const m of sc.members) scene.remove(m.spr)
      ;(sc.members[0]?.spr.material as THREE.Material | undefined)?.dispose()
    }
    schools = []
    for (const spec of FISH_SPECS) {
      const count = opts.coarse ? spec.countCoarse : spec.count
      if (!count) continue
      let tex = fishTextures.get(spec.key)
      if (!tex) {
        tex = speciesTexture(spec.wh[0], spec.wh[1], spec.draw)
        fishTextures.set(spec.key, tex)
      }
      const mat = new THREE.SpriteMaterial({
        map: tex,
        color: spec.color,
        transparent: true,
        opacity: spec.opacity,
        blending: spec.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: false,
      })
      const z = spec.z ?? -1
      const pods = spec.pods ?? 1
      const podCount = Math.max(1, Math.round(count / pods))
      const band = (spec.depth[1] - spec.depth[0]) / pods
      for (let p = 0; p < pods; p++) {
        // 各群占带内一段，避免重叠成一坨
        const d = spec.depth[0] + band * (p + 0.15 + Math.random() * 0.7)
        const school: School = {
          spec,
          x: (Math.random() - 0.5) * viewW(z),
          y: -depthToDocY(d) * S,
          vx: spec.speed * (Math.random() < 0.5 ? -1 : 1),
          dartT: 1 + Math.random() * 3,
          members: [],
        }
        const radius = Math.sqrt(podCount) * 0.55
        for (let i = 0; i < podCount; i++) {
          const spr = new THREE.Sprite(mat)
          const w = spec.size[0] + Math.random() * (spec.size[1] - spec.size[0])
          spr.scale.set(w, (w * spec.wh[1]) / spec.wh[0], 1)
          const a = Math.random() * TAU
          const r = Math.sqrt(Math.random()) * radius
          const member = { spr, ox: Math.cos(a) * r * 1.6, oy: Math.sin(a) * r * 0.7, ph: Math.random() * TAU }
          spr.position.set(school.x + member.ox, school.y + member.oy, z)
          scene.add(spr)
          school.members.push(member)
        }
        schools.push(school)
      }
    }
  }

  function setDepthMap(fn: (d: number) => number) {
    depthToDocY = fn
    spawnFish()
  }

  function updateFish(t: number, dt: number) {
    for (const sc of schools) {
      // 远离镜头的带不活动
      if (Math.abs(sc.y - camera.position.y) > viewH(0) * 2.2) continue
      const spec = sc.spec
      const z = spec.z ?? -1
      if (!opts.reduced) {
        if (spec.behavior === 'dart') {
          sc.dartT -= dt
          if (sc.dartT <= 0) {
            sc.dartT = 2.5 + Math.random() * 4
            sc.vx = (Math.random() < 0.5 ? -1 : 1) * spec.speed * 3.5
          }
          sc.vx *= 0.995
        }
        sc.x += sc.vx * dt
        const limit = viewW(z) * 0.65 + 3
        if (sc.x > limit) sc.x = -limit
        if (sc.x < -limit) sc.x = limit
      }
      const flip = spec.behavior === 'drift' ? 1 : sc.vx >= 0 ? -1 : 1 // 剪影朝左绘制
      for (const m of sc.members) {
        const driftY = spec.behavior === 'drift' ? 2 : 0.6
        const px = sc.x + m.ox + (opts.reduced ? 0 : Math.sin(t * 0.8 + m.ph) * spec.wobble)
        const py = sc.y + m.oy + (opts.reduced ? 0 : Math.sin(t * 0.55 + m.ph * 1.7) * spec.wobble * driftY)
        m.spr.position.set(px, py, z)
        m.spr.scale.x = Math.abs(m.spr.scale.x) * flip
      }
    }
  }

  /* ---- 光标探照灯 ---- */
  const cursor = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: wideTex,
      color: 0xd8e8f2,
      transparent: true,
      opacity: 0.09,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  cursor.scale.setScalar(3.2)
  cursor.visible = false
  scene.add(cursor)
  const mouse = { x: -1e4, y: -1e4 }
  if (!opts.coarse) {
    addEventListener('pointermove', (e) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      cursor.visible = true
    })
    addEventListener('pointerleave', () => (cursor.visible = false))
  }

  /* ---- 尺寸 ---- */
  function resize() {
    vw = innerWidth
    vh = innerHeight
    renderer.setSize(vw, vh)
    camera.aspect = vw / vh
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan((vh * S) / (2 * CAM_Z)))
    camera.updateProjectionMatrix()
    // 表层光铺满视口宽度，但高度收在视口上部，不淹没 hero 文案
    const lw = viewW(-6) * 1.15
    const lh = Math.min(lw * 0.75, viewH(-6) * 0.9)
    surfaceLight.scale.set(lw, lh, 1)
    surfaceLight.position.y = 1.5 - lh * 0.4
    buildSnow()
  }
  resize()

  /* ---- 帧循环 ---- */
  const clock = new THREE.Clock()

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05)
    const t = clock.elapsedTime
    const camY = -(scrollY + vh / 2) * S
    camera.position.y = opts.reduced ? camY : THREE.MathUtils.lerp(camera.position.y, camY, 0.16)
    const depthPx = scrollY + vh / 2
    // 全程深度比例 0..1：驱动光衰减
    const df = seabedDocY ? THREE.MathUtils.clamp(depthPx / seabedDocY, 0, 1) : 0

    // 海雪：缓慢下沉 + 视窗环绕；越深越稀
    for (const layer of snowLayers) {
      const pos = layer.points.geometry.getAttribute('position') as THREE.BufferAttribute
      const H = viewH(layer.z) * 1.5
      for (let i = 0; i < layer.count; i++) {
        let y = pos.getY(i)
        if (!opts.reduced) y -= layer.speeds[i]! * dt
        if (y > camera.position.y + H) y -= H * 2
        if (y < camera.position.y - H) y += H * 2
        pos.setY(i, y)
      }
      pos.needsUpdate = true
      ;(layer.points.material as THREE.PointsMaterial).opacity = 0.7 * (1 - 0.6 * df)
    }

    // 表层光衰减：下潜约两屏后天光消失
    const surfaceK = THREE.MathUtils.clamp(1 - scrollY / (vh * 2.2), 0, 1)
    ;(celestial.material as THREE.SpriteMaterial).opacity = opts.mood.sunOp * surfaceK
    ;(surfaceLight.material as THREE.SpriteMaterial).opacity =
      (0.3 + opts.mood.rayOp * 1.1) * surfaceK

    // 海底暖光：接近时亮起
    const distToSeabed = Math.abs(seabedDocY - depthPx)
    const seabedK = THREE.MathUtils.clamp(1 - distToSeabed / (vh * 1.6), 0, 1)
    ;(seabedGlow.material as THREE.SpriteMaterial).opacity = 0.5 * seabedK
    seabedGlow.scale.set(Math.max(viewW(-5) * 0.9, 8), Math.max(viewH(-5) * 0.5, 4), 1)

    updateFish(t, dt)

    // 记忆生物：呼吸 + 探照灯增亮
    for (const c of creatures) {
      const pulse = opts.reduced ? 1 : 1 + 0.1 * Math.sin(t * 1.2 + c.phase)
      if (!opts.reduced) c.group.position.x += Math.sin(t * 0.4 + c.phase) * 0.0006
      const sx = c.group.position.x / S + vw / 2
      const sy = (camera.position.y - c.group.position.y) / S + vh / 2
      const dist = Math.hypot(sx - mouse.x, sy - mouse.y)
      const boost = cursor.visible ? THREE.MathUtils.clamp(1 - dist / 260, 0, 1) : 0
      c.halo.material.opacity = c.baseHalo * (1 + boost * 1.4)
      c.halo.scale.setScalar(c.baseScale * pulse * (1 + boost * 0.35))
    }

    // 探照灯位置
    if (cursor.visible) {
      const targetX = (mouse.x - vw / 2) * S
      const targetY = camera.position.y + (vh / 2 - mouse.y) * S
      cursor.position.x = THREE.MathUtils.lerp(cursor.position.x, targetX, 0.14)
      cursor.position.y = THREE.MathUtils.lerp(cursor.position.y, targetY, 0.14)
    }

    renderer.render(scene, camera)
  }

  if (opts.reduced) {
    // 减动效：只在滚动/缩放时渲染一帧，无持续动画
    const renderOnce = () => requestAnimationFrame(frame)
    addEventListener('scroll', renderOnce, { passive: true })
    renderOnce()
  } else {
    renderer.setAnimationLoop(frame)
  }

  return {
    setMarkers,
    setSeabedY,
    setDepthMap,
    resize: () => {
      resize()
      if (opts.reduced) requestAnimationFrame(frame)
    },
  }
}
