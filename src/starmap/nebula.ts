// 星云：唯一碰 WebGL 的文件。
//
// 一个 THREE.Points，一次 draw call。每个粒子带 aSymbol / aStar 两套位置，
// vertex shader 里 mix(aSymbol, aStar, uProgress) —— 「先成符号，再散为星点」
// 就是这一个 uniform 从 0 走到 1，没有第二套系统。
//
// 星芒用程序生成的十字 sprite + additive blending，不做后处理 bloom：
// 省一整个 render pass，移动端不掉帧。

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three'
import { buildParticles, linePositions, particleCount, type Star } from './sample.ts'

/** 拖拽旋转的 x 轴夹角上限（±35°），再多就翻过去了 */
const MAX_PITCH = (35 * Math.PI) / 180
/** 松手后的阻尼，每帧乘一次 */
const DAMPING = 0.92

/**
 * 十字星芒贴图。核要小要硬、光晕要瘦 ——
 * 否则一堆 additive 的点叠在一起会糊成棉花团。
 */
function flareTexture(): CanvasTexture {
  const S = 128
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const ctx = cv.getContext('2d')
  if (!ctx) throw new Error('拿不到 2d context，无法生成星芒贴图')
  const c = S / 2

  const core = ctx.createRadialGradient(c, c, 0, c, c, S * 0.26)
  core.addColorStop(0, 'rgba(255,255,255,1)')
  core.addColorStop(0.1, 'rgba(255,255,255,.55)')
  core.addColorStop(0.32, 'rgba(255,255,255,.08)')
  core.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = core
  ctx.fillRect(0, 0, S, S)

  // 真空里光不散，芒是锐的
  ctx.globalCompositeOperation = 'lighter'
  for (const vertical of [false, true]) {
    const g = vertical ? ctx.createLinearGradient(0, 0, 0, S) : ctx.createLinearGradient(0, 0, S, 0)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.5, 'rgba(255,255,255,.62)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    if (vertical) ctx.fillRect(c - 1, 0, 2, S)
    else ctx.fillRect(0, c - 1, S, 2)
  }

  const t = new CanvasTexture(cv)
  t.colorSpace = SRGBColorSpace
  return t
}

const VERT = /* glsl */ `
  attribute vec3 aSymbol;
  attribute vec3 aStar;
  attribute float aSeed;
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uProgress;
  uniform float uTime;
  uniform float uDpr;
  varying vec3 vColor;
  varying float vFade;

  void main() {
    vec3 p = mix(aSymbol, aStar, uProgress);

    // curl noise 的廉价替身：三轴异相正弦。幅度 0.015 世界单位，频率 0.35。
    // 真 curl noise 在这个幅度下看不出区别，却要多算三层梯度。
    float t = uTime * 0.35;
    p += 0.015 * vec3(
      sin(t + aSeed * 39.1),
      cos(t * 0.87 + aSeed * 27.7),
      sin(t * 0.71 + aSeed * 18.3)
    );

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    // 符号态所有粒子挤在一条线上，同尺寸必然糊死 —— 按 uProgress 收一档
    float sizeScale = mix(0.78, 1.0, uProgress);
    gl_PointSize = aSize * sizeScale * uDpr * 46.0 / -mv.z;

    vColor = aColor;
    vFade = smoothstep(14.0, 3.0, -mv.z);
  }
`

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  varying vec3 vColor;
  varying float vFade;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    // 0.72 是防过曝的总闸：层次靠粒子数量差拉，不靠整体加亮
    gl_FragColor = vec4(vColor * tex.rgb, tex.a * vFade * 0.72);
  }
`

export type NebulaOptions = {
  /** buffer 上限。实际每座画多少由 particleCount() 决定，靠 drawRange 裁 */
  count: number
  /** 初始形态 */
  stars: Star[]
  symbol: Float32Array
  /** 初始 uProgress，开场星云直接给 1 */
  progress?: number
}

export type Nebula = ReturnType<typeof createNebula>

export function createNebula(canvas: HTMLCanvasElement, opts: NebulaOptions) {
  const { count } = opts

  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true })
  renderer.setClearColor(0x000000, 0)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  renderer.setPixelRatio(dpr)

  const scene = new Scene()
  const camera = new PerspectiveCamera(50, 1, 0.1, 100)
  camera.position.z = 6

  const group = new Group()
  scene.add(group)

  const geo = new BufferGeometry()
  // three 要求有 position 属性；实际位置全在 shader 里算，这里只是占位
  geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
  geo.setAttribute('aSymbol', new BufferAttribute(new Float32Array(count * 3), 3))
  geo.setAttribute('aStar', new BufferAttribute(new Float32Array(count * 3), 3))
  geo.setAttribute('aSeed', new BufferAttribute(new Float32Array(count), 1))
  geo.setAttribute('aSize', new BufferAttribute(new Float32Array(count), 1))
  geo.setAttribute('aColor', new BufferAttribute(new Float32Array(count * 3), 3))

  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uProgress: { value: opts.progress ?? 0 },
      uTime: { value: 0 },
      uDpr: { value: dpr },
      uMap: { value: flareTexture() },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  })

  const points = new Points(geo, material)
  // position 全是 0，视锥剔除会误判整团不可见
  points.frustumCulled = false
  group.add(points)

  const lineMaterial = new LineBasicMaterial({
    color: 0x9fc4ff,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const lines = new LineSegments(new BufferGeometry(), lineMaterial)
  lines.frustumCulled = false
  group.add(lines)

  function writeAttribute(name: string, data: Float32Array) {
    const attr = geo.getAttribute(name) as BufferAttribute
    ;(attr.array as Float32Array).set(data)
    attr.needsUpdate = true
  }

  /**
   * 换一座星座：重写两套位置与连线。每节只发生一次，够便宜。
   * 实际画多少个粒子随星数走 —— buffer 按上限分配一次，用 drawRange 裁。
   */
  function setConstellation(stars: Star[], symbol: Float32Array) {
    const active = Math.min(count, particleCount(stars.length, count), symbol.length / 3)
    const p = buildParticles(stars, active)
    writeAttribute('aSymbol', symbol.subarray(0, active * 3))
    writeAttribute('aStar', p.aStar)
    writeAttribute('aSeed', p.aSeed)
    writeAttribute('aSize', p.aSize)
    writeAttribute('aColor', p.aColor)
    geo.setDrawRange(0, active)

    const seg = linePositions(stars)
    lines.geometry.dispose()
    lines.geometry = new BufferGeometry()
    if (seg.length) lines.geometry.setAttribute('position', new Float32BufferAttribute(seg, 3))
  }

  setConstellation(opts.stars, opts.symbol)

  /* ---------- 旋转：速度 + 阻尼，松手自然停 ---------- */
  let rotY = 0
  let rotX = 0
  let velY = 0
  let velX = 0

  /* ---------- 循环 ---------- */
  let raf = 0
  let running = false
  let elapsed = 0
  let last = 0

  function resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  function frame(now: number) {
    if (!running) return
    raf = requestAnimationFrame(frame)
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016
    last = now
    elapsed += dt
    material.uniforms.uTime.value = elapsed

    rotY += velY
    rotX += velX
    velY *= DAMPING
    velX *= DAMPING
    rotX = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, rotX))
    group.rotation.y = rotY
    group.rotation.x = rotX

    renderer.render(scene, camera)
  }

  function start() {
    if (running) return
    running = true
    last = 0
    raf = requestAnimationFrame(frame)
  }

  function stop() {
    running = false
    cancelAnimationFrame(raf)
  }

  return {
    setConstellation,
    setProgress: (v: number) => {
      material.uniforms.uProgress.value = v
    },
    setLineOpacity: (v: number) => {
      lineMaterial.opacity = v
    },
    addRotation: (dy: number, dx: number) => {
      velY += dy
      velX += dx
    },
    resize,
    start,
    stop,
    /** 静止渲染一帧：reduced-motion 下不跑循环，画面也得有东西 */
    renderOnce: () => renderer.render(scene, camera),
    dispose: () => {
      stop()
      geo.dispose()
      lines.geometry.dispose()
      material.uniforms.uMap.value.dispose()
      material.dispose()
      lineMaterial.dispose()
      renderer.dispose()
    },
  }
}
