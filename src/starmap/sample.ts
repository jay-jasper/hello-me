// 星图的成形逻辑：符号采样、星点布局、按年归座、粒子分配。
//
// 全是纯函数，不碰 three、不在模块顶层碰 DOM —— node 可以直接 import 跑自检
// （见 sample.check.ts）。唯一需要浏览器的是 rasterizeSymbol()，它把 document
// 的访问关在函数体里，只有浏览器侧调用它；node 侧自己造 Raster 喂进来。

import type { Memory } from '../content/memories.ts'
import type { Constellation } from '../content/constellations.ts'

export type Vec3 = { x: number; y: number; z: number }

/** 符号光栅化的结果：只留 alpha 通道，够采样用了 */
export type Raster = { size: number; alpha: Uint8Array }

export type Star = {
  /** 布局用的确定性键。memory.id 缺席时退回 `${year}-${title}` */
  key: string
  memory: Memory
  pos: Vec3
  /** milestone：更大更亮 */
  big: boolean
}

export type Group = {
  constellation: Constellation
  /** 已按 year 升序 */
  memories: Memory[]
}

/* ============================ 确定性随机 ============================ */

/** FNV-1a。同样的串永远同样的数。 */
export function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** xorshift32。同一个 key 永远给出同一串 [0,1)，刷新页面星星不会跑位。 */
export function rng(key: string): () => number {
  let s = hash(key) || 1
  return () => {
    s ^= s << 13
    s >>>= 0
    s ^= s >> 17
    s ^= s << 5
    s >>>= 0
    return s / 4294967296
  }
}

/** memory.id 是可选字段，但确定性布局要靠它 —— 缺了就用年份加标题兜底 */
export function memoryKey(m: Memory): string {
  return m.id || `${m.year}-${m.title}`
}

/* ============================ 归座 ============================ */

/**
 * 记忆按 year 落进星座区间。
 * 区间必须互不重叠且按 yearFrom 升序；空星座报错。这些都是数据错，不该悄悄画出个空场。
 */
export function groupByConstellation(
  memories: readonly Memory[],
  constellations: readonly Constellation[],
): Group[] {
  if (constellations.length === 0) throw new Error('constellations 为空')

  for (let i = 0; i < constellations.length; i++) {
    const c = constellations[i]
    if (c.yearFrom > c.yearTo) {
      throw new Error(`星座 ${c.id}：yearFrom(${c.yearFrom}) 大于 yearTo(${c.yearTo})`)
    }
    const prev = constellations[i - 1]
    if (prev && c.yearFrom <= prev.yearTo) {
      throw new Error(
        `星座 ${c.id} 与 ${prev.id} 区间重叠或未按 yearFrom 升序：` +
          `${prev.yearFrom}-${prev.yearTo} 之后是 ${c.yearFrom}-${c.yearTo}`,
      )
    }
  }

  const groups = constellations.map((constellation) => ({
    constellation,
    memories: memories
      .filter((m) => m.year >= constellation.yearFrom && m.year <= constellation.yearTo)
      .sort((a, b) => a.year - b.year),
  }))

  const empty = groups.find((g) => g.memories.length === 0)
  if (empty) {
    throw new Error(
      `星座 ${empty.constellation.id}（${empty.constellation.yearFrom}-${empty.constellation.yearTo}）` +
        `区间内没有任何记忆。要么补一条记忆，要么删掉这一座。`,
    )
  }

  return groups
}

/** 星座太多页面会长到没人滚得完。不是错，只是提醒。 */
export const MAX_COMFORTABLE_CONSTELLATIONS = 7

export function overlongWarning(count: number): string | null {
  return count > MAX_COMFORTABLE_CONSTELLATIONS
    ? `星座有 ${count} 座，页面约 ${100 + count * 200}vh 高。超过 ${MAX_COMFORTABLE_CONSTELLATIONS} 座建议合并。`
    : null
}

/* ============================ 符号 → 点云 ============================ */

/**
 * 把 24×24 viewBox 里的 SVG path 描边画进离屏 canvas，只取 alpha。
 * 唯一需要浏览器的函数 —— document 的访问关在函数体内，import 本模块不触发。
 */
export function rasterizeSymbol(pathData: string, size = 512, lineWidth = 0.34): Raster {
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('拿不到 2d context，无法光栅化符号')

  ctx.clearRect(0, 0, size, size)
  ctx.scale(size / 24, size / 24)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = lineWidth
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.stroke(new Path2D(pathData))

  const rgba = ctx.getImageData(0, 0, size, size).data
  const alpha = new Uint8Array(size * size)
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3]
  return { size, alpha }
}

export type SampleOptions = {
  /** 符号在世界坐标里的边长 */
  scale?: number
  /** 沿线撒开的抖动，符号边缘要碎成颗粒而不是一根实心发光管 */
  jitter?: number
  /** z 向厚度，拖拽旋转时才看得出是体积 */
  depth?: number
  /** alpha 高于此值算命中 */
  threshold?: number
}

/**
 * alpha 拒绝采样：命中的像素里随机取 count 个点。
 * 一条路径同时吃描边与填充、吃任何 SVG —— 比按路径长度取点简单，且拐角不堆点。
 */
export function sampleRaster(
  raster: Raster,
  count: number,
  key: string,
  opts: SampleOptions = {},
): Float32Array {
  const { scale = 2.7, jitter = 0.05, depth = 0.3, threshold = 128 } = opts
  const { size, alpha } = raster

  const hits: number[] = []
  for (let i = 0; i < alpha.length; i++) {
    if (alpha[i] > threshold) hits.push(i)
  }
  if (hits.length === 0) throw new Error(`符号 ${key} 光栅化后没有任何不透明像素`)

  const out = new Float32Array(count * 3)
  const r = rng('symbol:' + key)
  for (let i = 0; i < count; i++) {
    const idx = hits[Math.floor(r() * hits.length)]
    // 像素内再抖一次，否则点会排在整数格上显出网格
    const px = ((idx % size) + r()) / size - 0.5
    const py = (Math.floor(idx / size) + r()) / size - 0.5
    out[i * 3] = px * scale + (r() - 0.5) * jitter
    out[i * 3 + 1] = -py * scale + (r() - 0.5) * jitter
    out[i * 3 + 2] = (r() - 0.5) * depth
  }
  return out
}

/* ============================ 星点布局 ============================ */

export type LayoutOptions = {
  radius?: number
  depth?: number
  /**
   * 旋臂布局：时间自中心向外盘旋。开场的总星云用它 ——
   * 等半径的弧会把几十颗星连成一条项链，旋臂才看得出「一生」的形状。
   */
  spiral?: boolean
}

export function layoutStars(memories: readonly Memory[], opts: LayoutOptions = {}): Star[] {
  const { radius = 2.35, depth = 1.1, spiral = false } = opts
  const sorted = [...memories].sort((a, b) => a.year - b.year)

  return sorted.map((memory, i) => {
    const key = memoryKey(memory)
    const r = rng(key)
    const t = sorted.length === 1 ? 0.5 : i / (sorted.length - 1)

    if (spiral) {
      // 开场：旋臂，时间自中心向外盘旋
      const ang = t * Math.PI * 3.3 + (r() - 0.5) * 0.45
      const rad = radius * (0.12 + 0.88 * t) * (0.75 + r() * 0.5)
      return {
        key,
        memory,
        pos: {
          x: Math.cos(ang) * rad * 1.15,
          y: Math.sin(ang) * rad * 0.72 + (r() - 0.5) * 0.5,
          z: (r() - 0.5) * depth,
        },
        big: memory.kind === 'milestone',
      }
    }

    // 单座：横向时间轴，早的在左、晚的在右，拱起一道倾斜的缓弧。
    // 不用等半径圆弧 —— 星少时（两三颗）圆弧的端点会一起甩到同一侧，整座缩在屏幕边缘。
    // 横跨幅度随星数长：两颗星铺满全宽会顶到左右边框，还会把连线拉成一条横穿正文的直线。
    const span = 0.45 + 0.35 * Math.min(1, (sorted.length - 1) / 5)
    return {
      key,
      memory,
      pos: {
        // 整座左移：右侧三分之一留给记忆卡片，星不压字
        x: (t - 0.5) * 2 * radius * span - radius * 0.32 + (r() - 0.5) * 0.3,
        y:
          Math.sin(t * Math.PI) * radius * 0.3 +
          (t - 0.5) * radius * 0.45 -
          radius * 0.1 +
          (r() - 0.5) * 0.45,
        z: (r() - 0.5) * depth,
      },
      big: memory.kind === 'milestone',
    }
  })
}

/** 按年份顺序连成折线 —— 线本身就是时间。单星座没有线。 */
export function linePositions(stars: readonly Star[]): Float32Array {
  if (stars.length < 2) return new Float32Array(0)
  const out = new Float32Array((stars.length - 1) * 6)
  for (let i = 0; i < stars.length - 1; i++) {
    const a = stars[i].pos
    const b = stars[i + 1].pos
    out.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6)
  }
  return out
}

/* ============================ 粒子分配 ============================ */

export type Particles = {
  /** 星点态位置 */
  aStar: Float32Array
  aSeed: Float32Array
  aSize: Float32Array
  aColor: Float32Array
  /** 每颗星实际分到多少粒子（已封顶）。前 perStar * 星数 个粒子是星，其余是尘。 */
  perStar: number
}

/** 只有三成粒子聚成星，其余是尘。聚太多就不是星，是棉花团。 */
export const CLUSTERED_RATIO = 0.3

/**
 * 一颗星最多吃多少粒子。这个数比直觉小得多是有原因的：additive 叠加下，
 * 几百个点挤在一起必然烧成一枚纯白的饼，星芒和杂色全被吞掉。
 * 真实的星团是稀疏一撮加一两颗带芒的亮点 —— 亮度靠 aSize 的长尾，不靠堆料。
 */
export const MAX_PARTICLES_PER_STAR = 120

/**
 * 粒子总数随星数缩放。
 * 写死一个大数在星少的星座上会把画面糊满：两颗星分 30000 个粒子，
 * 每颗都是一坨过曝的棉花。星少就该少画。
 */
export function particleCount(starCount: number, max: number): number {
  return Math.min(max, 3000 + starCount * 3000)
}

/**
 * 把 count 个粒子分给星与尘。
 * 符号态所有粒子都在符号上（那份由 sampleRaster 给），这里只算星点态那一头 ——
 * 两态共用同一批粒子，shader 里 mix(aSymbol, aStar, uProgress) 就是全部的「塌陷」。
 */
export function buildParticles(stars: readonly Star[], count: number): Particles {
  if (stars.length === 0) throw new Error('buildParticles: 没有星')

  const aStar = new Float32Array(count * 3)
  const aSeed = new Float32Array(count)
  const aSize = new Float32Array(count)
  const aColor = new Float32Array(count * 3)

  const perStar = Math.min(
    MAX_PARTICLES_PER_STAR,
    Math.max(1, Math.floor((count * CLUSTERED_RATIO) / stars.length)),
  )
  const clusteredCount = Math.min(count, perStar * stars.length)

  for (let i = 0; i < count; i++) {
    const r = rng('p' + i)
    aSeed[i] = r()

    if (i < clusteredCount) {
      const s = stars[Math.floor(i / perStar)]
      const spread = s.big ? 0.13 : 0.09
      // box-muller：聚成球而不是方块
      const g = () => {
        const u = Math.max(r(), 1e-6)
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r())
      }
      aStar[i * 3] = s.pos.x + g() * spread
      aStar[i * 3 + 1] = s.pos.y + g() * spread
      aStar[i * 3 + 2] = s.pos.z + g() * spread
      // 少数几颗撑起星芒，其余压小：靠数量差拉层次，不靠整体加亮
      // 一成的粒子拿到 3 倍尺寸 —— 星芒来自这几颗，不是来自整簇一起变亮
      aSize[i] = (s.big ? 2.2 : 1.5) * (0.3 + (r() < 0.1 ? 3.0 : 0.5) * r())
    } else {
      // 尘：半径开方分布，中心也有一点，不然星云会中空成一个甜甜圈；
      // 外缘收在 3.6 以内 —— 相机 z=6、fov 50 时视野半高约 2.8，再远就只是铺满边框的噪点
      const th = r() * Math.PI * 2
      const ph = Math.acos(2 * r() - 1)
      const rad = 0.6 + Math.sqrt(r()) * 3.0
      aStar[i * 3] = Math.sin(ph) * Math.cos(th) * rad
      aStar[i * 3 + 1] = Math.sin(ph) * Math.sin(th) * rad * 0.62
      aStar[i * 3 + 2] = Math.cos(ph) * rad * 0.75
      aSize[i] = 0.22 + r() * 0.48
    }

    // 冷白为主，少量暖橙 / 冷蓝杂色。纯白一片会假。
    const c = r()
    const col = c < 0.07 ? [1.0, 0.7, 0.42] : c < 0.15 ? [0.58, 0.76, 1.0] : [0.9, 0.94, 1.0]
    aColor[i * 3] = col[0]
    aColor[i * 3 + 1] = col[1]
    aColor[i * 3 + 2] = col[2]
  }

  return { aStar, aSeed, aSize, aColor, perStar }
}

/* ============================ 滚动编排 ============================ */

/** 每座占几屏 */
export const SECTION_VH = 200

/**
 * 节内进度 → 符号塌陷进度。
 *   0 → .35   汇聚成符号（uProgress 保持 0）
 * .35 → .55   符号稳住
 * .55 → .85   塌成星点（0 → 1）
 * .85 → 1     星点保持
 */
export function collapseProgress(sectionProgress: number): number {
  const t = (sectionProgress - 0.55) / 0.3
  return Math.max(0, Math.min(1, t))
}

/** 星座名与一句话的显隐窗口 */
export function captionOpacity(sectionProgress: number): number {
  if (sectionProgress < 0.12) return Math.max(0, sectionProgress / 0.12)
  if (sectionProgress > 0.9) return Math.max(0, (1 - sectionProgress) / 0.1)
  return 1
}

/** 记忆卡片的显隐窗口：星点开始成形之后才浮现 */
export function cardsOpacity(sectionProgress: number): number {
  if (sectionProgress < 0.62) return 0
  if (sectionProgress > 0.9) return Math.max(0, (1 - sectionProgress) / 0.1)
  return Math.min(1, (sectionProgress - 0.62) / 0.12)
}
