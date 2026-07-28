// ripples.ts 自检。跑法：node src/piano/ripples.check.ts
import assert from 'node:assert'
import { createRipples, lifetimeFor } from './ripples.ts'

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

// self + pitch === 0 的钳制：-0 在 JS 里 < 0 为 false，若不 clamp 到至少 0.001，
// shader 那边用符号位判断 self 就会失效（-0 会被当成非 self）。
{
  const rc = createRipples(2)
  const bufc = new Float32Array(2 * 4)
  rc.add({ x: 0.7, t0: 0, amp: 1, pitch: 0, self: true })
  rc.pack(0, bufc)
  assert.ok(
    Object.is(bufc[3], -0.001) || bufc[3] < 0,
    `self + pitch=0 应钳制成一个可判负的值，实际 ${bufc[3]}`,
  )
  assert.ok(bufc[3] < 0, 'pitch=0 的 self 涟漪，符号位必须仍然可读出 self（不能塌成 -0）')
  closeTo(bufc[3], -0.001, 'pitch=0 的 self 涟漪应钳制到 -0.001')
}

// 年龄截断：截断时长按各自音高的衰减率反解，而不是写死一个常量——
// 低音（pitch=0，衰减最慢）应该比旧的 6 秒硬截断活得更久；截断点两侧都要各验证一次。
{
  const lifetimeLow = lifetimeFor(0) // 最低音，最长存活时间（≈10.2s）
  const lifetimeHigh = lifetimeFor(1) // 最高音，最短存活时间（≈2.7s）
  assert.ok(
    lifetimeLow > 6,
    `低音存活时长应超过旧的 6 秒硬截断（实际 ${lifetimeLow.toFixed(2)}s），否则低音余韵被砍断`,
  )
  assert.ok(lifetimeHigh < lifetimeLow, '高音应比低音更早被踢出缓冲')

  const rcLow = createRipples(1)
  const bufLow = new Float32Array(1 * 4)
  rcLow.add({ x: 0.1, t0: 0, amp: 1, pitch: 0, self: false })
  assert.equal(
    rcLow.pack(lifetimeLow - 0.1, bufLow),
    1,
    '低音在自己的存活时长截止前应仍被打包（旧的 6 秒常量会在这里就已经把它踢掉）',
  )
  assert.equal(
    rcLow.pack(lifetimeLow + 0.1, bufLow),
    0,
    '低音超过自己的存活时长后应被踢出',
  )

  const rcHigh = createRipples(1)
  const bufHigh = new Float32Array(1 * 4)
  rcHigh.add({ x: 0.9, t0: 0, amp: 1, pitch: 1, self: false })
  assert.equal(
    rcHigh.pack(lifetimeHigh - 0.1, bufHigh),
    1,
    '高音在自己的存活时长截止前应仍被打包',
  )
  assert.equal(
    rcHigh.pack(lifetimeHigh + 0.1, bufHigh),
    0,
    '高音超过自己的存活时长后应被踢出',
  )
}

console.log('ripples.check.ts OK')
