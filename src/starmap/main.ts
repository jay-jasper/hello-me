// 星图装配：滚动编排、拖拽、replay、降级分支。
// 只共享 src/config.ts 与 src/content/*，不 import 其它主题的模块。
//
// spec: docs/superpowers/specs/2026-09-04-starmap-theme-design.md

import '@fontsource/noto-serif-sc/300.css'
import '@fontsource/noto-serif-sc/400.css'
import '@fontsource/fragment-mono/400.css'
import './style.css'

import { site } from '../config.ts'
import { memories, type Memory } from '../content/memories.ts'
import { constellations } from '../content/constellations.ts'
import {
  captionOpacity,
  cardsOpacity,
  collapseProgress,
  groupByConstellation,
  layoutStars,
  overlongWarning,
  rasterizeSymbol,
  sampleRaster,
  SECTION_VH,
  type Group,
  type Star,
} from './sample.ts'
import { createNebula, type Nebula } from './nebula.ts'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const groups = groupByConstellation(memories, constellations)
const warning = overlongWarning(groups.length)
if (warning) console.warn('[starmap]', warning)

/** 开场的总星云：全部记忆一起，旋臂布局 */
const heroStars = layoutStars(memories, { radius: 3.1, depth: 2.0, spiral: true })
/** 每座自己的星点 */
const starsByGroup = new Map<string, Star[]>(
  groups.map((g) => [g.constellation.id, layoutStars(g.memories)]),
)

/* ============================ DOM 骨架 ============================ */

function el<T extends Element = HTMLElement>(sel: string): T {
  const node = document.querySelector<T>(sel)
  if (!node) throw new Error(`缺少必需节点：${sel}`)
  return node
}

const canvas = el<HTMLCanvasElement>('#sky')
const ambient = el('#ambient')
const dragSurface = el<HTMLButtonElement>('#drag')
const replay = el<HTMLButtonElement>('#replay')
const chart = el('#chart')
const pinName = el('#pin-name')
const pinTheme = el('#pin-theme')

/** 逐字母揭示：单字 700ms，字间 delay 45ms，起始位移 ±0.4em */
function pinLetters(host: Element, text: string, dir: -1 | 1) {
  host.textContent = ''
  ;[...text].forEach((ch, i) => {
    const span = document.createElement('span')
    span.textContent = ch
    span.style.setProperty('--shift', `${dir * 0.4}em`)
    span.style.setProperty('--delay', `${300 + i * 45}ms`)
    host.appendChild(span)
  })
}

pinLetters(pinName, site.name, -1)
pinLetters(pinTheme, '星图', 1)

type SectionView = {
  group: Group
  section: HTMLElement
  caption: HTMLElement
  cards: HTMLElement
}

function memoryCard(m: Memory): HTMLElement {
  const article = document.createElement('article')
  article.className = m.kind === 'milestone' ? 'card milestone' : 'card'

  const year = document.createElement('p')
  year.className = 'card-year'
  year.textContent = String(m.year)

  const title = document.createElement('h3')
  title.textContent = m.title

  article.append(year, title)
  for (const paragraph of m.story) {
    const p = document.createElement('p')
    p.textContent = paragraph
    article.appendChild(p)
  }
  return article
}

/** 每座一节，200vh。内容全在 DOM 里：读屏器按文档顺序就能读完一生。 */
function buildSections(): SectionView[] {
  return groups.map((group) => {
    const c = group.constellation

    const section = document.createElement('section')
    section.className = 'constellation'
    section.id = `c-${c.id}`
    section.style.height = `${SECTION_VH}vh`
    section.setAttribute('aria-label', `${c.name} ${c.yearFrom}–${c.yearTo}`)

    const caption = document.createElement('div')
    caption.className = 'caption'
    const h2 = document.createElement('h2')
    h2.textContent = c.name
    const years = document.createElement('p')
    years.className = 'years'
    years.textContent = `${c.yearFrom} — ${c.yearTo}`
    const blurb = document.createElement('p')
    blurb.className = 'blurb'
    blurb.textContent = c.blurb
    caption.append(h2, years, blurb)

    const cards = document.createElement('div')
    cards.className = 'cards'
    // 卡片按年份倒序：最近的在上
    for (const m of [...group.memories].reverse()) cards.appendChild(memoryCard(m))

    section.append(caption, cards)
    return { group, section, caption, cards }
  })
}

const views = buildSections()
for (const v of views) chart.appendChild(v.section)

/* ============================ 降级分支 ============================ */

function staticSvg(stars: Star[]): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('class', 'static-map')
  svg.setAttribute('viewBox', '-4 -3 8 6')
  svg.setAttribute('aria-hidden', 'true')

  // 连线与星点用的是同一份坐标，跟 WebGL 那条一模一样
  for (let i = 0; i < stars.length - 1; i++) {
    const line = document.createElementNS(NS, 'line')
    line.setAttribute('x1', String(stars[i].pos.x))
    line.setAttribute('y1', String(-stars[i].pos.y))
    line.setAttribute('x2', String(stars[i + 1].pos.x))
    line.setAttribute('y2', String(-stars[i + 1].pos.y))
    svg.appendChild(line)
  }
  for (const s of stars) {
    const dot = document.createElementNS(NS, 'circle')
    dot.setAttribute('cx', String(s.pos.x))
    dot.setAttribute('cy', String(-s.pos.y))
    dot.setAttribute('r', s.big ? '0.09' : '0.05')
    svg.appendChild(dot)
  }
  return svg
}

/**
 * 无 WebGL 或 prefers-reduced-motion：用同一份星点坐标画成 DOM 里的 SVG。
 * 位置数据本来就算好了，零美术资产 —— 不需要预渲染静帧。
 */
function renderStaticFallback() {
  document.body.dataset.static = 'true'
  canvas.remove()
  dragSurface.remove()
  replay.remove()

  for (const v of views) {
    const stars = starsByGroup.get(v.group.constellation.id) ?? []
    v.section.insertBefore(staticSvg(stars), v.section.firstChild)
  }
}

function hasWebGL(): boolean {
  try {
    const probe = document.createElement('canvas')
    return !!(probe.getContext('webgl2') || probe.getContext('webgl'))
  } catch {
    return false
  }
}

/* ============================ 交互 ============================ */

function wireDrag(nebula: Nebula) {
  let dragging = false
  let lastX = 0
  let lastY = 0

  dragSurface.addEventListener('pointerdown', (e) => {
    dragging = true
    dragSurface.dataset.dragging = 'true'
    lastX = e.clientX
    lastY = e.clientY
    dragSurface.setPointerCapture(e.pointerId)
  })

  dragSurface.addEventListener('pointermove', (e) => {
    if (!dragging) return
    nebula.addRotation((e.clientX - lastX) * 0.0022, (e.clientY - lastY) * 0.0018)
    lastX = e.clientX
    lastY = e.clientY
  })

  const release = () => {
    dragging = false
    dragSurface.dataset.dragging = 'false'
  }
  dragSurface.addEventListener('pointerup', release)
  dragSurface.addEventListener('pointercancel', release)

  // 源站只做了拖拽。键盘可达是本站其余主题的惯例，补上。
  dragSurface.addEventListener('keydown', (e) => {
    const step: Record<string, [number, number]> = {
      ArrowLeft: [-0.06, 0],
      ArrowRight: [0.06, 0],
      ArrowUp: [0, -0.05],
      ArrowDown: [0, 0.05],
    }
    const delta = step[e.key]
    if (!delta) return
    e.preventDefault()
    nebula.addRotation(delta[0], delta[1])
  })
}

function wireScroll(nebula: Nebula, symbolFor: (id: string, path: string) => Float32Array) {
  let activeId = ''
  /** replay 期间强制回到符号态，让它重新塌一次 */
  let replayUntil = 0

  function activate(view: SectionView) {
    const c = view.group.constellation
    if (activeId === c.id) return
    activeId = c.id
    nebula.setConstellation(starsByGroup.get(c.id) ?? [], symbolFor(c.id, c.symbol))
    ambient.style.setProperty('--ambient', c.ambient)
  }

  function tick() {
    const vh = window.innerHeight
    const heroProgress = Math.min(1, Math.max(0, window.scrollY / vh))
    const root = document.documentElement
    root.style.setProperty('--copy-opacity', String(1 - heroProgress))
    root.style.setProperty('--title-parallax-y', `${-40 * heroProgress}px`)

    // 占据视口中线的那一节就是当前这一座。
    // 用 rect 而不是 offsetTop：#chart 是 position:relative，offsetTop 相对的是它，
    // 不是文档 —— 那样整页编排会偏掉一个开场屏。
    let current: SectionView | null = null
    let progress = 0
    for (const v of views) {
      const rect = v.section.getBoundingClientRect()
      const p = (vh / 2 - rect.top) / rect.height
      if (p >= 0 && p < 1) {
        current = v
        progress = p
        break
      }
    }

    if (!current) {
      // 还在开场：总星云保持散开态
      nebula.setProgress(1)
      nebula.setLineOpacity(0)
      for (const v of views) {
        v.caption.style.opacity = '0'
        v.cards.style.opacity = '0'
      }
      return
    }

    activate(current)

    const collapse = performance.now() < replayUntil ? 0 : collapseProgress(progress)
    nebula.setProgress(collapse)
    // 连线随塌陷同步亮起，细到只在余光里
    nebula.setLineOpacity(0.24 * collapse)

    for (const v of views) {
      const own = v === current
      v.caption.style.opacity = own ? String(captionOpacity(progress)) : '0'
      v.cards.style.opacity = own ? String(cardsOpacity(progress)) : '0'
    }
  }

  let ticking = false
  function schedule() {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      ticking = false
      tick()
    })
  }

  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule)
  tick()

  // 重播：先打回符号态，1.6s 后放开，塌陷动画自然重跑一遍
  replay.addEventListener('click', () => {
    replayUntil = performance.now() + 1600
    schedule()
    window.setTimeout(schedule, 1650)
  })
}

/* ============================ 启动 ============================ */

function bootNebula() {
  const count = window.innerWidth < 768 ? 12000 : 30000

  // 符号点云按需光栅化一次，缓存下来 —— 切座只是换 attribute
  const symbolCache = new Map<string, Float32Array>()
  function symbolFor(id: string, path: string): Float32Array {
    let pts = symbolCache.get(id)
    if (!pts) {
      pts = sampleRaster(rasterizeSymbol(path), count, id)
      symbolCache.set(id, pts)
    }
    return pts
  }

  const first = groups[0].constellation
  const nebula = createNebula(canvas, {
    count,
    stars: heroStars,
    symbol: symbolFor(first.id, first.symbol),
    // 开场是总星云，不是符号
    progress: 1,
  })
  nebula.start()

  wireDrag(nebula)
  wireScroll(nebula, symbolFor)

  window.addEventListener('resize', () => nebula.resize())
  document.addEventListener('visibilitychange', () => {
    // 标签页隐藏就停 rAF，长滚页面不该在后台烧电
    if (document.hidden) nebula.stop()
    else nebula.start()
  })
}

if (reducedMotion || !hasWebGL()) renderStaticFallback()
else bootNebula()
