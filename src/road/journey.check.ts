// journey.ts 自检。跑法：node src/road/journey.check.ts（Node 22+ 原生剥类型）
import assert from 'node:assert'
import { skyAt, meadowAt, oklchCss, hazeMix, progressForYear, phaseAt, yearForProgress } from './journey.ts'

// 反解：progressForYear 的逆
assert.equal(yearForProgress(0.08, 1994, 2026), 1994)
assert.equal(yearForProgress(0.88, 1994, 2026), 2026)
assert.equal(yearForProgress(0, 1994, 2026), 1994)
assert.equal(yearForProgress(1, 1994, 2026), 2026)

// 停靠点端值精确命中 spec token
assert.deepEqual(skyAt(0), { l: 0.9, c: 0.04, h: 60 })
assert.deepEqual(skyAt(1), { l: 0.26, c: 0.04, h: 265 })
assert.deepEqual(skyAt(0.35), { l: 0.87, c: 0.05, h: 230 })
assert.deepEqual(skyAt(0.7), { l: 0.8, c: 0.09, h: 60 })
assert.deepEqual(meadowAt(0.35), { l: 0.74, c: 0.07, h: 125 })
assert.deepEqual(meadowAt(1), { l: 0.28, c: 0.04, h: 260 })

// 插值在界内且连续
const mid = skyAt(0.5)
assert.ok(mid.l < 0.87 && mid.l > 0.26, `sky mid l out of range: ${mid.l}`)
const nearDay = skyAt(0.351)
assert.ok(Math.abs(nearDay.l - 0.87) < 0.01, 'discontinuity at day stop')

// css 输出
assert.equal(oklchCss({ l: 0.9, c: 0.04, h: 60 }), 'oklch(0.9 0.04 60)')

// 雾色：amount=1 即天空色；amount=0 即原色
assert.equal(hazeMix({ l: 0.5, c: 0.1, h: 100 }, { l: 0.9, c: 0.04, h: 60 }, 1).l, 0.9)
assert.equal(hazeMix({ l: 0.5, c: 0.1, h: 100 }, { l: 0.9, c: 0.04, h: 60 }, 0).l, 0.5)

// 年份映射：出生=0.08，今年=0.88，单调
assert.equal(progressForYear(1994, 1994, 2026), 0.08)
assert.equal(progressForYear(2026, 1994, 2026), 0.88)
assert.ok(progressForYear(2010, 1994, 2026) < progressForYear(2020, 1994, 2026))

// 路段相位
assert.equal(phaseAt(0.1), 'dawn')
assert.equal(phaseAt(0.4), 'day')
assert.equal(phaseAt(0.7), 'dusk')
assert.equal(phaseAt(0.9), 'night')

console.log('journey ok')
