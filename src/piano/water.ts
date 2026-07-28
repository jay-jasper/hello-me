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
  float crest = 0.0;
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

    // 距离衰减放缓：除以 (1 + 6d) 会让波纹出膛就没了，实测整片水面几乎是黑的
    float env = exp(-decay * age) / (1.0 + d * 2.0);
    float wave = sin(k * (d - c * age)) * env * r.z;
    // 波前之外不该有振动
    wave *= smoothstep(0.0, 0.06, c * age - d + 0.06);

    h += wave;
    pitchMix += pitch * abs(wave);
    crest += abs(wave);
    if (self) glowSelf += abs(wave);
  }

  // 伪法线
  float dx = dFdx(h) * 140.0;
  float dy = dFdy(h) * 140.0;
  vec3 n = normalize(vec3(-dx, -dy, 1.0));

  vec3 deep = vec3(0.016, 0.030, 0.055);
  vec3 cool = vec3(0.10, 0.30, 0.44);
  vec3 base = mix(deep, cool, clamp(pitchMix * 3.2, 0.0, 1.0));

  vec3 lightDir = normalize(vec3(0.35, 0.65, 0.72));
  float spec = pow(max(dot(n, lightDir), 0.0), 26.0);
  float rim = pow(1.0 - n.z, 2.0);

  vec3 col = base + spec * vec3(0.75, 0.95, 1.0) + rim * vec3(0.10, 0.24, 0.34);
  // 波峰本身也发光：只靠高光的话，波纹在暗场里读不出来
  col += clamp(crest, 0.0, 1.4) * vec3(0.10, 0.26, 0.36);
  col += glowSelf * vec3(0.62, 0.46, 0.16);   // 用户弹的音，金边

  // 顶部（远处）压暗收边，靠近琴键的一侧保持亮，因为涟漪就是从那儿生出来的
  col *= mix(1.0, 0.45, smoothstep(0.45, 1.0, vUv.y));
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

/**
 * 编译 + 链接 VERT/FRAG 程序。任何一步失败都先清理已创建的 shader/program 再抛错，
 * 不把 GL 句柄泄漏给调用方（调用方只关心成功与否，失败就直接走降级）。
 */
function buildProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const prog = gl.createProgram()!
  const shaders: WebGLShader[] = []
  try {
    for (const [type, src] of [
      [gl.VERTEX_SHADER, VERT],
      [gl.FRAGMENT_SHADER, FRAG],
    ] as const) {
      const sh = gl.createShader(type)!
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh)
        gl.deleteShader(sh)
        throw new Error(`shader 编译失败：${log}`)
      }
      shaders.push(sh)
      gl.attachShader(prog, sh)
    }
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`program 链接失败：${gl.getProgramInfoLog(prog)}`)
    }
    return prog
  } catch (err) {
    for (const sh of shaders) gl.deleteShader(sh)
    gl.deleteProgram(prog)
    throw err
  }
}

/**
 * 关键前提：一块 <canvas> 一旦被绑定过 webgl2 上下文，之后对它调用 getContext('2d')
 * 不会抛错，只会静默返回 null——2D 降级路径的 ctx.fillStyle 会在第一帧直接摔死
 * TypeError，而这恰恰是「WebGL2 上下文能拿到、但 shader 编译/链接在这块驱动上失败」
 * 这批设备本该被兜底的场景。
 *
 * 所以真正的 <canvas> 绝不能先尝试 webgl2 再回退到 2d。做法：先在一块从未展示给
 * 用户的 detached canvas 上，用完全相同的 shader 源码和 context attributes 探测一遍
 * 编译/链接是否会成功。探测失败——真实 canvas 还没被碰过，可以安全交给 2D 路径；
 * 探测成功——才第一次去拿真实 canvas 的 webgl2 上下文，此时不应该再失败。
 *
 * 谁想「简化」掉这个探测、直接在真实 canvas 上 try/catch，都会在探测失败但真实
 * canvas 已经绑定 webgl2 之后，复现这个 bug——不要合并这一步。
 */
function shaderCompiles(): boolean {
  const probeCanvas = document.createElement('canvas')
  const probeGl = getGL2(probeCanvas)
  if (!probeGl) return false
  try {
    const prog = buildProgram(probeGl)
    probeGl.deleteProgram(prog)
    return true
  } catch {
    return false
  } finally {
    // 探测上下文用完即弃，主动释放底层 GPU 资源，别占着一份再也不会用到的上下文
    probeGl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}

/** 探测通过后真实构造仍失败（几乎不可能，但真实 canvas 此时已绑定 webgl2、2D 已回不去了）
 *  时的最后防线：不渲染，但也不崩溃。 */
function inertWater(splash: Water['splash'], setDim: (d: number) => void): Water {
  return { splash, setDim, resize: () => {}, start: () => {}, stop: () => {} }
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

  // 先在探测用的 detached canvas 上确认 shader 编译/链接会成功，真实 canvas 才第一次
  // 去拿 webgl2 上下文——绝不能反过来先绑定真实 canvas 再回退，见 shaderCompiles() 的注释。
  const gl = !opts.reduced && shaderCompiles() ? getGL2(canvas) : null

  if (gl) {
    try {
      return createWaterGL(gl, canvas, ripples, packed, splash, getDim, setDim, t0)
    } catch (err) {
      // 探测已经在 detached canvas 上验证过同样的 shader 会编译/链接成功，理论上走不到这里；
      // 万一某个诡异驱动仍在这一步翻车，真实 canvas 已经绑定了 webgl2，getContext('2d') 只会
      // 拿到 null、没法再退到 2D 了——只能记录下来，返回一个不渲染但也不崩溃的空实现。
      console.error(
        `[water] WebGL2 探测通过后仍初始化失败，且真实 canvas 已绑定 webgl2 无法降级：${err instanceof Error ? err.message : String(err)}`,
      )
      return inertWater(splash, setDim)
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

  const prog = buildProgram(gl)
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
