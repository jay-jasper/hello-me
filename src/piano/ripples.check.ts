// ripples.ts 自检。跑法：node src/piano/ripples.check.ts
import assert from 'node:assert'
import { createRipples } from './ripples.ts'

// buf 是 Float32Array：0.1/0.2/0.3/0.4 在 float32 里都不是精确值（往返后误差量级 ~1e-8），
// 严格 assert.equal 必然失败，跟实现是否正确无关。这里用 closeTo 代替严格相等。
function closeTo(actual: number, expected: number, msg: string) {
  assert.ok(Math.abs(actual - expected) < 1e-5, `${msg}: got ${actual}, want ${expected}`)
}

const r = createRipples(3)
assert.equal(r.capacity, 3)

const buf = new Float32Array(3 * 4)

// 空状态
assert.equal(r.pack(0, buf), 0)

r.add({ x: 0.1, t0: 0, amp: 1, pitch: 0.2, self: false })
r.add({ x: 0.2, t0: 1, amp: 1, pitch: 0.4, self: true })
assert.equal(r.pack(1, buf), 2)
closeTo(buf[0], 0.1, '第一条的 x')
closeTo(buf[4], 0.2, '第二条的 x')

// 超出容量踢掉最旧的
r.add({ x: 0.3, t0: 2, amp: 1, pitch: 0.6, self: false })
r.add({ x: 0.4, t0: 3, amp: 1, pitch: 0.8, self: false })
const n = r.pack(3, buf)
assert.equal(n, 3)
const xs = [buf[0], buf[4], buf[8]].sort((a, b) => a - b)
xs.forEach((v, i) => closeTo(v, [0.2, 0.3, 0.4][i], '最旧的 0.1 应被踢掉'))

// self 标记编码进第 4 个分量的符号位
r.add({ x: 0.5, t0: 4, amp: 1, pitch: 0.5, self: true })
r.pack(4, buf)
const selfSlot = [0, 1, 2].map((i) => buf.slice(i * 4, i * 4 + 4)).find((s) => s[0] === 0.5)!
assert.ok(selfSlot[3] < 0, 'self 的涟漪 pitch 分量取负')

console.log('ripples.check.ts OK')
