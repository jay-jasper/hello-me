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

  const make = (k: KeyGeom) => {
    const el = document.createElement('button')
    el.className = `key ${k.black ? 'black' : 'white'}`
    el.style.left = `${k.x * 100}%`
    el.style.width = `${k.w * 100}%`
    el.dataset.midi = String(k.midi)
    el.type = 'button'
    el.setAttribute('aria-label', labelOf(k.midi))
    els.set(k.midi, el)
    root.appendChild(el)
  }
  // 先铺白键再铺黑键，保证黑键在上层
  LAYOUT.filter((k) => !k.black).forEach(make)
  LAYOUT.filter((k) => k.black).forEach(make)

  const press = (midi: number, vel: number) => opts.onNote(midi, vel)

  const onPointerDown = (e: PointerEvent) => {
    const el = (e.target as HTMLElement).closest('.key') as HTMLButtonElement | null
    if (!el) return
    e.preventDefault()
    const rect = el.getBoundingClientRect()
    // 越靠键的下沿力度越大，模拟按得深
    const vel = 0.45 + 0.45 * Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    press(Number(el.dataset.midi), vel)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const el = document.activeElement as HTMLElement | null
    if (el?.classList.contains('key') && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      press(Number(el.dataset.midi), 0.7)
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

  root.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUpEvt)

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
      root.innerHTML = ''
    },
  }
}
