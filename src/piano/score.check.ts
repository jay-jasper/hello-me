// score.ts 纯函数自检。跑法：node src/piano/score.check.ts
import assert from 'node:assert'
import { noteToMidi, mel, arp, pad, endOf } from './score.ts'

// 音名 → midi
assert.equal(noteToMidi('c4'), 60)
assert.equal(noteToMidi('C4'), 60)
assert.equal(noteToMidi('a0'), 21)
assert.equal(noteToMidi('c8'), 108)
assert.equal(noteToMidi('c#4'), 61)
assert.equal(noteToMidi('db4'), 61)
assert.equal(noteToMidi('b3'), 59)
assert.throws(() => noteToMidi('h4'), /音名/)
assert.throws(() => noteToMidi('c9'), /范围/)

// 旋律：空格分隔，'-' 表示延续上一个音（时值翻倍），'.' 表示休止
const m = mel('c4 e4 - g4 . a4', { start: 0, step: 0.5, v: 0.6 })
assert.equal(m.length, 4, "'-' 与 '.' 不产生新音符")
assert.deepEqual(m[0], { midi: 60, t: 0, d: 0.5, v: 0.6 })
assert.equal(m[1].midi, 64)
assert.equal(m[1].d, 1.0, "'-' 让前一个音时值翻倍")
assert.equal(m[2].t, 1.5, "'.' 仍然推进时间轴")
assert.equal(m[3].t, 2.5)

// 分解和弦：按 times 次循环上行
const a = arp(['c3', 'g3', 'e4'], { start: 0, step: 0.25, times: 2, v: 0.35 })
assert.equal(a.length, 6)
assert.equal(a[0].midi, noteToMidi('c3'))
assert.equal(a[3].t, 0.75, '第二轮从第 4 个 step 开始')
assert.ok(a.every((n) => n.v === 0.35))

// 柱式和弦：同起点同时值
const p = pad(['c3', 'e3', 'g3'], { start: 2, d: 1.5, v: 0.4 })
assert.equal(p.length, 3)
assert.ok(p.every((n) => n.t === 2 && n.d === 1.5))

// endOf 取最晚的结束时刻
assert.equal(endOf([...m, ...p]), 3.5)

console.log('score.check.ts OK')
