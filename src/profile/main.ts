import './style.css'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { profile } from './data'
import { memories } from '../content/memories'

gsap.registerPlugin(ScrollTrigger)

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector(sel) as T
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  [...root.querySelectorAll(sel)] as T[]

/* ---------- 资产：assets/ 下有图就用，没有就退回 CSS 渐变 ---------- */

const files = import.meta.glob('./assets/*.{png,webp,jpg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const asset = (name: string): string | null => {
  const hit = Object.keys(files).find((p) => p.includes(`/${name}.`))
  return hit ? files[hit] : null
}

const bgVar = (sel: string, prop: string, name: string) => {
  const url = asset(name)
  if (url) ($(sel) as HTMLElement)?.style.setProperty(prop, `url("${url}")`)
}

/* ---------- 1 · HERO ---------- */

function buildHero() {
  $('.eyebrow').textContent = profile.eyebrow
  $('.hero-hello em').textContent = profile.greeting
  $('.hero-lead').textContent = profile.nameLead
  $('.hero-name').textContent = profile.name

  $('.hero-intro').innerHTML = profile.intro
    .map((p) => (p.accent ? `<b>${p.text}</b>` : p.text))
    .join('')
  $('.hero-lede').textContent = profile.lede

  $('.hero-links').innerHTML = profile.links
    .map(
      (l) =>
        `<a href="${l.href}" class="${'primary' in l && l.primary ? 'primary' : ''}"${
          l.href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''
        }>${l.label}</a>`,
    )
    .join('')

  // 气泡：固定六个位置，各自不同的浮动周期
  const spots = [
    { x: 4, y: 6 },
    { x: 58, y: 2 },
    { x: 0, y: 40 },
    { x: 62, y: 38 },
    { x: 10, y: 78 },
    { x: 56, y: 74 },
  ]
  $('.hero-bubbles').innerHTML = profile.bubbles
    .map(
      (b, i) =>
        `<li style="left:${spots[i % spots.length].x}%;top:${spots[i % spots.length].y}%;--dur:${
          6 + (i % 4) * 0.9
        }s;--delay:${(i * 0.7).toFixed(1)}s">${b}</li>`,
    )
    .join('')

  $('.hero-stats').innerHTML = profile.stats
    .map((s) => `<li><i>${s.k}</i><b>${s.v}</b></li>`)
    .join('')

  bgVar('.hero-bg', '--hero-img', 'hero-void')
}

/* ---------- 2 · PLACE ---------- */

function buildPlace() {
  const p = profile.place
  $('.place-watermark').textContent = p.cityLatin
  $('.pin-label').textContent = `${p.city} · ${p.region}`
  $('.place-title').innerHTML =
    `${p.prefix} <span class="accent-mint">${p.region}</span> <span class="accent-gold">${p.city}</span><br>${p.suffix}`
  $('.place-hud .lat').textContent = p.lat
  $('.place-hud .lng').textContent = p.lng
  $('.place-meta').textContent = p.meta
  bgVar('.place-bg', '--place-img', 'map-city')
}

/* ---------- 3 · CREED ---------- */

function buildCreed() {
  const pages = profile.creed
  $('.creed-pages').innerHTML = pages
    .map(
      (pg, i) => `
      <article class="creed-page" data-page="${i}">
        <span class="creed-index">${String(i + 1).padStart(2, '0')} / ${String(pages.length).padStart(2, '0')}</span>
        <p class="creed-text">${pg.lines
          .map((l) =>
            l.accent
              ? `<span class="accent-gold">${l.text}</span>`
              : 'hl' in l && l.hl
                ? `<span class="hl">${l.text}</span>`
                : l.text,
          )
          .join('')}</p>
      </article>`,
    )
    .join('')

  $('.creed-marks').innerHTML =
    `<div class="mark-column">${pages
      .map((pg, i) => `<span class="mark-ghost" data-mark="${i}">${pg.mark}</span>`)
      .join('')}</div>` +
    pages.map((pg, i) => `<span class="mark-live" data-live="${i}">${pg.mark}</span>`).join('')

  $('.creed-progress .dots').innerHTML = pages.map(() => '<i></i>').join('')
}

/* ---------- 4 · FREEDOM ---------- */

function buildFreedom() {
  const f = profile.freedom
  $('.freedom-watermark').textContent = f.watermark
  $('.freedom-title').innerHTML = `<span>${f.title1}</span><span>${f.title2}</span>`
  $('.freedom-lede').textContent = f.lede

  const run = f.places.map((n) => `<span>${n}</span><b>●</b>`).join('')
  $('.freedom-places .marquee-track').innerHTML = run + run
  bgVar('.freedom-bg', '--freedom-img', 'valley')
}

/* ---------- 5 · PHOTOS ---------- */

// 12 张拍立得散落，图片来自 8 张样例（部分复用，角度/速度都不同）
const PHOTO_SPOTS = [
  { x: 0, y: 6, r: -7, tall: true, speed: 0.55, img: 1 },
  { x: 13, y: 28, r: 4, tall: false, speed: 0.95, img: 2 },
  { x: 28, y: 2, r: -3, tall: false, speed: 0.35, img: 3 },
  { x: 41, y: 30, r: 6, tall: false, speed: 1.15, img: 4 },
  { x: 55, y: 8, r: -5, tall: true, speed: 0.7, img: 5 },
  { x: 70, y: 32, r: 3, tall: false, speed: 1.05, img: 6 },
  { x: 85, y: 4, r: -6, tall: false, speed: 0.45, img: 7 },
  { x: 21, y: 55, r: 5, tall: false, speed: 1.35, img: 8 },
  { x: 47, y: 60, r: -4, tall: false, speed: 0.8, img: 2 },
  { x: 64, y: 66, r: 7, tall: false, speed: 1.2, img: 5 },
  { x: 81, y: 54, r: -8, tall: true, speed: 0.6, img: 1 },
  { x: 3, y: 72, r: 3, tall: false, speed: 1.45, img: 6 },
]

function buildPhotos() {
  $('.photo-wall').innerHTML = PHOTO_SPOTS.map((s) => {
    const n = String(s.img).padStart(2, '0')
    const url = asset(`photo-${n}`)
    return `<figure class="polaroid${s.tall ? ' tall' : ''}" data-speed="${s.speed}"
        style="left:${s.x}%;top:${s.y}%;transform:rotate(${s.r}deg)">
        <div class="shot"${url ? ` style="background-image:url('${url}')"` : ''}></div>
        <figcaption>FRAME ${n}</figcaption>
      </figure>`
  }).join('')

  $('.photo-caption').textContent = profile.photos.caption
  const act = $<HTMLAnchorElement>('.photo-action')
  act.textContent = `${profile.photos.action.label} →`
  act.href = profile.photos.action.href
}

/* ---------- 6 · IDENTITY ---------- */

function buildIdentity() {
  const id = profile.identity
  $('.identity-title').innerHTML =
    `<span>${id.line1} <b class="g1">${id.line1Accent}</b></span>` +
    `<span>${id.line2} <b class="g2">${id.line2Accent}</b></span>`
  $('.identity-sub').textContent = id.sub
  bgVar('.identity-bg', '--identity-img', 'earth')
}

/* ---------- 7 · WORKS ---------- */

function buildWorks() {
  const w = profile.works
  $('.works-watermark').textContent = w.watermark
  $('.works-title').innerHTML = `<b>${w.title}</b>${w.titleTail}`
  $('.works-lede').textContent = w.lede
  $('.works-wall').innerHTML = w.items
    .map((it) => {
      const url = asset(it.shot)
      return `<article class="work-card">
        <div class="shot"${url ? ` style="background-image:url('${url}')"` : ''}></div>
        <div class="meta"><b>${it.name}</b><i>${it.tag}</i></div>
      </article>`
    })
    .join('')
}

/* ---------- 8 · STACK ---------- */

function buildStack() {
  const s = profile.stack
  const ghost = (label: string) =>
    `<div class="stack-card ghost"><i>TOKEN 位</i><b>${label}</b><em>COMING SOON</em></div>`
  $('.stack-grid').innerHTML =
    ghost(s.placeholders[0]) +
    `<div class="stack-card main">
      <span class="stack-badge">${s.badge}</span>
      <p class="stack-name">${s.name}</p>
      <p class="stack-lede">${s.lede}</p>
      <ul class="stack-chips">${s.chips.map((c) => `<li>${c}</li>`).join('')}</ul>
      <a class="stack-action" href="${s.action.href}" target="_blank" rel="noopener">${s.action.label} ↗</a>
    </div>` +
    ghost(s.placeholders[1])
}

/* ---------- 9 · VOICES ---------- */

function buildVoices() {
  const v = profile.voices
  $('.voices-title').innerHTML = `${v.title1}<em>${v.title2}</em>`
  // 三组语录铺成六行：每行错开起点与速度，形成参考站那种弹幕感
  const ROWS = 6
  $('.voices-rows').innerHTML = Array.from({ length: ROWS }, (_, i) => {
    const src = v.rows[i % v.rows.length]
    const shifted = src.slice(i % src.length).concat(src.slice(0, i % src.length))
    const run = shifted
      .map((c) => `<div class="voice"><i>${c.who}</i><p>${c.text}</p></div>`)
      .join('')
    return `<div class="voice-row${i % 2 ? ' rev' : ''}">
      <div class="marquee-track" style="--speed:${48 + i * 11}s">${run + run}</div>
    </div>`
  }).join('')

  const stars = asset('starfield')
  if (stars) {
    const el = $('.s-voices') as HTMLElement
    el.style.backgroundImage = `linear-gradient(to bottom, rgba(5,6,8,.92), rgba(6,8,16,.86) 55%, rgba(7,16,24,.95)), url("${stars}")`
    el.style.backgroundSize = 'cover'
  }
}

/* ---------- 10 · SUMMIT ---------- */

function buildSummit() {
  const s = profile.summit
  $('.summit-lead').textContent = s.lead.join('\n')
  $('.summit-big').textContent = s.big
  $('.summit-tail').textContent = s.tail
  bgVar('.summit-bg', '--summit-img', 'summit')
}

/* ---------- 11 · MILESTONES ---------- */

function buildMilestones() {
  $('.ms-title span:last-child').textContent = profile.milestones.title
  $('.ms-hint').textContent = profile.milestones.hint

  const sorted = [...memories].sort((a, b) => a.year - b.year)
  $('.ms-items').innerHTML = sorted
    .map((m, i) => {
      const n = String((i % 8) + 1).padStart(2, '0')
      const cover = asset(`photo-${n}`)
      return `<article class="ms-item ${i % 2 ? 'down' : 'up'}">
        <span class="ms-year" aria-hidden="true">${m.year}</span>
        <span class="ms-node" aria-hidden="true"><span>${String(i + 1).padStart(2, '0')}</span></span>
        <div class="ms-card">
          <div class="cover"${cover ? ` style="background-image:url('${cover}')"` : ''}></div>
          <div class="body">
            <p class="ms-date">${m.year}</p>
            <h3 class="ms-name">${m.title}</h3>
            <p class="ms-desc">${m.story[0] ?? ''}</p>
            <ul class="ms-tags"><li>${m.kind === 'milestone' ? '节点' : '时刻'}</li></ul>
          </div>
        </div>
      </article>`
    })
    .join('')
}

/* ============================================================
   动效
   ============================================================ */

function revealOnScroll() {
  $$('[data-anim]').forEach((el, i) => {
    gsap.from(el, {
      y: 40,
      opacity: 0,
      duration: 0.9,
      ease: 'power3.out',
      delay: i * 0.08,
    })
  })

  const groups: [string, string][] = [
    ['.hero-stats li', '.s-hero'],
    ['.place-title, .place-hud', '.s-place'],
    ['.freedom-copy > *', '.s-freedom'],
    ['.identity-title span, .identity-sub', '.s-identity'],
    ['.works-watermark, .works-title, .works-lede', '.s-works'],
    ['.stack-card', '.s-stack'],
    ['.voices-title', '.s-voices'],
    ['.summit-copy > *', '.s-summit'],
  ]
  groups.forEach(([targets, trigger]) => {
    gsap.from(targets, {
      y: 36,
      opacity: 0,
      duration: 0.9,
      ease: 'power3.out',
      stagger: 0.09,
      scrollTrigger: { trigger, start: 'top 68%' },
    })
  })
}

function parallax() {
  const layers: [string, string, number][] = [
    ['.hero-bg', '.s-hero', 12],
    ['.place-bg', '.s-place', 10],
    ['.freedom-bg', '.s-freedom', 14],
    ['.identity-bg', '.s-identity', 12],
    ['.summit-bg', '.s-summit', 16],
  ]
  layers.forEach(([layer, trigger, amount]) => {
    gsap.fromTo(
      layer,
      { yPercent: -amount / 2, scale: 1.06 },
      {
        yPercent: amount / 2,
        ease: 'none',
        scrollTrigger: { trigger, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    )
  })
}

function creedMotion() {
  const pages = $$('.creed-page')
  const ghosts = $$('.mark-ghost')
  const lives = $$('.mark-live')
  const dots = $$('.creed-progress .dots i')
  const n = pages.length
  let current = -1

  const show = (idx: number) => {
    if (idx === current) return
    current = idx
    pages.forEach((el, i) =>
      gsap.to(el, {
        opacity: i === idx ? 1 : 0,
        y: i === idx ? 0 : 24,
        duration: 0.55,
        ease: 'power2.out',
      }),
    )
    ghosts.forEach((el, i) =>
      gsap.to(el, { opacity: i === idx ? 1 : 0.25, duration: 0.6, ease: 'power2.out' }),
    )
    lives.forEach((el, i) =>
      gsap.to(el, {
        opacity: i === idx ? 1 : 0,
        y: i === idx ? 0 : 30,
        duration: 0.55,
        ease: 'power2.out',
      }),
    )
    dots.forEach((d, i) => d.classList.toggle('on', i === idx))
    $('.creed-caption').textContent = `滚动翻页 · ${idx + 1}/${n} · ${profile.creed[idx].title}`
  }

  gsap.set(pages, { opacity: 0, y: 24 })
  gsap.set(lives, { opacity: 0, y: 30 })
  gsap.set(ghosts, { opacity: 0.25 })

  ScrollTrigger.create({
    trigger: '.s-creed',
    start: 'top top',
    end: 'bottom bottom',
    snap: reduced ? undefined : { snapTo: 1 / (n - 1), duration: 0.35, delay: 0.05 },
    onUpdate: (self) => show(Math.min(n - 1, Math.floor(self.progress * n * 0.999))),
    onEnter: () => show(0),
    onEnterBack: () => show(n - 1),
  })
  show(0)
}

function photoMotion() {
  $$('.polaroid').forEach((el) => {
    const speed = Number(el.dataset.speed ?? 1)
    gsap.to(el, {
      yPercent: -34 * speed,
      ease: 'none',
      scrollTrigger: {
        trigger: '.s-photos',
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    })
  })
}

function worksMotion() {
  const cards = $$('.work-card')
  gsap.fromTo(
    cards,
    { rotateY: 22, rotateX: 6, y: 90, opacity: 0 },
    {
      rotateY: -6,
      rotateX: 0,
      y: 0,
      opacity: 1,
      stagger: 0.12,
      ease: 'power3.out',
      scrollTrigger: { trigger: '.s-works', start: 'top 70%', end: 'bottom 60%', scrub: 1 },
    },
  )
}

function milestonesMotion() {
  const section = $('.s-milestones')
  const stage = $('.ms-stage')
  const items = $('.ms-items')
  const curve = $<SVGSVGElement>('.ms-curve')

  const layout = () => {
    const distance = Math.max(0, items.scrollWidth - window.innerWidth)
    section.style.height = `${window.innerHeight + distance}px`
    curve.setAttribute('width', String(items.scrollWidth))
    curve.setAttribute('viewBox', `0 0 ${items.scrollWidth} 352`)
    const w = items.scrollWidth
    const seg = Math.max(1, Math.round(w / 520))
    let d = 'M 0 176'
    for (let i = 0; i < seg; i++) {
      const x0 = (w / seg) * i
      const x1 = (w / seg) * (i + 1)
      const dir = i % 2 ? 1 : -1
      d += ` C ${x0 + (x1 - x0) * 0.35} ${176 + dir * 120}, ${x0 + (x1 - x0) * 0.65} ${176 - dir * 120}, ${x1} 176`
    }
    $('path', curve)!.setAttribute('d', d)
    return distance
  }

  curve.insertAdjacentHTML(
    'afterbegin',
    `<defs><linearGradient id="ms-grad" x1="0" x2="1">
      <stop offset="0" stop-color="#c4923f" stop-opacity="0"/>
      <stop offset=".2" stop-color="#e8b86a" stop-opacity=".9"/>
      <stop offset=".8" stop-color="#e8b86a" stop-opacity=".9"/>
      <stop offset="1" stop-color="#c4923f" stop-opacity="0"/>
    </linearGradient></defs>`,
  )

  stage.style.position = 'sticky'
  stage.style.top = '0'

  let distance = layout()

  const tween = gsap.to([items, curve], {
    x: () => -distance,
    ease: 'none',
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: () => `+=${distance}`,
      scrub: 0.6,
      invalidateOnRefresh: true,
    },
  })

  ScrollTrigger.addEventListener('refreshInit', () => {
    distance = layout()
  })

  // 指针拖拽 = 换算成页面滚动
  const track = $('.ms-track')
  let dragging = false
  let lastX = 0
  track.addEventListener('pointerdown', (e) => {
    dragging = true
    lastX = e.clientX
    track.setPointerCapture(e.pointerId)
  })
  track.addEventListener('pointermove', (e) => {
    if (!dragging) return
    const dx = e.clientX - lastX
    lastX = e.clientX
    window.scrollBy({ top: -dx, behavior: 'auto' })
  })
  const stop = (e: PointerEvent) => {
    dragging = false
    if (track.hasPointerCapture(e.pointerId)) track.releasePointerCapture(e.pointerId)
  }
  track.addEventListener('pointerup', stop)
  track.addEventListener('pointercancel', stop)

  return tween
}

/* ============================================================
   启动
   ============================================================ */

buildHero()
buildPlace()
buildCreed()
buildFreedom()
buildPhotos()
buildIdentity()
buildWorks()
buildStack()
buildVoices()
buildSummit()
buildMilestones()

if (reduced) {
  gsap.set('.creed-page', { opacity: 0 })
  gsap.set('.creed-page[data-page="0"]', { opacity: 1 })
  creedMotion()
  milestonesMotion()
} else {
  revealOnScroll()
  parallax()
  creedMotion()
  photoMotion()
  worksMotion()
  milestonesMotion()
}

window.addEventListener('load', () => ScrollTrigger.refresh())
