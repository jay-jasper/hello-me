// 水面。对外只有 splash(x01, vel, pitch01, self)，不认识 midi、不认识音乐。
import { createRipples, type Ripple } from './ripples.ts'

export type Water = {
  splash(x01: number, vel: number, pitch01: number, self: boolean): void
  setDim(dim: number): void
  resize(): void
  start(): void
  stop(): void
}

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

uniform vec4 uRipple[48];   // x, t0, amp, ±pitch
uniform int  uCount;
uniform float uTime;
uniform float uAspect;
uniform float uDim;

void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  float h = 0.0;
  float glowSelf = 0.0;
  float pitchMix = 0.0;

  for (int i = 0; i < 48; i++) {
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
    float k = mix(26.0, 88.0, pitch);
    float c = mix(0.22, 0.40, pitch);
    float decay = mix(0.45, 1.7, pitch);

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

export function createWater(
  canvas: HTMLCanvasElement,
  opts: { cap: number; reduced: boolean },
): Water {
  const ripples = createRipples(opts.cap)
  const packed = new Float32Array(48 * 4)
  let dim = 1
  let raf = 0
  let t0 = performance.now()

  const gl = opts.reduced ? null : canvas.getContext('webgl2', { antialias: false, alpha: false })

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

  if (!gl) return createWater2D(canvas, ripples, opts, () => dim, splash, () => t0)

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
    gl.uniform1f(uDim, dim)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    raf = requestAnimationFrame(frame)
  }

  resize()
  window.addEventListener('resize', resize)

  return {
    splash,
    setDim: (d) => {
      dim = d
    },
    resize,
    start: () => {
      if (!raf) {
        t0 = performance.now()
        raf = requestAnimationFrame(frame)
      }
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
  opts: { cap: number; reduced: boolean },
  getDim: () => number,
  splash: Water['splash'],
  getT0: () => number,
): Water {
  const ctx = canvas.getContext('2d')!
  const packed = new Float32Array(48 * 4)
  let raf = 0

  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(canvas.clientWidth * dpr)
    canvas.height = Math.round(canvas.clientHeight * dpr)
  }

  const frame = () => {
    const { width: W, height: H } = canvas
    const now = (performance.now() - getT0()) / 1000
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
      const decay = 0.45 + pitch * 1.25
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
    setDim: () => {},
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
