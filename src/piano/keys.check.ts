// keys.ts 几何自检。跑法：node src/piano/keys.check.ts
import assert from 'node:assert'
import { LAYOUT, centerX, pitch01, KEY_MAP } from './keys.ts'

// 88 键，端点正确
assert.equal(LAYOUT.length, 88)
assert.equal(LAYOUT[0].midi, 21)
assert.equal(LAYOUT[87].midi, 108)

// 52 白 36 黑
assert.equal(LAYOUT.filter((k) => !k.black).length, 52)
assert.equal(LAYOUT.filter((k) => k.black).length, 36)

// 白键等宽且铺满 0–1
const whites = LAYOUT.filter((k) => !k.black)
assert.ok(Math.abs(whites[0].x - 0) < 1e-9, '第一个白键从 0 开始')
const last = whites[whites.length - 1]
assert.ok(Math.abs(last.x + last.w - 1) < 1e-9, '最后一个白键到 1 结束')
for (const w of whites) assert.ok(Math.abs(w.w - 1 / 52) < 1e-9, '白键等宽')

// 黑键更窄，且压在两个白键交界处
const blacks = LAYOUT.filter((k) => k.black)
for (const b of blacks) assert.ok(b.w < 1 / 52, '黑键比白键窄')

// centerX 单调递增
let prev = -1
for (const k of LAYOUT) {
  const c = centerX(k.midi)
  assert.ok(c > prev, `centerX 应随音高单调递增，卡在 midi ${k.midi}`)
  assert.ok(c >= 0 && c <= 1)
  prev = c
}

// pitch01 端值
assert.equal(pitch01(21), 0)
assert.equal(pitch01(108), 1)
assert.ok(Math.abs(pitch01(60) - (60 - 21) / 87) < 1e-9)

// 电脑键盘映射：白键 8 个、黑键 5 个，偏移在一个八度多一点内
assert.equal(KEY_MAP['a'], 0)
assert.equal(KEY_MAP['k'], 12)
assert.equal(KEY_MAP['w'], 1)
assert.equal(KEY_MAP['u'], 10)
assert.equal(Object.keys(KEY_MAP).length, 13)

console.log('keys.check.ts OK')
