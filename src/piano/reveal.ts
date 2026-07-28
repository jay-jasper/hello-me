// 记忆浮字层。真实 DOM 文本 + aria-live，屏幕阅读器能读到；不画进 canvas。
import { memories } from '../content/memories.ts'

export type Reveal = { show(memoryId: string): void; clear(): void }

const HOLD_MS = 6000
const REMOVAL_MS = 900 // 必须与 src/piano/style.css 中的过渡时长同步

export function createReveal(
  root: HTMLElement,
  opts: { reduced: boolean; onDim(dim: number): void },
): Reveal {
  root.setAttribute('aria-live', 'polite')
  let timer = 0
  let currentEl: HTMLElement | null = null
  let rafHandle: number | null = null

  const clear = () => {
    window.clearTimeout(timer)
    if (rafHandle !== null) {
      cancelAnimationFrame(rafHandle)
      rafHandle = null
    }
    if (currentEl) {
      const el = currentEl
      el.classList.remove('in')
      window.setTimeout(() => el.remove(), REMOVAL_MS)
      currentEl = null
    }
    opts.onDim(1)
  }

  return {
    clear,
    show(memoryId) {
      const m = memories.find((x) => x.id === memoryId)
      if (!m) {
        console.warn(`[piano] 找不到记忆 ${memoryId}`)
        clear() // 保证图层回到一致的状态
        return
      }
      clear() // 同一时刻只允许一条

      const el = document.createElement('article')
      el.className = `memory${opts.reduced ? ' reduced' : ''}`
      el.innerHTML =
        `<p class="memory-year">${m.year}</p>` +
        `<h2 class="memory-title">${m.title}</h2>` +
        m.story.map((s) => `<p class="memory-line">${s}</p>`).join('')
      root.appendChild(el)
      currentEl = el

      // 下一帧再加 in，保证过渡生效
      rafHandle = requestAnimationFrame(() => {
        // 只在这个元素仍是当前的情况下才添加 in，防止已离场元素被重新激活
        if (currentEl === el) {
          el.classList.add('in')
        }
      })
      opts.onDim(0.65) // 文字在场时水面压暗 35%

      timer = window.setTimeout(clear, HOLD_MS)
    },
  }
}
