// sample.ts 自检。跑法：node src/starmap/sample.check.ts
// 光栅化那步用合成位图，不需要浏览器。

import assert from 'node:assert'
import {
  buildParticles,
  captionOpacity,
  cardsOpacity,
  collapseProgress,
  groupByConstellation,
  layoutStars,
  linePositions,
  MAX_PARTICLES_PER_STAR,
  memoryKey,
  overlongWarning,
  particleCount,
  rng,
  sampleRaster,
  type Raster,
} from './sample.ts'
import { constellations } from '../content/constellations.ts'
import { memories, type Memory } from '../content/memories.ts'

/* ---------- 合成位图：一条对角线 ---------- */
function diagonal(size: number): Raster {
  const alpha = new Uint8Array(size * size)
  for (let i = 0; i < size; i++) alpha[i * size + i] = 255
  return { size, alpha }
}

/* ---------- 采样：数量对、且全部落在不透明像素上 ---------- */
{
  const SIZE = 64
  const raster = diagonal(SIZE)
  const COUNT = 500
  const pts = sampleRaster(raster, COUNT, 'diag', { scale: 2, jitter: 0, depth: 0 })

  assert.equal(pts.length, COUNT * 3, '采样点数量应为 count * 3')

  for (let i = 0; i < COUNT; i++) {
    // 反推回像素格：scale=2 时 x = (px/SIZE - .5) * 2，故 px = (x/2 + .5) * SIZE
    const gx = Math.floor((pts[i * 3] / 2 + 0.5) * SIZE)
    const gy = Math.floor((-pts[i * 3 + 1] / 2 + 0.5) * SIZE)
    assert.ok(raster.alpha[gy * SIZE + gx] > 128, `第 ${i} 个采样点落在了透明像素上 (${gx},${gy})`)
  }
}

/* ---------- 空符号必须报错，不能悄悄画个空场 ---------- */
assert.throws(
  () => sampleRaster({ size: 8, alpha: new Uint8Array(64) }, 10, 'blank'),
  /没有任何不透明像素/,
)

/* ---------- 确定性：同一个 key 两次完全一致 ---------- */
{
  const a = rng('2011-first-code')
  const b = rng('2011-first-code')
  for (let i = 0; i < 20; i++) assert.equal(a(), b(), 'rng 对同一个 key 应完全一致')
}

{
  const sample: Memory[] = [
    { id: 'a', year: 2001, kind: 'moment', title: '甲', story: [] },
    { id: 'b', year: 2004, kind: 'milestone', title: '乙', story: [] },
  ]
  const first = layoutStars(sample)
  const second = layoutStars(sample)
  for (let i = 0; i < first.length; i++) {
    assert.deepEqual(first[i].pos, second[i].pos, '同一批记忆两次布局坐标必须一致')
  }
}

/* ---------- 缺 id 的记忆走兜底键，同样确定性 ---------- */
{
  const noId: Memory[] = [
    { year: 1999, kind: 'moment', title: '无名', story: [] },
    { year: 2002, kind: 'moment', title: '也无名', story: [] },
  ]
  assert.equal(memoryKey(noId[0]), '1999-无名')
  const first = layoutStars(noId)
  const second = layoutStars(noId)
  for (let i = 0; i < first.length; i++) {
    assert.deepEqual(first[i].pos, second[i].pos, '缺 id 的记忆也必须两次一致')
  }
  // 兜底键要能区分开不同记忆
  assert.notDeepEqual(first[0].pos, first[1].pos)
}

/* ---------- 归座：真实数据每座非空，且顺序正确 ---------- */
{
  const groups = groupByConstellation(memories, constellations)
  assert.equal(groups.length, constellations.length)

  for (const g of groups) {
    assert.ok(g.memories.length > 0, `星座 ${g.constellation.id} 是空的`)
    for (const m of g.memories) {
      assert.ok(
        m.year >= g.constellation.yearFrom && m.year <= g.constellation.yearTo,
        `记忆 ${m.year} 归错了座 ${g.constellation.id}`,
      )
    }
    for (let i = 1; i < g.memories.length; i++) {
      assert.ok(g.memories[i - 1].year <= g.memories[i].year, '座内记忆应按年份升序')
    }
  }

  // 每条记忆都得有归宿，否则站主写了却看不见
  const placed = groups.reduce((n, g) => n + g.memories.length, 0)
  assert.equal(placed, memories.length, '有记忆没落进任何星座区间')
}

/* ---------- 归座：区间重叠 / 乱序 / 空座 / 反区间都要报错 ---------- */
{
  const base = { symbol: 'M0 0L1 1', ambient: '#000', blurb: '' }
  const m: Memory[] = [{ id: 'x', year: 2000, kind: 'moment', title: 'x', story: [] }]

  assert.throws(
    () =>
      groupByConstellation(m, [
        { id: 'a', name: 'A', yearFrom: 1990, yearTo: 2005, ...base },
        { id: 'b', name: 'B', yearFrom: 2000, yearTo: 2010, ...base },
      ]),
    /重叠或未按 yearFrom 升序/,
  )

  assert.throws(
    () =>
      groupByConstellation(m, [
        { id: 'b', name: 'B', yearFrom: 2006, yearTo: 2010, ...base },
        { id: 'a', name: 'A', yearFrom: 1990, yearTo: 2005, ...base },
      ]),
    /重叠或未按 yearFrom 升序/,
  )

  assert.throws(
    () =>
      groupByConstellation(m, [
        { id: 'a', name: 'A', yearFrom: 1990, yearTo: 2005, ...base },
        { id: 'empty', name: '空', yearFrom: 2006, yearTo: 2010, ...base },
      ]),
    /没有任何记忆/,
  )

  assert.throws(
    () => groupByConstellation(m, [{ id: 'a', name: 'A', yearFrom: 2005, yearTo: 1990, ...base }]),
    /大于 yearTo/,
  )
}

/* ---------- 星座过多只警告，不报错 ---------- */
assert.equal(overlongWarning(7), null)
assert.match(String(overlongWarning(9)), /9 座/)

/* ---------- 连线：n 颗星 n-1 段，单星无线，顺序即时间 ---------- */
{
  const stars = layoutStars([
    { id: 'a', year: 2001, kind: 'moment', title: '甲', story: [] },
    { id: 'b', year: 2002, kind: 'moment', title: '乙', story: [] },
    { id: 'c', year: 2003, kind: 'moment', title: '丙', story: [] },
  ])
  assert.equal(linePositions(stars).length, 2 * 6)
  assert.equal(linePositions(stars.slice(0, 1)).length, 0, '单颗星不该有连线')

  // Float32Array 存不下 double 的尾数，比较要留容差
  const seg = linePositions(stars)
  assert.ok(Math.abs(seg[0] - stars[0].pos.x) < 1e-6, '第一段应从最早那颗星起')
  assert.ok(Math.abs(seg[1] - stars[0].pos.y) < 1e-6)
}

/* ---------- 粒子分配：长度对、无 NaN、星尘比例合理 ---------- */
{
  const stars = layoutStars(memories.slice(0, 4))
  const COUNT = 2000
  const p = buildParticles(stars, COUNT)

  assert.equal(p.aStar.length, COUNT * 3)
  assert.equal(p.aSeed.length, COUNT)
  assert.equal(p.aSize.length, COUNT)
  assert.equal(p.aColor.length, COUNT * 3)

  for (let i = 0; i < COUNT * 3; i++) {
    assert.ok(Number.isFinite(p.aStar[i]), `aStar[${i}] 不是有限数`)
  }
  for (let i = 0; i < COUNT; i++) {
    assert.ok(p.aSize[i] > 0, 'aSize 必须为正')
    assert.ok(p.aSeed[i] >= 0 && p.aSeed[i] < 1, 'aSeed 应在 [0,1)')
  }

  // 聚成星的那批离原点更近；尘铺在 2.2~5.6 的球壳上
  const near = Array.from({ length: COUNT }, (_, i) =>
    Math.hypot(p.aStar[i * 3], p.aStar[i * 3 + 1], p.aStar[i * 3 + 2]),
  ).filter((d) => d < 2.2).length
  assert.ok(near > COUNT * 0.2, `聚成星的粒子太少：${near}/${COUNT}`)
}

assert.throws(() => buildParticles([], 100), /没有星/)

/* ---------- 粒子总数随星数缩放，单星不许吃撑 ---------- */
{
  assert.ok(particleCount(2, 30000) < particleCount(8, 30000), '星多就该多画粒子')
  assert.equal(particleCount(50, 30000), 30000, '上限要夹住')

  // 两颗星的星座：每颗吃到的粒子不能超过封顶，否则 additive 叠加会烧成白饼
  const twoStars = layoutStars([
    { id: 'a', year: 2001, kind: 'milestone', title: '甲', story: [] },
    { id: 'b', year: 2002, kind: 'milestone', title: '乙', story: [] },
  ])
  const count = particleCount(twoStars.length, 30000)
  const p = buildParticles(twoStars, count)

  assert.ok(
    p.perStar <= MAX_PARTICLES_PER_STAR,
    `单颗星分到 ${p.perStar} 个粒子，超过封顶 ${MAX_PARTICLES_PER_STAR}`,
  )
  assert.ok(p.perStar > 0)

  // 再从坐标侧核一次：星心附近的实际密度。判定半径要贴着 spread（0.13），
  // 放宽到 0.5 会把中心尘一起数进来 —— 那不是星吃的。
  for (const s of twoStars) {
    const n = Array.from({ length: count }, (_, i) =>
      Math.hypot(
        p.aStar[i * 3] - s.pos.x,
        p.aStar[i * 3 + 1] - s.pos.y,
        p.aStar[i * 3 + 2] - s.pos.z,
      ),
    ).filter((d) => d < 0.25).length
    assert.ok(n <= MAX_PARTICLES_PER_STAR * 1.3, `星心 0.25 内堆了 ${n} 个粒子，会烧成白饼`)
  }
}

/* ---------- 滚动编排：分段边界与夹取 ---------- */
assert.equal(collapseProgress(0), 0)
assert.equal(collapseProgress(0.55), 0, '.55 之前符号不该开始塌')
// (0.85-0.55)/0.3 在 double 下是 0.9999999999999998，不是 1
assert.ok(collapseProgress(0.85) > 1 - 1e-9, '.85 之后应该塌完')
assert.equal(collapseProgress(1.5), 1, '越界要夹住')
assert.equal(collapseProgress(-1), 0)
assert.ok(collapseProgress(0.7) > 0 && collapseProgress(0.7) < 1)

assert.equal(captionOpacity(0), 0)
assert.equal(captionOpacity(0.5), 1)
assert.equal(captionOpacity(1), 0)
assert.equal(cardsOpacity(0.5), 0, '星点还没成形就不该有卡片')
assert.equal(cardsOpacity(0.8), 1)
assert.equal(cardsOpacity(1), 0)

console.log('sample.check.ts ✓')
