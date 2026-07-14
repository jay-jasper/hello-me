// 旧路主题装配。语义内容渲染 + 滚动驱动循环在此接线。
// 只共享 src/config.ts 与 src/content/memories.ts，不 import 深海站模块。

import '@fontsource/noto-serif-sc/400.css'
import '@fontsource/noto-serif-sc/600.css'
import '@fontsource/eb-garamond/400.css'
import '@fontsource/eb-garamond/400-italic.css'
import './style.css'

import { site } from '../config'
import { memories } from '../content/memories'
import { createScenery } from './scenery'
import { createFlowers } from './flowers'
import { createParticles } from './particles'
import signpostUrl from './assets/signpost.png'
import waypostUrl from './assets/waypost.png'

const journeyEl = document.getElementById('journey')!
const memoriesEl = document.getElementById('memories')!
const prologueEl = document.getElementById('prologue')!
const terminusEl = document.getElementById('terminus')!

// 旧路方向：出生 → 当下，年份升序（与深海站相反）
const ordered = [...memories].sort((a, b) => a.year - b.year)
const nowYear = new Date().getFullYear()

prologueEl.innerHTML = `
  <div class="signpost">
    <img class="signpost-art" src="${signpostUrl}" alt="" />
    <div class="signpost-text">
      <h1>${site.name}</h1>
      <p class="tagline">这条路早已在那里。你只是走到了这里。</p>
      <p class="hint" aria-hidden="true">沿路而行 ↓</p>
    </div>
  </div>
`

// 竖排旁白：宿命感短句，立在昼/黄昏的留白处（装饰，不进 Tab 序）
const ASIDES: [number, string][] = [
  [0.3, '天很大，人很小，时间不停。'],
  [0.62, '走过的路不会回头，也不必回头。'],
]

memoriesEl.innerHTML = ordered
  .map(
    (m) => `
  <section class="memory" data-year="${m.year}">
    <h2 class="visually-hidden">${m.year} · ${m.title}</h2>
  </section>`,
  )
  .join('')

terminusEl.innerHTML = `
  <h2 class="visually-hidden">当下</h2>
  <div class="terminus-inner">
    <div class="now-block">
      ${site.now.map((p) => `<p>${p}</p>`).join('')}
    </div>
    <nav class="waypost" aria-label="远方的地名">
      <img class="waypost-art" src="${waypostUrl}" alt="" />
      <ul>
        ${site.socials
          .map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${s.label}</a></li>`)
          .join('')}
      </ul>
    </nav>
    <p class="epilogue">路在这里停住。流星落向还没走的远方——${nowYear} 年之后的路，走到了再写。</p>
  </div>
`

// 页面总高：序章 + 每条记忆 + 终点前后留白
const screens = ordered.length + 3
journeyEl.style.height = `${screens * 100}vh`

// ---------- 滚动驱动循环 ----------

const stage = document.getElementById('stage')!
const scenery = createScenery(stage, screens)

const flowers = createFlowers(scenery.roadLayer, {
  memories: ordered,
  birthYear: site.birthYear,
  nowYear,
  worldWidth: scenery.worldWidth,
  hud: document.getElementById('hud')!,
})

const isMobile = window.innerWidth <= 768
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
if (reducedMotion) document.documentElement.classList.add('reduced-motion')

// reduced-motion：关粒子漂移与流星，夜空改静态长曝星空（CSS 星点）
const particles = reducedMotion ? null : createParticles(stage, isMobile)
if (!particles) {
  const stars = document.createElement('div')
  stars.className = 'static-stars'
  const dots: string[] = []
  for (let i = 0; i < 140; i++) {
    dots.push(
      `${Math.round(Math.random() * 100)}vw ${Math.round(Math.random() * 55)}vh 0 ${Math.random() < 0.2 ? 1 : 0}px oklch(0.95 0.01 90 / ${(0.4 + Math.random() * 0.6).toFixed(2)})`,
    )
  }
  stars.style.boxShadow = dots.join(',')
  stage.appendChild(stars)
}

// 签名时刻状态
let departed = false
let meteorMoment = false

// 竖排旁白挂到路面层（随景行进）
for (const [p, text] of ASIDES) {
  const aside = document.createElement('span')
  aside.className = 'road-aside'
  aside.setAttribute('aria-hidden', 'true')
  aside.textContent = text
  aside.style.left = `${(p * scenery.worldWidth + window.innerWidth * 0.6).toFixed(0)}px`
  scenery.roadLayer.appendChild(aside)
}

let progress = 0
let target = 0
let lastProgress = 0

// 游戏式键盘行走：←→ / A D 按住即走
const keys = new Set<string>()
window.addEventListener('keydown', (e) => {
  if (['ArrowRight', 'ArrowLeft', 'd', 'a', 'D', 'A'].includes(e.key)) {
    // 面板开着时交给 dialog
    if (!document.querySelector('dialog[open]')) {
      keys.add(e.key.toLowerCase().replace('arrow', ''))
      e.preventDefault()
    }
  }
})
window.addEventListener('keyup', (e) => {
  keys.delete(e.key.toLowerCase().replace('arrow', ''))
})

function frame() {
  const walk = (keys.has('right') || keys.has('d') ? 1 : 0) - (keys.has('left') || keys.has('a') ? 1 : 0)
  if (walk !== 0) window.scrollBy(0, walk * 14)

  const max = document.documentElement.scrollHeight - window.innerHeight
  target = max > 0 ? window.scrollY / max : 0
  // spec: lerp 0.08；reduced-motion 直接跟随（滚动驱动，无自主缓动）
  progress = reducedMotion ? target : progress + (target - progress) * 0.08
  const velocity = progress - lastProgress
  lastProgress = progress
  scenery.update(progress, velocity)
  flowers.update(progress)
  particles?.update(progress, velocity)

  // 签名时刻 1：启程——首次滚动，路标文字随风散去 + 风粒子脉冲
  if (!departed && window.scrollY > 40) {
    departed = true
    prologueEl.classList.add('departed')
    particles?.burst()
  }
  // 签名时刻 2：终点流星——首次抵达夜段，流星群前 3s 加倍
  if (!meteorMoment && progress > 0.85) {
    meteorMoment = true
    particles?.meteorShower(true)
    setTimeout(() => particles?.meteorShower(false), 3000)
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

export {}
