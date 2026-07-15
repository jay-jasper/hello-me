// 旅路三幕装配（GSAP 版）：master timeline + ScrollTrigger scrub 驱动三幕交叉与推镜；
// 光点绽放、序章逐字、篝火真闪、DOM 流星、面板 stagger。
// 只共享 src/config.ts 与 src/content/memories.ts，不 import 深海站模块。

import '@fontsource/noto-serif-sc/400.css'
import '@fontsource/noto-serif-sc/600.css'
import '@fontsource/eb-garamond/400.css'
import '@fontsource/eb-garamond/400-italic.css'
import './style.css'

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { site } from '../config'
import { memories, type Memory } from '../content/memories'
import { frameOpacity, layout, yearAt, type Act } from './acts'
import { createParticles } from './particles'
import act1Url from './assets/act-1.webp'
import act2Url from './assets/act-2.webp'
import act3Url from './assets/act-3.webp'

gsap.registerPlugin(ScrollTrigger)

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
    const wind = document.createElement('div')
    wind.className = 'frame-wind'
    wind.style.backgroundImage = `url(${url})`
    f.appendChild(wind)
  }
  framesEl.appendChild(f)
  return f
})

// 幕内光效
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

// ---------- 序章（第一幕内，名字逐字） ----------

const intro = document.createElement('div')
intro.id = 'intro'
intro.innerHTML = `
  <h1>${[...site.name].map((c) => `<span class="ch">${c}</span>`).join('')}</h1>
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
nowBlock.querySelectorAll('a').forEach((a) =>
  a.addEventListener('focus', () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    if (window.scrollY < max * 0.75) window.scrollTo({ top: max * 0.92, behavior: reducedMotion ? 'auto' : 'smooth' })
  }),
)

// ---------- 语义大纲 ----------

document.getElementById('memories-outline')!.innerHTML =
  `<h2 class="visually-hidden">记忆</h2>` +
  ordered.map((m) => `<h3 class="visually-hidden">${m.year} · ${m.title}</h3>`).join('')

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
  if (!reducedMotion) {
    // 手记翻开：日期 → 标题 → 段落 → 按钮依次浮现
    gsap.from(dialog.querySelectorAll('.story-date, .story-title, .story-body p, .story-close'), {
      y: 10,
      opacity: 0,
      duration: 0.35,
      stagger: 0.06,
      ease: 'power2.out',
      delay: 0.1,
    })
  }
}

// ---------- 记忆光点 ----------

const lightBtns: HTMLButtonElement[] = slots.map((s) => {
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
  return btn
})

// ---------- HUD / 粒子 ----------

const hud = document.getElementById('hud')!
const particles = reducedMotion ? null : createParticles(document.getElementById('dust') as HTMLCanvasElement, isMobile)
if (reducedMotion) (document.getElementById('dust') as HTMLCanvasElement).style.display = 'none'

// ---------- 主时间线（时间轴单位 = 屏，0..9） ----------

let progressNow = 0

const master = gsap.timeline({
  defaults: { ease: 'none' },
  scrollTrigger: {
    trigger: '#script',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1,
    // 幕与记忆双停靠：只吸附最近点，不做惯性投射（快速滚动不会被带飞）
    snap: reducedMotion
      ? undefined
      : {
          snapTo: [0, 1 / 3, 2 / 3, 1, ...slots.map((s) => s.trigger)].sort((a, b) => a - b),
          duration: { min: 0.2, max: 0.6 },
          delay: 0.25,
          ease: 'power1.inOut',
          inertia: false,
        },
    onUpdate(self) {
      progressNow = self.progress
      // 透明幕不吃鼠标（键盘仍可达，聚焦自动行进）
      for (let i = 0; i < 3; i++) {
        frameEls[i].style.pointerEvents = frameOpacity((i + 1) as Act, self.progress) < 0.02 ? 'none' : 'auto'
      }
      hud.textContent =
        self.progress >= 2 / 3 - 1 / 18 ? '当下' : String(yearAt(self.progress, slots, site.birthYear, nowYear))
    },
  },
})

// 三幕交叉渐变（帧透明度，与 acts.ts 的 frameOpacity 同一几何：边界 3/6，带宽 1 屏）
gsap.set(frameEls[0], { opacity: 1 })
master.addLabel('act1', 0)
master.to(frameEls[0], { opacity: 0, duration: 1 }, 2.5)
master.fromTo(frameEls[1], { opacity: 0 }, { opacity: 1, duration: 1 }, 2.5)
master.addLabel('act2', 3)
master.to(frameEls[1], { opacity: 0, duration: 1 }, 5.5)
master.fromTo(frameEls[2], { opacity: 0 }, { opacity: 1, duration: 1 }, 5.5)
master.addLabel('act3', 6)
master.to({}, { duration: 3 }, 6) // 时间线拉满到 9
master.addLabel('end', 9)

// 记忆停靠标签（吸附到每个光点，而不是被拽回幕首）
slots.forEach((s, i) => master.addLabel(`m${i}`, s.trigger * SCREENS))

// Ken Burns 推镜（reduced-motion 不建，CSS 也兜底 transform:none）
if (!reducedMotion) {
  master.fromTo(frameEls[0], { scale: 1.02, xPercent: 0, yPercent: 0 }, { scale: 1.07, xPercent: -1.2, yPercent: -0.8, duration: 3 }, 0)
  master.fromTo(frameEls[1], { scale: 1.02, xPercent: 0, yPercent: 0 }, { scale: 1.07, xPercent: 1.2, yPercent: -0.8, duration: 3 }, 3)
  master.fromTo(frameEls[2], { scale: 1.02, xPercent: 0, yPercent: 0 }, { scale: 1.07, xPercent: -1.0, yPercent: -0.6, duration: 3 }, 6)
}

// 页面底色随幕过渡
master.to('body', { '--page-bg': 'var(--act2)', duration: 1 }, 2.5)
master.to('body', { '--page-bg': 'var(--act3)', duration: 1 }, 5.5)

// ---------- 光点绽放（每点一个 ScrollTrigger） ----------

const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight
slots.forEach((s, i) => {
  const btn = lightBtns[i]
  if (reducedMotion) {
    ScrollTrigger.create({
      start: () => s.trigger * maxScroll() - window.innerHeight * 0.08,
      end: () => s.trigger * maxScroll() + window.innerHeight * 0.08,
      toggleClass: { targets: btn, className: 'lit' },
    })
    return
  }
  gsap.fromTo(
    btn,
    { scale: 0.4, autoAlpha: 0 },
    {
      scale: 1,
      autoAlpha: 1,
      duration: 0.6,
      ease: 'back.out(1.8)',
      scrollTrigger: {
        start: () => s.trigger * maxScroll() - window.innerHeight * 0.5,
        end: () => s.trigger * maxScroll() + window.innerHeight * 0.5,
        toggleActions: 'play none none reverse',
      },
    },
  )
})
// lit 高亮窗口独立收窄（同屏最多一处亮签）
if (!reducedMotion) {
  slots.forEach((s, i) => {
    ScrollTrigger.create({
      start: () => s.trigger * maxScroll() - window.innerHeight * 0.08,
      end: () => s.trigger * maxScroll() + window.innerHeight * 0.08,
      toggleClass: { targets: lightBtns[i], className: 'lit' },
    })
  })
}

// ---------- 序章：逐字入场 + 首滚散场 ----------

if (!reducedMotion) {
  gsap.set(intro, { opacity: 1 })
  gsap
    .timeline({ defaults: { ease: 'power2.out' } })
    .from(intro.querySelectorAll('.ch'), { y: 18, opacity: 0, duration: 0.7, stagger: 0.07 }, 0.2)
    .from(intro.querySelector('.tagline'), { y: 14, opacity: 0, duration: 0.6 }, '-=0.3')
    .from(intro.querySelector('.hint'), { opacity: 0, duration: 0.8 }, '-=0.2')

  ScrollTrigger.create({
    start: 40,
    once: true,
    onEnter: () =>
      gsap
        .timeline({ defaults: { ease: 'power2.in' } })
        .to(intro.querySelectorAll('.ch'), { x: -28, opacity: 0, filter: 'blur(4px)', duration: 0.9, stagger: 0.04 }, 0)
        .to(intro.querySelectorAll('.tagline, .hint'), { x: -20, opacity: 0, filter: 'blur(4px)', duration: 0.8 }, 0.15),
  })
} else {
  ScrollTrigger.create({
    start: 40,
    once: true,
    onEnter: () => intro.classList.add('departed'),
  })
}

// ---------- 篝火真闪（随机永不重复） ----------

if (!reducedMotion) {
  gsap.to(fireGlow, {
    opacity: 'random(0.6, 1)',
    scale: 'random(0.94, 1.1)',
    x: 'random(-6, 6)',
    y: 'random(-8, 4)',
    duration: 'random(0.08, 0.24)',
    repeat: -1,
    repeatRefresh: true,
    ease: 'none',
  })
  gsap.to(fireLight, { opacity: 0.9, duration: 3.1, yoyo: true, repeat: -1, ease: 'sine.inOut' })
}

// ---------- DOM 流星（夜段随机） ----------

if (!reducedMotion && !isMobile) {
  const meteor = document.createElement('div')
  meteor.className = 'meteor'
  frameEls[2].appendChild(meteor)
  const spawn = () => {
    if (progressNow < 0.7) {
      gsap.delayedCall(2, spawn)
      return
    }
    const x = gsap.utils.random(5, 55)
    const y = gsap.utils.random(4, 22)
    gsap
      .timeline({ onComplete: () => gsap.delayedCall(gsap.utils.random(3, 6), spawn) })
      .fromTo(
        meteor,
        { left: `${x}vw`, top: `${y}vh`, opacity: 0 },
        { left: `${x + 26}vw`, top: `${y + 13}vh`, opacity: 1, duration: 0.5, ease: 'none' },
      )
      .to(meteor, { left: `${x + 40}vw`, top: `${y + 20}vh`, opacity: 0, duration: 0.35, ease: 'none' })
  }
  gsap.delayedCall(3, spawn)
}

// ---------- 粒子跟随（gsap.ticker 替代裸 rAF） ----------

if (particles) gsap.ticker.add(() => particles.update(progressNow))

export {}
