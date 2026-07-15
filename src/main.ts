import './style.css'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { site } from './config'
import { memories } from './content/memories'
import type { Memory } from './content/memories'

gsap.registerPlugin(ScrollTrigger)

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const coarse = matchMedia('(pointer: coarse)').matches
const nowYear = new Date().getFullYear()

/* ---------- 深度模型：深度(m) ⇄ 文档位置(px) ---------- */
// 记忆按年份映射到 60m–920m；海面 0m，海底 1000m。

const D_MIN = 60
const D_MAX = 920

function yearToDepth(year: number): number {
  const span = Math.max(1, nowYear - site.birthYear)
  return D_MIN + ((nowYear - year) / span) * (D_MAX - D_MIN)
}
function depthToYear(d: number): number {
  if (d <= D_MIN) return nowYear
  const span = nowYear - site.birthYear
  const y = Math.round(nowYear - ((d - D_MIN) / (D_MAX - D_MIN)) * span)
  return Math.max(site.birthYear, y)
}

/* ---------- 时刻：现实时间决定海面光色 ---------- */

function lerpHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  let out = 0
  for (const sh of [16, 8, 0]) {
    const ca = (pa >> sh) & 255
    const cb = (pb >> sh) & 255
    out |= Math.round(ca + (cb - ca) * t) << sh
  }
  return '#' + out.toString(16).padStart(6, '0')
}

// [小时, 浅水色, 中层色, 天体色, 天体亮度, 光束色, 光束强度]
const MOOD_STOPS: [number, string, string, string, number, string, number][] = [
  [0, '#0d1b2e', '#0a1522', '#d8e8f2', 0.5, '#d8e8f2', 0.12], // 深夜·月光
  [5, '#0d1b2e', '#0a1522', '#d8e8f2', 0.5, '#d8e8f2', 0.12],
  [7, '#243048', '#121e30', '#ffc9a0', 0.6, '#ffd9ad', 0.16], // 清晨·熹微
  [10, '#2e5470', '#16324a', '#ffffff', 0.8, '#eaf6ff', 0.22], // 白昼·日光
  [16, '#2e5470', '#16324a', '#ffffff', 0.8, '#eaf6ff', 0.22],
  [19, '#252b42', '#131b2e', '#f2a35e', 0.65, '#f0b98a', 0.18], // 黄昏·余晖
  [21, '#0d1b2e', '#0a1522', '#d8e8f2', 0.5, '#d8e8f2', 0.12],
  [24, '#0d1b2e', '#0a1522', '#d8e8f2', 0.5, '#d8e8f2', 0.12],
]

export type Mood = { sun: number; sunOp: number; ray: number; rayOp: number }

function moodNow(): Mood {
  const now = new Date()
  const h = now.getHours() + now.getMinutes() / 60
  let i = 1
  while (MOOD_STOPS[i]![0] < h) i++
  const a = MOOD_STOPS[i - 1]!
  const b = MOOD_STOPS[i]!
  const t = (h - a[0]) / (b[0] - a[0] || 1)
  const root = document.documentElement.style
  root.setProperty('--water-shallow', lerpHex(a[1], b[1], t))
  root.setProperty('--water-mid', lerpHex(a[2], b[2], t))
  return {
    sun: parseInt(lerpHex(a[3], b[3], t).slice(1), 16),
    sunOp: a[4] + (b[4] - a[4]) * t,
    ray: parseInt(lerpHex(a[5], b[5], t).slice(1), 16),
    rayOp: a[6] + (b[6] - a[6]) * t,
  }
}

// 锚点表 [文档中心线位置px, 深度m]，layout() 时重建
let anchors: [number, number][] = []

function piecewise(table: [number, number][], x: number): number {
  const first = table[0]!
  const last = table[table.length - 1]!
  if (x <= first[0]) return first[1]
  if (x >= last[0]) return last[1]
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i]!
    const [x0, y0] = table[i - 1]!
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
  }
  return last[1]
}
const depthAt = (docCenter: number) => piecewise(anchors, docCenter)
const docYAtDepth = (d: number) => piecewise(anchors.map(([a, b]) => [b, a] as [number, number]), d)

/* ---------- 静态内容 ---------- */

$('now-list').innerHTML = site.now.map((line) => `<li>${line}</li>`).join('')
$('socials').innerHTML = site.socials
  .map((s) => `<li><a href="${s.url}" ${s.url.startsWith('http') ? 'rel="me" target="_blank"' : ''}>${s.label}</a></li>`)
  .join('')
$('seabed-text').textContent = site.seabedText(site.birthYear)

/* ---------- 记忆节点 ---------- */

const memSection = $('memories')
const sorted = [...memories].sort((a, b) => b.year - a.year)
const nodes = sorted.map((m, i) => {
  const btn = document.createElement('button')
  btn.className = `memory kind-${m.kind} ${i % 2 === 0 ? 'side-l' : 'side-r'}`
  btn.innerHTML = `
    <span class="m-dot" aria-hidden="true"></span>
    <span class="m-text">
      <span class="m-year">${m.year}</span>
      <span class="m-title"></span>
    </span>`
  btn.querySelector('.m-title')!.textContent = m.title
  btn.addEventListener('click', () => openMemory(m))
  memSection.appendChild(btn)
  return { btn, m }
})

// 中心带点亮
const litObserver = new IntersectionObserver(
  (entries) => entries.forEach((e) => e.target.classList.toggle('lit', e.isIntersecting)),
  { rootMargin: '-34% 0px -34% 0px' },
)
nodes.forEach(({ btn }) => litObserver.observe(btn))

/* ---------- 记忆面板 ---------- */

const panel = $('panel') as unknown as HTMLDialogElement
function openMemory(m: Memory) {
  $('panel-year').textContent = `${m.year} · 约 −${Math.round(yearToDepth(m.year))} m`
  $('panel-title').textContent = m.title
  $('panel-story').innerHTML = ''
  for (const para of m.story) {
    const p = document.createElement('p')
    p.textContent = para
    $('panel-story').appendChild(p)
  }
  panel.showModal()
  if (!reduced) {
    // 浮出：年份 → 标题 → 段落依次上浮
    gsap.from(['#panel-year', '#panel-title', ...$('panel-story').children], {
      y: 10,
      opacity: 0,
      duration: 0.35,
      stagger: 0.06,
      ease: 'power2.out',
      delay: 0.08,
    })
  }
}
$('panel-close').addEventListener('click', () => panel.close())
panel.addEventListener('click', (e) => {
  if (e.target === panel) panel.close() // 点水面（backdrop）关闭
})

/* ---------- 布局：记忆带高度 + 节点深度定位 ---------- */

type SceneApi = {
  setMarkers: (m: { x: number; y: number; kind: Memory['kind'] }[]) => void
  setSeabedY: (docY: number) => void
  setDepthMap: (fn: (d: number) => number) => void
  resize: () => void
} | null
let sceneApi: SceneApi = null

function layout() {
  const vh = innerHeight
  const bandH = Math.max(5, sorted.length * 1.15) * vh
  memSection.style.height = `${Math.round(bandH)}px`

  const nowTop = $('now').offsetTop
  const bandTop = memSection.offsetTop
  const seabedTop = bandTop + bandH
  const docH = document.documentElement.scrollHeight

  anchors = [
    [vh * 0.5, 0],
    [nowTop + vh * 0.5, 20],
    [bandTop + vh * 0.5, D_MIN],
    [seabedTop + vh * 0.5, 940],
    [Math.max(seabedTop + vh * 0.51, docH - vh * 0.5), 1000],
  ]

  for (const { btn, m } of nodes) {
    btn.style.top = `${Math.round(docYAtDepth(yearToDepth(m.year)) - bandTop)}px`
  }

  if (sceneApi) {
    sceneApi.setMarkers(
      nodes.map(({ btn, m }) => {
        const dot = btn.querySelector('.m-dot')!.getBoundingClientRect()
        return {
          x: dot.left + dot.width / 2,
          y: dot.top + scrollY + dot.height / 2,
          kind: m.kind,
        }
      }),
    )
    sceneApi.setSeabedY(document.documentElement.scrollHeight - vh * 0.2)
    sceneApi.setDepthMap(docYAtDepth)
  }
}

/* ---------- HUD / 滚动状态 ---------- */

const hudDepth = $('hud-depth-value')
const hudYear = $('hud-year-value')
const hudRoll = { d: 0, y: nowYear }
const diveHint = $('dive-hint')
const surfacing = $('surfacing')

let ticking = false
function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    ticking = false
    const d = depthAt(scrollY + innerHeight * 0.5)
    if (reduced) {
      hudDepth.textContent = String(Math.round(d))
      hudYear.textContent = String(depthToYear(d))
    } else {
      // 深度计滚表：数字追赶而非跳变
      gsap.to(hudRoll, {
        d,
        y: depthToYear(d),
        duration: 0.6,
        ease: 'power2.out',
        overwrite: true,
        onUpdate: () => {
          hudDepth.textContent = String(Math.round(hudRoll.d))
          hudYear.textContent = String(Math.round(hudRoll.y))
        },
      })
    }
    diveHint.classList.toggle('gone', scrollY > 40)
    surfacing.hidden = d < 250
    // 越深光越暗：150m 后视野边缘渐渐被黑暗吞没
    const dim = Math.min(1, Math.max(0, (d - 150) / 750))
    document.documentElement.style.setProperty('--dim', (dim * 0.75).toFixed(3))
  })
}
addEventListener('scroll', onScroll, { passive: true })

surfacing.addEventListener('click', () =>
  scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }),
)

/* ---------- 特效场景（可降级） ---------- */

async function boot() {
  try {
    const { initAbyss } = await import('./scene')
    sceneApi = initAbyss($('abyss') as unknown as HTMLCanvasElement, { reduced, coarse, mood: moodNow() })
  } catch {
    sceneApi = null
  }
  if (!sceneApi) document.body.classList.add('no-webgl')
  layout()
  onScroll()

  if (!reduced) {
    // 签名时刻·破水：首屏文字随下潜被水面吞没（scrub 渐隐上移）
    gsap.to('#surface h1, #surface .tagline', {
      opacity: 0,
      y: -30,
      filter: 'blur(3px)',
      ease: 'none',
      scrollTrigger: { start: 0, end: () => innerHeight * 0.7, scrub: true },
    })
    // 海底终章：抵达海床，结语逐段浮现（一次性）
    gsap.from('#seabed h2, #seabed p', {
      y: 24,
      opacity: 0,
      duration: 0.9,
      stagger: 0.25,
      ease: 'power2.out',
      scrollTrigger: { trigger: '#seabed', start: 'top 70%', toggleActions: 'play none none none' },
    })
    // 浮出水面按钮：轻轻上浮循环
    gsap.to('#surfacing', { y: -4, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  }
}

addEventListener('resize', () => {
  layout()
  sceneApi?.resize()
  onScroll()
})

boot()
