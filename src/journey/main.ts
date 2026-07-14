// 旅路三幕装配：帧渐变、序章/终点、记忆光点、面板、HUD、粒子。
// 只共享 src/config.ts 与 src/content/memories.ts，不 import 深海站模块。

import '@fontsource/noto-serif-sc/400.css'
import '@fontsource/noto-serif-sc/600.css'
import '@fontsource/eb-garamond/400.css'
import '@fontsource/eb-garamond/400-italic.css'
import './style.css'

import { site } from '../config'
import { memories, type Memory } from '../content/memories'
import { frameOpacity, kenBurns, layout, yearAt, type Act } from './acts'
import { createParticles } from './particles'
import act1Url from './assets/act-1.webp'
import act2Url from './assets/act-2.webp'
import act3Url from './assets/act-3.webp'

const SCREENS = 9
const nowYear = new Date().getFullYear()
const ordered: Memory[] = [...memories].sort((a, b) => a.year - b.year)
const slots = layout(
  ordered.map((m) => m.year),
  site.birthYear,
)

// 每幕光点锚位（视口 %，沿画中道路排布；幕3 无记忆）
const ANCHORS: Record<1 | 2, [number, number][]> = {
  1: [
    [38, 84],
    [47, 72],
    [55, 63],
    [60, 56],
    [64, 52],
    [67, 49],
  ],
  2: [
    [42, 86],
    [46, 76],
    [49, 68],
    [52, 62],
    [54, 58],
    [56, 55],
  ],
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const isMobile = window.innerWidth <= 768

// ---------- 帧 ----------

const framesEl = document.getElementById('frames')!

// 风场置换滤镜（SMIL 湍流缓变）：只作用于各幕的风动层
document.body.insertAdjacentHTML(
  'beforeend',
  `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <filter id="wind-warp" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.006 0.018" numOctaves="1" seed="7" result="n">
        <animate attributeName="seed" dur="9s" values="7;8;9;7" repeatCount="indefinite"/>
        <animate attributeName="baseFrequency" dur="7s" values="0.006 0.018;0.008 0.014;0.006 0.018" repeatCount="indefinite"/>
      </feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs></svg>`,
)

const frameEls: HTMLElement[] = [act1Url, act2Url, act3Url].map((url, i) => {
  const f = document.createElement('div')
  f.className = `frame act-${i + 1}`
  f.style.backgroundImage = `url(${url})`
  if (!reducedMotion && !isMobile) {
    // 风动层：同一帧图 + 置换滤镜，蒙版只露草地/植被带——草在风里
    const wind = document.createElement('div')
    wind.className = 'frame-wind'
    wind.style.backgroundImage = `url(${url})`
    f.appendChild(wind)
  }
  framesEl.appendChild(f)
  return f
})

// 幕内光效：日光呼吸（幕1/2）与篝火闪动（幕3）
const glow1 = document.createElement('div')
glow1.className = 'sun-bloom act1-sun'
frameEls[0].appendChild(glow1)
const glow2 = document.createElement('div')
glow2.className = 'sun-bloom act2-sun'
frameEls[1].appendChild(glow2)
const fireGlow = document.createElement('div')
fireGlow.className = 'fire-glow'
frameEls[2].appendChild(fireGlow)
const fireLight = document.createElement('div')
fireLight.className = 'fire-light'
frameEls[2].appendChild(fireLight)

// ---------- 序章（第一幕内） ----------

const intro = document.createElement('div')
intro.id = 'intro'
intro.innerHTML = `
  <h1>${site.name}</h1>
  <p class="tagline">路还长，慢慢走。</p>
  <p class="hint" aria-hidden="true">往下，沿路而行 ↓</p>`
frameEls[0].appendChild(intro)

// ---------- 终点（第三幕内） ----------

const nowBlock = document.createElement('div')
nowBlock.id = 'now'
nowBlock.innerHTML = `
  <div class="now-lines">${site.now.map((p) => `<p>${p}</p>`).join('')}</div>
  <ul class="campfire-links">
    ${site.socials.map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${s.label}</a></li>`).join('')}
  </ul>
  <p class="epilogue">路在这里过夜。${nowYear} 年之后的事，走到了再写。</p>`
frameEls[2].appendChild(nowBlock)
// 键盘聚焦终点链接时行进到第三幕
nowBlock.querySelectorAll('a').forEach((a) =>
  a.addEventListener('focus', () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    if (window.scrollY < max * 0.75) window.scrollTo({ top: max * 0.92, behavior: reducedMotion ? 'auto' : 'smooth' })
  }),
)

// ---------- 语义大纲（无障碍/无样式阅读） ----------

document.getElementById('memories-outline')!.innerHTML =
  `<h2 class="visually-hidden">记忆</h2>` +
  ordered.map((m) => `<h3 class="visually-hidden">${m.year} · ${m.title}</h3>`).join('')

// 滚动轨道高度
document.getElementById('script')!.style.height = `${SCREENS * 100}vh`

// ---------- 纸面面板 ----------

const dialog = document.createElement('dialog')
dialog.className = 'story-panel'
dialog.innerHTML = `
  <article>
    <p class="story-date"></p>
    <h3 class="story-title"></h3>
    <div class="story-body"></div>
    <button class="story-close" aria-label="收起，继续赶路">继续赶路 →</button>
  </article>`
document.body.appendChild(dialog)
dialog.querySelector('.story-close')!.addEventListener('click', () => dialog.close())
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close()
})
dialog.addEventListener('close', () => framesEl.classList.remove('dimmed'))

function openStory(m: Memory) {
  dialog.querySelector('.story-date')!.textContent = String(m.year)
  dialog.querySelector('.story-title')!.textContent = m.title
  dialog.querySelector('.story-body')!.innerHTML = m.story.map((p) => `<p>${p}</p>`).join('')
  framesEl.classList.add('dimmed')
  dialog.showModal()
}

// ---------- 记忆光点 ----------

type LightNode = { btn: HTMLButtonElement; trigger: number }
const lights: LightNode[] = slots.map((s) => {
  const m = ordered[s.index]
  const [x, y] = ANCHORS[s.act][s.slotIndex % ANCHORS[s.act].length]
  const btn = document.createElement('button')
  btn.className = 'light'
  btn.setAttribute('aria-label', `${m.year} ${m.title}`)
  btn.style.left = `${x}%`
  btn.style.top = `${y}%`
  btn.innerHTML = `<span class="light-tag"><span class="light-year">${m.year}</span>${m.title}</span>`
  btn.addEventListener('click', () => openStory(m))
  btn.addEventListener('focus', () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo({ top: s.trigger * max, behavior: reducedMotion ? 'auto' : 'smooth' })
  })
  frameEls[s.act - 1].appendChild(btn)
  return { btn, trigger: s.trigger }
})

// ---------- HUD ----------

const hud = document.getElementById('hud')!

// ---------- 粒子 ----------

const particles = reducedMotion ? null : createParticles(document.getElementById('dust') as HTMLCanvasElement, isMobile)
if (reducedMotion) (document.getElementById('dust') as HTMLCanvasElement).style.display = 'none'

// ---------- 主循环 ----------

let progress = 0
let target = 0
let departed = false

function frame() {
  const max = document.documentElement.scrollHeight - window.innerHeight
  target = max > 0 ? window.scrollY / max : 0
  progress = reducedMotion ? target : progress + (target - progress) * 0.08

  for (let i = 0; i < 3; i++) {
    const act = (i + 1) as Act
    const o = frameOpacity(act, progress)
    const f = frameEls[i]
    f.style.opacity = String(o)
    // 透明幕不吃鼠标；键盘 Tab 仍可达（聚焦会自动滚动到该幕，随即显形）
    f.style.pointerEvents = o < 0.02 ? 'none' : 'auto'
    if (!reducedMotion) {
      const kb = kenBurns(act, progress)
      f.style.transform = `scale(${kb.scale}) translate(${kb.tx}%, ${kb.ty}%)`
    }
  }

  // 页面底色随幕过渡（露出处不突兀）
  const acts = ['var(--act1)', 'var(--act2)', 'var(--act3)']
  document.body.style.setProperty('--page-bg', acts[frameOpacity(3, progress) > 0.5 ? 2 : frameOpacity(2, progress) > 0.5 ? 1 : 0])

  // 光点亮起：最近且 ±半屏内，同屏一处
  let nearest: LightNode | null = null
  let best = 0.5 / SCREENS
  for (const l of lights) {
    const d = Math.abs(l.trigger - progress)
    if (d < best) {
      best = d
      nearest = l
    }
  }
  for (const l of lights) l.btn.classList.toggle('lit', l === nearest)

  // HUD 年份（第三幕显「当下」）
  hud.textContent = progress >= 2 / 3 - 1 / 18 ? '当下' : String(yearAt(progress, slots, site.birthYear, nowYear))

  // 签名时刻：首滚序章淡出
  if (!departed && window.scrollY > 40) {
    departed = true
    intro.classList.add('departed')
  }

  particles?.update(progress)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

export {}
