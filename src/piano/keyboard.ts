// 88 键的 DOM 与输入。只吐 onNote，不发声、不画水。
import { KEY_MAP, LAYOUT, type KeyGeom } from './keys.ts'

export type Keyboard = {
  flash(midi: number, self: boolean): void
  setOctave(delta: number): void
  destroy(): void
}

type Opts = {
  onNote(midi: number, vel: number): void
  onKeyUp?(midi: number): void
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const labelOf = (midi: number) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`

export function createKeyboard(root: HTMLElement, opts: Opts): Keyboard {
  const els = new Map<number, HTMLButtonElement>()
  let baseOctave = 4 // 电脑键盘 'a' 对应 C4
  const held = new Set<string>()

  root.innerHTML = ''
  root.setAttribute('role', 'group')
  root.setAttribute('aria-label', '钢琴键盘，88 键')
  // 键组只占一个 Tab 停靠点：容器本身可 Tab 到，88 个键都退出 Tab 序列，
  // 组内导航改由方向键接管（见下面的 moveFocus）。
  root.tabIndex = 0

  const make = (k: KeyGeom) => {
    const el = document.createElement('button')
    el.className = `key ${k.black ? 'black' : 'white'}`
    el.style.left = `${k.x * 100}%`
    el.style.width = `${k.w * 100}%`
    el.dataset.midi = String(k.midi)
    el.type = 'button'
    el.tabIndex = -1
    el.setAttribute('aria-label', labelOf(k.midi))
    els.set(k.midi, el)
    root.appendChild(el)
  }
  // 先铺白键再铺黑键，保证黑键在上层
  LAYOUT.filter((k) => !k.black).forEach(make)
  LAYOUT.filter((k) => k.black).forEach(make)

  const press = (midi: number, vel: number) => opts.onNote(midi, vel)

  // LAYOUT 按 midi 从低到高排列，正好等于键盘从左到右的物理顺序，
  // 所以「下一个/上一个键」直接就是数组里的相邻项。
  const moveFocus = (dir: number) => {
    const active = document.activeElement as HTMLElement | null
    const activeMidi = active?.dataset.midi ? Number(active.dataset.midi) : NaN
    const idx = Number.isNaN(activeMidi) ? -1 : LAYOUT.findIndex((k) => k.midi === activeMidi)
    // 容器刚获焦、还没落到具体键：从中央 C 开始，让手机/键盘用户第一步就落在琴键中段
    const nextIdx = idx === -1 ? LAYOUT.findIndex((k) => k.midi === 60) : Math.min(LAYOUT.length - 1, Math.max(0, idx + dir))
    const next = LAYOUT[nextIdx]
    if (next) els.get(next.midi)?.focus()
  }

  const onPointerDown = (e: PointerEvent) => {
    const el = (e.target as HTMLElement).closest('.key') as HTMLButtonElement | null
    if (!el) return
    e.preventDefault()
    el.focus()
    const rect = el.getBoundingClientRect()
    // 越靠键的下沿力度越大，模拟按得深
    const vel = 0.45 + 0.45 * Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    press(Number(el.dataset.midi), vel)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    // 检查是否在可编辑元素中，是则不处理琴键
    const target = e.target as HTMLElement | null
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target?.isContentEditable
    ) {
      return
    }

    const el = document.activeElement as HTMLElement | null
    if (el?.classList.contains('key') && (e.key === 'Enter' || e.key === ' ')) {
      // Enter/Space 也要检查修饰键，保持与 KEY_MAP 分支一致
      if (e.metaKey || e.ctrlKey || e.altKey) return
      e.preventDefault()
      press(Number(el.dataset.midi), 0.7)
      return
    }

    // 焦点在键组内（容器本身或某个键）时，左右方向键用来在键之间移动焦点，
    // 而不是像 main.ts 里那样移八度——两者互斥，靠「焦点是否在 .keys 内」区分。
    // main.ts 的全局监听会先检查 closest('.keys')，焦点在这里时它会让出。
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && root.contains(el)) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      e.preventDefault()
      moveFocus(e.key === 'ArrowLeft' ? -1 : 1)
      return
    }

    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
    const off = KEY_MAP[e.key.toLowerCase()]
    if (off === undefined) return
    if (held.has(e.key.toLowerCase())) return
    held.add(e.key.toLowerCase())
    press((baseOctave + 1) * 12 + off, 0.72)
  }
  const onKeyUpEvt = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase()
    if (!held.delete(key)) return
    const off = KEY_MAP[key]
    if (off !== undefined) opts.onKeyUp?.((baseOctave + 1) * 12 + off)
  }

  // 窗口失焦时清空按住的键，防止键卡住
  const onBlur = () => {
    held.clear()
  }

  root.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUpEvt)
  window.addEventListener('blur', onBlur)

  return {
    flash(midi, self) {
      const el = els.get(midi)
      if (!el) return
      el.classList.remove('lit', 'lit-self')
      void el.offsetWidth // 强制回流，让同一个键连续两次也能重放动画
      el.classList.add(self ? 'lit-self' : 'lit')
      window.setTimeout(() => el.classList.remove('lit', 'lit-self'), 320)
    },
    setOctave(delta) {
      baseOctave = Math.min(6, Math.max(1, baseOctave + delta))
    },
    destroy() {
      root.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUpEvt)
      window.removeEventListener('blur', onBlur)
      root.innerHTML = ''
    },
  }
}
