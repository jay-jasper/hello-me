import './style.css'
import * as Tone from 'tone'
import { createInstrument } from './instrument.ts'
import { createKeyboard } from './keyboard.ts'
import { centerX, pitch01 } from './keys.ts'
import { createPlayer, shuffled } from './player.ts'
import { createReveal } from './reveal.ts'
import { createWater } from './water.ts'
import { PIECES } from './pieces.ts'
import type { Piece } from './score.ts'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const mobile = matchMedia('(max-width: 780px)').matches

const water = createWater($<HTMLCanvasElement>('water'), {
  cap: mobile ? 24 : 48,
  reduced,
})
const reveal = createReveal($('memory-layer'), { reduced, onDim: (d) => water.setDim(d) })

// @vite-ignore：这是目录引用（末尾斜杠），不是具体文件。Vite 的静态资源分析会把它当成
// 待重写的资源路径，重写时会丢掉末尾的斜杠（'.../assets/salamander/' 变成
// '.../assets/salamander'，少了结尾的 /）。Tone.Sampler 内部用字符串拼接
// baseUrl + 文件名，斜杠一丢，所有采样请求都会拼成 'salamanderA0.mp3' 这种
// 少了路径分隔符的坏地址，安静地 404/超时，采样永远加载不完。
// 加这行注释让 Vite 完全跳过这一句的重写，交给浏览器原生 URL 解析，斜杠才能保住。
const instrument = createInstrument(
  new URL(/* @vite-ignore */ './assets/salamander/', import.meta.url).href,
)

/** 一个音发生了：亮键 + 起涟漪。self = 用户弹的。 */
const strikeVisual = (midi: number, vel: number, self: boolean) => {
  keyboard.flash(midi, self)
  water.splash(centerX(midi), vel, pitch01(midi), self)
}

const keyboard = createKeyboard($('keys'), {
  onNote: (midi, vel) => {
    instrument.attack(midi, vel)
    window.setTimeout(() => instrument.release(midi), 900)
    strikeVisual(midi, vel, true)
    duck()
  },
})

const player = createPlayer(instrument, {
  onNote: (midi, vel) => strikeVisual(midi, vel, false),
  onAnchor: (memory) => reveal.show(memory),
  onEnd: () => nextPiece(),
})

/* ---------- 用户弹奏时曲子让路 ---------- */
let userNotes = 0
let duckTimer = 0
function duck() {
  userNotes++
  if (userNotes >= 8) instrument.setVolume(-6)
  window.clearTimeout(duckTimer)
  duckTimer = window.setTimeout(() => {
    userNotes = 0
    instrument.setVolume(0)
  }, 4000)
}

/* ---------- 随机不重复连播 ---------- */
let queue: Piece[] = []
function nextPiece() {
  if (!queue.length) queue = shuffled(PIECES)
  const piece = queue.shift()!
  $('np-title').textContent = piece.title
  $('np-mood').textContent = piece.mood
  $('latin').textContent = piece.latin
  reveal.clear()
  void player.play(piece)
}

/* ---------- 进度条 ---------- */
function tickProgress() {
  $('np-bar').style.width = `${(player.progress() * 100).toFixed(2)}%`
  requestAnimationFrame(tickProgress)
}

/* ---------- 开场闸门 ---------- */
let started = false
async function start() {
  if (started) return
  started = true
  $('gate').classList.add('gone')
  window.setTimeout(() => $('gate').setAttribute('hidden', ''), 800)
  water.start()
  tickProgress()

  try {
    await Tone.start()
    await Promise.race([
      instrument.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('采样加载超时')), 8000)),
    ])
  } catch (err) {
    console.warn('[piano] 进入静音模式：', err)
    $('fallback-note').removeAttribute('hidden')
  }

  document.querySelector('.now-playing')!.removeAttribute('hidden')
  $('controls').removeAttribute('hidden')
  nextPiece()
}

window.addEventListener('keydown', start, { once: true })
window.addEventListener('pointerdown', start, { once: true })

/* ---------- 控件与快捷键 ---------- */
$('btn-pause').addEventListener('click', () => (player.playing ? player.pause() : player.resume()))
$('btn-next').addEventListener('click', () => nextPiece())

window.addEventListener('keydown', (e) => {
  if (!started) return
  if (e.key === ' ') {
    e.preventDefault()
    player.playing ? player.pause() : player.resume()
  } else if (e.key.toLowerCase() === 'n') {
    nextPiece()
  } else if (e.key === 'ArrowLeft') {
    keyboard.setOctave(-1)
  } else if (e.key === 'ArrowRight') {
    keyboard.setOctave(1)
  }
})

/* ---------- 切后台不跳音 ---------- */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (player.playing) player.pause()
    water.stop()
  } else if (started) {
    water.start()
  }
})
