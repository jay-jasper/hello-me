// 旧路主题装配。语义内容渲染 + 滚动驱动循环在此接线。
// 只共享 src/config.ts 与 src/content/memories.ts，不 import 深海站模块。

import '@fontsource/noto-serif-sc/400.css'
import '@fontsource/noto-serif-sc/600.css'
import '@fontsource/eb-garamond/400.css'
import '@fontsource/eb-garamond/400-italic.css'
import './style.css'

import { site } from '../config'
import { memories } from '../content/memories'

const journeyEl = document.getElementById('journey')!
const memoriesEl = document.getElementById('memories')!
const prologueEl = document.getElementById('prologue')!
const terminusEl = document.getElementById('terminus')!

// 旧路方向：出生 → 当下，年份升序（与深海站相反）
const ordered = [...memories].sort((a, b) => a.year - b.year)

prologueEl.innerHTML = `
  <div class="signpost">
    <h1>${site.name}</h1>
    <p class="tagline">${site.tagline}</p>
    <p class="hint">沿路而行 ↓</p>
  </div>
`

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
`

// 页面总高：序章 + 每条记忆 + 终点前后留白
const screens = ordered.length + 3
journeyEl.style.height = `${screens * 100}vh`

export {}
