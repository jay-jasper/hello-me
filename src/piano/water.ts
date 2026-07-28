// 水面。对外只有 splash(x01, vel, pitch01, self)，不认识 midi、不认识音乐。
import { createRipples, decayRateFor, MAX_DECAY, MIN_DECAY, type Ripple } from './ripples.ts'

export type Water = {
  splash(x01: number, vel: number, pitch01: number, self: boolean): void
  setDim(dim: number): void
  resize(): void
  start(): void
  stop(): void
}

// 涟漪缓冲的容量上限，唯一定义在这——GLSL 的 uniform 数组大小、WebGL 与 Canvas 2D
// 两条路径各自的 Float32Array 都从这一个常量派生，不再各处抄一份 48。
const MAX_RIPPLES = 48

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform vec4 uRipple[${MAX_RIPPLES}];   // x, t0, amp, ±pitch
uniform int  uCount;
uniform float uTime;
uniform float uAspect;
uniform float uDim;

void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  float h = 0.0;
  float glowSelf = 0.0;
  float pitchMix = 0.0;

  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    if (i >= uCount) break;
    vec4 r = uRipple[i];
    float age = uTime - r.y;
    if (age < 0.0) continue;

    float pitch = abs(r.w);
    bool self = r.w < 0.0;

    // 涟漪从水面底沿（贴着琴键那一侧）发出
    vec2 src = vec2(r.x * uAspect, -0.04);
    float d = distance(p, src);

    // 低音：长波长、慢衰减；高音：短波长、快衰减
    // 衰减率的两个端点（MIN_DECAY/MAX_DECAY）与 ripples.ts 共用同一份数字，
    // 避免 shader 和 pack() 的存活时长判断各写各的、悄悄漂移。
    float k = mix(26.0, 88.0, pitch);
    float c = mix(0.22, 0.40, pitch);
    float decay = mix(${MIN_DECAY.toFixed(3)}, ${MAX_DECAY.toFixed(3)}, pitch);

    float env = exp(-decay * age) / (1.0 + d * 6.0);
    float wave = sin(k * (d - c * age)) * env * r.z;
    // 波前之外不该有振动
    wave *= smoothstep(0.0, 0.06, c * age - d + 0.06);

    h += wave;
    pitchMix += pitch * abs(wave);
    if (self) glowSelf += abs(wave);
  }

  // 伪法线
  float dx = dFdx(h) * 40.0;
  float dy = dFdy(h) * 40.0;
  vec3 n = normalize(vec3(-dx, -dy, 1.0));

  vec3 deep = vec3(0.020, 0.035, 0.062);
  vec3 cool = vec3(0.055, 0.16, 0.24);
  vec3 base = mix(deep, cool, clamp(pitchMix * 2.2, 0.0, 1.0));

  vec3 lightDir = normalize(vec3(0.35, 0.65, 0.72));
  float spec = pow(max(dot(n, lightDir), 0.0), 42.0);
  float rim = pow(1.0 - n.z, 2.0);

  vec3 col = base + spec * vec3(0.55, 0.78, 0.92) + rim * vec3(0.05, 0.11, 0.16);
  col += glowSelf * vec3(0.62, 0.46, 0.16);   // 用户弹的音，金边

  // 越靠下（贴近琴键）越暗，让键盘从水里长出来
  col *= mix(0.55, 1.0, smoothstep(0.0, 0.5, vUv.y));
  col *= uDim;

  outColor = vec4(col, 1.0);
}`

/** 尝试拿 WebGL2 上下文；拿不到（或拿的过程本身抛错）就返回 null，交给调用方走 2D 降级。 */
function getGL2(canvas: HTMLCanvasElement): WebGL2RenderingContext | null {
  try {
    return canvas.getContext('webgl2', { antialias: false, alpha: false })
  } catch {
    return null
  }
}

export function createWater(
  canvas: HTMLCanvasElement,
  opts: { cap: number; reduced: boolean },
): Water {
  const ripples = createRipples(opts.cap)
  const packed = new Float32Array(MAX_RIPPLES * 4)

  // dim 是两条渲染路径共享的唯一状态：无论最终跑 WebGL 还是 Canvas 2D，
  // 返回的 Water.setDim 都改写这同一个变量，两条路径的 frame() 都读它。
  // 这样浮字在场时的 35% 调暗（dim=0.65）对 reduced-motion / 无 WebGL2 用户同样生效。
  let dim = 1
  const getDim = () => dim
  const setDim = (d: number) => {
    dim = d
  }

  // t0 只在构造时定一次，之后永不重置：stop()/start() 只是暂停/恢复 rAF 循环，
  // 缓冲区里已有涟漪的 t0 全部相对同一个原点，不会因为重启而变成负的 age
  // （负 age 会被 pack() 的 age < 0 分支吞掉，涟漪就会消失又在原地重新冒出来）。
  const t0 = performance.now()

  const splash: Water['splash'] = (x01, vel, pitch01, self) => {
    const r: Ripple = {
      x: x01,
      t0: (performance.now() - t0) / 1000,
      amp: 0.25 + vel * 0.75,
      pitch: pitch01,
      self,
    }
    ripples.add(r)
  }

  const gl = opts.reduced ? null : getGL2(canvas)

  if (gl) {
    try {
      return createWaterGL(gl, canvas, ripples, packed, splash, getDim, setDim, t0)
    } catch (err) {
      // 驱动 / ANGLE 变体可能让一个存在的 WebGL2 上下文仍然编译或链接失败，
      // 这不该让整个水面崩掉——退到 Canvas 2D 就是留这条后路的意义。
      console.warn(
        `[water] WebGL2 着色器初始化失败，降级到 Canvas 2D：${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  return createWater2D(canvas, ripples, packed, opts, getDim, setDim, splash, t0)
}

function createWaterGL(
  gl: WebGL2RenderingContext,
  canvas: HTMLCanvasElement,
  ripples: ReturnType<typeof createRipples>,
  packed: Float32Array,
  splash: Water['splash'],
  getDim: () => number,
  setDim: (d: number) => void,
  t0: number,
): Water {
  let raf = 0

  const prog = gl.createProgram()!
  for (const [type, src] of [
    [gl.VERTEX_SHADER, VERT],
    [gl.FRAGMENT_SHADER, FRAG],
  ] as const) {
    const sh = gl.createShader(type)!
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(`shader 编译失败：${gl.getShaderInfoLog(sh)}`)
    }
    gl.attachShader(prog, sh)
  }
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`program 链接失败：${gl.getProgramInfoLog(prog)}`)
  }
  gl.useProgram(prog)

  const quad = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

  const uRipple = gl.getUniformLocation(prog, 'uRipple')
  const uCount = gl.getUniformLocation(prog, 'uCount')
  const uTime = gl.getUniformLocation(prog, 'uTime')
  const uAspect = gl.getUniformLocation(prog, 'uAspect')
  const uDim = gl.getUniformLocation(prog, 'uDim')

  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const scale = window.innerWidth < 780 ? 0.5 : 1 // 移动端半分辨率
    canvas.width = Math.round(canvas.clientWidth * dpr * scale)
    canvas.height = Math.round(canvas.clientHeight * dpr * scale)
    gl.viewport(0, 0, canvas.width, canvas.height)
  }

  const frame = () => {
    const now = (performance.now() - t0) / 1000
    const n = ripples.pack(now, packed)
    gl.uniform4fv(uRipple, packed)
    gl.uniform1i(uCount, n)
    gl.uniform1f(uTime, now)
    gl.uniform1f(uAspect, canvas.clientWidth / Math.max(1, canvas.clientHeight))
    gl.uniform1f(uDim, getDim())
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    raf = requestAnimationFrame(frame)
  }

  resize()
  window.addEventListener('resize', resize)

  return {
    splash,
    setDim,
    resize,
    start: () => {
      if (!raf) raf = requestAnimationFrame(frame)
    },
    stop: () => {
      cancelAnimationFrame(raf)
      raf = 0
    },
  }
}

/** 降级：Canvas 2D 同心圆环。reduced-motion 下不扩散，只做原地柔光。 */
function createWater2D(
  canvas: HTMLCanvasElement,
  ripples: ReturnType<typeof createRipples>,
  packed: Float32Array,
  opts: { cap: number; reduced: boolean },
  getDim: () => number,
  setDim: (d: number) => void,
  splash: Water['splash'],
  t0: number,
): Water {
  const ctx = canvas.getContext('2d')!
  let raf = 0

  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const scale = window.innerWidth < 780 ? 0.5 : 1 // 移动端半分辨率，与 WebGL 路径一致
    canvas.width = Math.round(canvas.clientWidth * dpr * scale)
    canvas.height = Math.round(canvas.clientHeight * dpr * scale)
  }

  const frame = () => {
    const { width: W, height: H } = canvas
    const now = (performance.now() - t0) / 1000
    const n = ripples.pack(now, packed)

    ctx.fillStyle = '#050a10'
    ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'lighter'

    for (let i = 0; i < n; i++) {
      const x = packed[i * 4] * W
      const age = now - packed[i * 4 + 1]
      const amp = packed[i * 4 + 2]
      const pitch = Math.abs(packed[i * 4 + 3])
      const self = packed[i * 4 + 3] < 0
      // 与 shader 里的 mix(MIN_DECAY, MAX_DECAY, pitch) 共用 ripples.ts 里同一份映射，
      // 两条路径的衰减曲线不会因为各写各的常量而分叉。
      const decay = decayRateFor(pitch)
      const a = Math.max(0, amp * Math.exp(-decay * age)) * getDim()
      if (a <= 0.01) continue

      const r = opts.reduced ? H * 0.12 : (0.22 + pitch * 0.18) * age * H * 2.2
      ctx.strokeStyle = self
        ? `rgba(232,184,106,${a * 0.7})`
        : `rgba(${90 + pitch * 90},${170 + pitch * 60},${210 + pitch * 40},${a * 0.55})`
      ctx.lineWidth = Math.max(1, (1 - pitch) * 4)
      ctx.beginPath()
      ctx.arc(x, H, r, Math.PI, 2 * Math.PI)
      ctx.stroke()
    }

    ctx.globalCompositeOperation = 'source-over'
    raf = requestAnimationFrame(frame)
  }

  resize()
  window.addEventListener('resize', resize)

  return {
    splash,
    setDim,
    resize,
    start: () => {
      if (!raf) raf = requestAnimationFrame(frame)
    },
    stop: () => {
      cancelAnimationFrame(raf)
      raf = 0
    },
  }
}
