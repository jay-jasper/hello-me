// 2D 分层场景：AI 生成的芙莉莲画风素材（src/road/assets/）+ 代码只做视差与时刻调色。
// 构图五律（spec）：低地平线 66%；云是主角；旅人 ≤8vh 且在下 1/3；稀疏；黄昏剪影。

import { skyAt, meadowAt, hazeMix, oklchCss, phaseAt } from './journey'
import cloudsUrl from './assets/clouds.png'
import mountainsUrl from './assets/mountains.png'
import meadowUrl from './assets/meadow.png'
import roadUrl from './assets/road.png'
import grassfgUrl from './assets/grassfg.png'
import walk1 from './assets/walk-1.png'
import walk2 from './assets/walk-2.png'
import walk3 from './assets/walk-3.png'
import walk4 from './assets/walk-4.png'

export type Scenery = {
  update(progress: number, velocity: number): void
  roadLayer: HTMLElement
  worldWidth: number // px，speed=1 层的世界宽度
}

// 视差速率（spec 表）
const SPEEDS = { sky: 0.05, mountains: 0.15, meadow: 0.4, road: 1.0, foreground: 1.6 }

function el(tag: string, cls: string, parent: Element): HTMLElement {
  const node = document.createElement(tag)
  node.className = cls
  parent.appendChild(node)
  return node
}

export function createScenery(stage: HTMLElement, screens: number): Scenery {
  const vw = window.innerWidth
  const worldWidth = (screens - 1) * vw
  const widthFor = (speed: number) => Math.ceil(worldWidth * speed + vw)

  // ---- L0 天空（CSS 渐变，完美插值）+ 云带（画作素材，repeat-x） ----
  const sky = el('div', 'layer sky', stage)
  sky.style.width = `${widthFor(SPEEDS.sky)}px`
  const clouds = el('div', 'clouds', sky)
  clouds.style.backgroundImage = `url(${cloudsUrl})`

  // ---- L1 远山 ----
  const mountains = el('div', 'layer mountains', stage)
  mountains.style.width = `${widthFor(SPEEDS.mountains)}px`
  mountains.style.backgroundImage = `url(${mountainsUrl})`

  // ---- L2 原野（含树，素材自带）+ 云影 ----
  const meadow = el('div', 'layer meadow', stage)
  const meW = widthFor(SPEEDS.meadow)
  meadow.style.width = `${meW}px`
  meadow.style.backgroundImage = `url(${meadowUrl})`
  for (let i = 0; i < Math.round(meW / vw); i++) {
    const s = el('div', 'cloud-shadow', meadow)
    s.style.left = `${((i + 0.3) * vw).toFixed(0)}px`
    s.style.animationDelay = `${(-i * 17).toFixed(1)}s`
    s.style.animationDuration = `${(50 + (i % 4) * 12).toFixed(1)}s`
  }

  // ---- L3 路面（花丛挂载层） ----
  const road = el('div', 'layer road', stage)
  road.style.width = `${widthFor(SPEEDS.road)}px`
  const roadArt = el('div', 'road-art', road)
  roadArt.style.backgroundImage = `url(${roadUrl})`

  // ---- L4 近景草（外层视差，内层风摆） ----
  const fg = el('div', 'layer foreground', stage)
  fg.style.width = `${widthFor(SPEEDS.foreground)}px`
  const fgArt = el('div', 'fg-art', fg)
  fgArt.style.backgroundImage = `url(${grassfgUrl})`

  // ---- 旅人（侧面走路循环帧，不随层平移，fixed 在左 1/3） ----
  const WALK_FRAMES = [walk1, walk2, walk3, walk4]
  const traveler = el('div', 'traveler', stage)
  const travelerImg = el('img', 'traveler-img', traveler) as HTMLImageElement
  travelerImg.src = WALK_FRAMES[0]
  travelerImg.alt = ''
  for (const f of WALK_FRAMES) new Image().src = f // 预热，防换帧闪烁

  // ---- 时刻调色幕（multiply 染色，让画作素材随路程变时刻） ----
  const tint = el('div', 'scene-tint', stage)

  const layers: [HTMLElement, number][] = [
    [sky, SPEEDS.sky],
    [mountains, SPEEDS.mountains],
    [meadow, SPEEDS.meadow],
    [road, SPEEDS.road],
    [fg, SPEEDS.foreground],
  ]

  let walked = 0

  function update(progress: number, velocity: number) {
    const worldX = progress * worldWidth
    for (const [layer, speed] of layers) {
      layer.style.transform = `translate3d(${(-worldX * speed).toFixed(1)}px,0,0)`
    }

    const skyC = skyAt(progress)
    const meadowC = meadowAt(progress)
    const phase = phaseAt(progress)

    const s = stage.style
    s.setProperty('--sky-now', oklchCss(skyC))
    s.setProperty('--sky-low', oklchCss(hazeMix(skyC, { l: 0.97, c: 0.02, h: skyC.h }, 0.45)))
    s.setProperty('--meadow-now', oklchCss(meadowC))

    // 时刻调色：画面向当前时刻色 multiply 染色，夜里加深
    // 染色强度：白昼几乎不染（素材本色即白昼），晨/昏轻染，夜重染
    const dayness = 1 - Math.min(1, Math.abs(progress - 0.35) / 0.35) // 0.35 处为 1
    const tintAlpha = 0.55 * (1 - dayness)
    s.setProperty('--tint-color', oklchCss(hazeMix({ l: 0.95, c: 0.01, h: skyC.h }, skyC, 0.85)))
    s.setProperty('--tint-alpha', tintAlpha.toFixed(3))
    // 夜里整体压暗（brightness 由 1 → 0.45）
    const night = progress > 0.7 ? (progress - 0.7) / 0.3 : 0
    s.setProperty('--scene-brightness', (1 - night * 0.55).toFixed(3))
    s.setProperty('--scene-saturate', (1 - night * 0.25).toFixed(3))
    s.setProperty('--night-amount', night.toFixed(3)) // 静态星空淡入用

    // 黄昏剪影律：旅人压黑；夜里稍缓
    const duskiness = phase === 'dusk' ? 1 : phase === 'night' ? 0.75 : 0
    s.setProperty('--traveler-darken', (1 - duskiness * 0.85).toFixed(3))
    s.setProperty('--cloud-shadow-opacity', phase === 'day' ? '0.10' : phase === 'dawn' ? '0.05' : '0')
    // 夜里云退场给星
    clouds.style.opacity = phase === 'night' ? '0.12' : '0.9'

    // 旅人：走路循环帧（速度驱动），停下转 idle 摇曳，倒走镜像
    const moving = Math.abs(velocity) * worldWidth > 0.5
    walked += Math.abs(velocity) * worldWidth
    if (moving) {
      travelerImg.src = WALK_FRAMES[Math.floor(walked / 90) % WALK_FRAMES.length]
    }
    traveler.classList.toggle('idle', !moving)
    traveler.classList.toggle('backward', velocity < -0.00002)
    traveler.classList.toggle('arrived', progress > 0.94)
    document.body.style.background = oklchCss(skyC)
    void tint // tint 元素只靠 CSS 变量驱动
  }

  return { update, roadLayer: road, worldWidth }
}
