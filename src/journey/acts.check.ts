// acts.ts 自检。跑法：node src/journey/acts.check.ts
import assert from 'node:assert'
import { frameOpacity, actAt, kenBurns, layout, yearAt } from './acts.ts'

// 透明度端值与渐变带
assert.equal(frameOpacity(1, 0), 1)
assert.equal(frameOpacity(2, 0), 0)
assert.equal(frameOpacity(3, 1), 1)
assert.ok(Math.abs(frameOpacity(1, 1 / 3) - 0.5) < 0.01)
assert.ok(Math.abs(frameOpacity(2, 1 / 3) - 0.5) < 0.01)
// 任意进度三帧之和 ≈ 1
for (const p of [0, 0.2, 1 / 3, 0.5, 2 / 3, 0.8, 1]) {
  const sum = frameOpacity(1, p) + frameOpacity(2, p) + frameOpacity(3, p)
  assert.ok(Math.abs(sum - 1) < 0.01, `sum!=1 at ${p}: ${sum}`)
}

// 幕边界
assert.equal(actAt(0.1), 1)
assert.equal(actAt(0.5), 2)
assert.equal(actAt(0.9), 3)

// 推镜范围
assert.ok(Math.abs(kenBurns(1, 0).scale - 1.02) < 0.001)
assert.ok(Math.abs(kenBurns(1, 1 / 3).scale - 1.07) < 0.001)
assert.ok(Math.abs(kenBurns(2, 1 / 3).scale - 1.02) < 0.001)

// 记忆分幕（1994 出生：阈值 2016）
const years = [2000, 2006, 2012, 2016, 2018, 2021, 2023, 2026]
const slots = layout(years, 1994)
assert.equal(slots.length, 8)
assert.deepEqual(
  slots.map((s) => s.act),
  [1, 1, 1, 1, 2, 2, 2, 2],
)
// 触发单调且避开渐变带
for (let i = 1; i < slots.length; i++) assert.ok(slots[i].trigger > slots[i - 1].trigger)
for (const s of slots) {
  assert.ok(Math.abs(s.trigger - 1 / 3) > 1 / 18 && Math.abs(s.trigger - 2 / 3) > 1 / 18, `slot in band: ${s.trigger}`)
}
// 全在一侧时对半分
const oneSide = layout([2018, 2020, 2022, 2024], 1994)
assert.ok(oneSide.some((s) => s.act === 1) && oneSide.some((s) => s.act === 2))

// 年份反解：端点与单调
assert.equal(yearAt(0, slots, 1994, 2026), 1994)
assert.equal(yearAt(0.9, slots, 1994, 2026), 2026)
let prev = 1993
for (let p = 0; p <= 1.001; p += 0.05) {
  const y = yearAt(p, slots, 1994, 2026)
  assert.ok(y >= prev, `year not monotonic at ${p}`)
  prev = y
}

console.log('acts ok')
