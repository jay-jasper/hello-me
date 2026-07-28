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

import { PIECES, pieceForYear } from './pieces.ts'
import { memories } from '../content/memories.ts'
import { site } from '../config.ts'

// 三首曲子
assert.equal(PIECES.length, 3)
assert.deepEqual(
  PIECES.map((p) => p.id),
  ['morning-window', 'rainfall', 'distant-hills'],
)

const ids = new Set(memories.map((m) => m.id).filter(Boolean))

for (const p of PIECES) {
  assert.ok(p.notes.length > 0, `${p.id} 没有音符`)
  // 注：8 条示例记忆按 birthYear=1994 分段只得 3/3/2，故最少锚点数放宽到 2
  assert.ok(p.anchors.length >= 2, `${p.id} 至少要 2 个锚点`)
  assert.ok(p.duration > 60, `${p.id} 太短`)

  // 音高在钢琴范围内、时值非负、力度合法
  for (const n of p.notes) {
    assert.ok(n.midi >= 21 && n.midi <= 108, `${p.id} 音高越界：${n.midi}`)
    assert.ok(n.d > 0, `${p.id} 时值非正`)
    assert.ok(n.v > 0 && n.v <= 1, `${p.id} 力度越界：${n.v}`)
    assert.ok(n.t + n.d <= p.duration + 0.01, `${p.id} 有音符超出曲长`)
  }

  // duration 与末音符一致
  assert.ok(
    Math.abs(endOf(p.notes) - p.duration) < 0.01,
    `${p.id} 的 duration 与末音符结束时刻不一致`,
  )

  // 锚点：落在曲长内、引用存在、归属正确
  for (const a of p.anchors) {
    assert.ok(a.t >= 0 && a.t < p.duration, `${p.id} 锚点 ${a.t}s 超出曲长`)
    assert.ok(ids.has(a.memory), `${p.id} 引用了不存在的记忆 id：${a.memory}`)
    const mem = memories.find((m) => m.id === a.memory)!
    assert.equal(
      pieceForYear(mem.year, site.birthYear),
      p.id,
      `${a.memory}（${mem.year} 年）不该归到 ${p.id}`,
    )
  }

  // 同一记忆不重复出现
  const seen = new Set(p.anchors.map((a) => a.memory))
  assert.equal(seen.size, p.anchors.length, `${p.id} 有重复锚点`)
}

// 每条有 id 的记忆必须被恰好一个锚点引用（不漏、不重）
for (const m of memories) {
  if (!m.id) continue
  const refs = PIECES.flatMap((p) => p.anchors.filter((a) => a.memory === m.id))
  assert.equal(refs.length, 1, `记忆 ${m.id}（${m.year} 年）被引用了 ${refs.length} 次，应该恰好 1 次`)
}

// 年份分段规则
assert.equal(pieceForYear(2000, 1994), 'morning-window')
assert.equal(pieceForYear(2012, 1994), 'morning-window') // 1994+18 = 2012，含边界
assert.equal(pieceForYear(2013, 1994), 'rainfall')
assert.equal(pieceForYear(2022, 1994), 'rainfall') // 1994+28 = 2022，含边界
assert.equal(pieceForYear(2023, 1994), 'distant-hills')

console.log('score.check.ts OK')
