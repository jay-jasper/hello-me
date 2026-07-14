// 蓝月草花丛：记忆节点、纸面故事面板、年份路标 HUD、键盘导航。
// 花丛是 <button>（真实语义），面板是 <dialog>（原生 Esc/焦点圈闭）。

import type { Memory } from '../content/memories'
import { progressForYear, yearForProgress } from './journey'
import bluemoonUrl from './assets/bluemoon.png'

export type Flowers = {
  update(progress: number): void
}

type Opts = {
  memories: Memory[]
  birthYear: number
  nowYear: number
  worldWidth: number
  hud: HTMLElement
}

export function createFlowers(roadLayer: HTMLElement, opts: Opts): Flowers {
  const { memories, birthYear, nowYear, worldWidth, hud } = opts

  // ---- 故事面板（全站共用一个 dialog） ----
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
  const dateEl = dialog.querySelector('.story-date')!
  const titleEl = dialog.querySelector('.story-title')!
  const bodyEl = dialog.querySelector('.story-body')!
  dialog.querySelector('.story-close')!.addEventListener('click', () => dialog.close())
  // 点击面板外收起
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close()
  })
  const stage = document.getElementById('stage')!
  dialog.addEventListener('close', () => stage.classList.remove('dimmed'))

  function open(m: Memory) {
    dateEl.textContent = `${m.year}`
    titleEl.textContent = m.title
    bodyEl.innerHTML = m.story.map((p) => `<p>${p}</p>`).join('')
    stage.classList.add('dimmed')
    dialog.showModal()
  }

  // ---- 花丛节点 ----
  type Node = { btn: HTMLButtonElement; p: number; m: Memory }
  const nodes: Node[] = memories.map((m, i) => {
    const p = progressForYear(m.year, birthYear, nowYear)
    const btn = document.createElement('button')
    btn.className = 'flower'
    btn.setAttribute('aria-label', `${m.year} ${m.title}`)
    // progress==p 时路面层平移 -p*worldWidth，此偏移让花丛落在画面 55vw 处
    btn.style.left = `${(p * worldWidth + window.innerWidth * 0.55).toFixed(0)}px`
    // 三种姿态：镜像/缩放轮换，避免整排一个模子
    const pose = i % 3
    btn.style.setProperty('--flower-scale', pose === 1 ? '0.85' : pose === 2 ? '1.1' : '1')
    btn.style.setProperty('--flower-flip', pose === 2 ? '-1' : '1')
    btn.innerHTML = `
      <img src="${bluemoonUrl}" alt="" draggable="false" />
      <span class="flower-tag"><span class="flower-year">${m.year}</span>${m.title}</span>`
    btn.addEventListener('click', () => open(m))
    // 键盘聚焦时行进到该花丛
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    btn.addEventListener('focus', () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      window.scrollTo({ top: p * max, behavior: reduced ? 'auto' : 'smooth' })
    })
    roadLayer.appendChild(btn)
    return { btn, p, m }
  })

  // ---- HUD 年份路标 ----
  hud.innerHTML = `<span class="hud-title"></span><span class="hud-year"></span>`
  const hudTitle = hud.querySelector('.hud-title')!
  const hudYear = hud.querySelector('.hud-year')!

  function update(progress: number) {
    // 盛开律：最近且在半径内的唯一一丛（同屏最多一处焦点）
    let nearest: Node | null = null
    let best = 0.035 // progress 距离阈值 ≈ 半屏内
    for (const n of nodes) {
      const d = Math.abs(n.p - progress)
      if (d < best) {
        best = d
        nearest = n
      }
    }
    for (const n of nodes) n.btn.classList.toggle('bloom', n === nearest)

    hudYear.textContent = String(yearForProgress(progress, birthYear, nowYear))
    hudTitle.textContent = nearest ? nearest.m.title : ''
  }

  return { update }
}
