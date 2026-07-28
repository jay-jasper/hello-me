# 「琴」Piano 主题实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做一台可弹奏的 88 键钢琴主题页，随机连播三首原创日系抒情小品，每个音符在水面激起涟漪，乐句锚点处浮出对应人生时期的记忆。

**Architecture:** 七个单一职责模块 + 一个装配层。`score.ts` 是零依赖纯数据与纯函数；`instrument.ts` 包住 Tone.Sampler；`player.ts` 用 Tone.Transport 调度并吐事件；`keyboard.ts` 管 88 键几何与输入；`water.ts` 只认识 `splash(x01, vel, pitch01)`；`reveal.ts` 管浮字；`main.ts` 是唯一把它们接起来的地方。边界铁律：water 不知道音乐，player 不知道画面，instrument 不知道曲子。

**Tech Stack:** Vite 6 多入口 · TypeScript 严格模式 · Tone.js 15 · WebGL2 单 shader（降级 Canvas 2D） · 无测试框架，沿用 `src/journey/acts.check.ts` 的 `node:assert` + `node xxx.check.ts` 直跑模式

规格：`docs/superpowers/specs/2026-07-28-piano-theme-design.md`

## Global Constraints

- 入口文件 `piano.html`，代码目录 `src/piano/`，`vite.config.ts` 加第四个 rollup input `piano`
- 采样音源为 Salamander Grand Piano，**必须在页面底部署名「Salamander Grand Piano · Alexander Holm · CC-BY 3.0」**
- 采样合计 ≤ 2 MB，且只在开场手势之后才下载；首屏 JS ≤ 60 KB gz
- 涟漪同时上限：桌面 48，移动端 24
- 正文对比度 ≥ 4.5:1；浮字在场时水面整体亮度降 35%
- 浮字必须是真实 DOM 文本 + `aria-live="polite"`，不得画进 canvas
- 琴键 Tab 可达、方向键移动、Enter 发声、焦点有可见光环，每键 `aria-label`（如 `C4`）
- `prefers-reduced-motion` 下：涟漪不扩散、琴键只变色不位移、浮字直接淡入
- 音符视觉回调比发声提前 80 ms，用 `Tone.Draw.schedule(fn, time - 0.08)`
- 所有 `*.check.ts` 都要加进 `tsconfig.json` 的 `exclude`
- 提交信息用英文，正文中文内容保持中文

---

### Task 1: 采样资产管线与音源模块

**Files:**
- Create: `scripts/fetch-salamander.sh`
- Create: `src/piano/instrument.ts`
- Create: `src/piano/instrument.check.ts`
- Modify: `tsconfig.json`（`exclude` 追加 `src/piano/instrument.check.ts`）
- Modify: `.gitignore`（不忽略采样，此处只确认无需改动；若已有 `.wav` 规则不影响 mp3）

**Interfaces:**
- Consumes: 无
- Produces:
  - `SAMPLE_NOTES: readonly string[]` —— 27 个 Salamander 采样音名，顺序由低到高
  - `sampleMap(): Record<string, string>` —— `{ "A0": "A0.mp3", … }`，供 Tone.Sampler 的 `urls`
  - `createInstrument(baseUrl: string): Instrument`
  - `type Instrument = { ready: Promise<void>; attack(midi: number, vel: number, when?: number): void; release(midi: number, when?: number): void; strike(midi: number, vel: number, dur: number, when?: number): void; setVolume(db: number): void; dispose(): void }`

- [ ] **Step 1: 写下载脚本**

创建 `scripts/fetch-salamander.sh`：

```bash
#!/bin/bash
# 拉取 Salamander Grand Piano 采样（CC-BY 3.0, Alexander Holm）。
# 上游按小三度网格提供 C / D#(Ds) / F#(Fs) / A 四音一组，A0–C8 共 27 个。
set -euo pipefail

DEST="$(dirname "$0")/../src/piano/assets/salamander"
BASE="https://tonejs.github.io/audio/salamander"
NOTES="A0 C1 Ds1 Fs1 A1 C2 Ds2 Fs2 A2 C3 Ds3 Fs3 A3 C4 Ds4 Fs4 A4 C5 Ds5 Fs5 A5 C6 Ds6 A6 C7 A7 C8"

mkdir -p "$DEST"
for n in $NOTES; do
  if [ -f "$DEST/$n.mp3" ]; then
    echo "skip $n"
    continue
  fi
  echo "fetch $n"
  curl -sSf --max-time 30 "$BASE/$n.mp3" -o "$DEST/$n.mp3"
done

echo "--- total ---"
du -sh "$DEST"
ls "$DEST" | wc -l
```

- [ ] **Step 2: 跑脚本，确认拿到 27 个文件、总量 ≈ 1.9 MB**

Run:
```bash
chmod +x scripts/fetch-salamander.sh && ./scripts/fetch-salamander.sh
```
Expected: 末尾打印约 `1.9M` 与 `27`

- [ ] **Step 3: 写失败的测试**

创建 `src/piano/instrument.check.ts`：

```ts
// instrument.ts 的纯逻辑自检。跑法：node src/piano/instrument.check.ts
import assert from 'node:assert'
import { readdirSync } from 'node:fs'
import { SAMPLE_NOTES, sampleMap } from './instrument.ts'

// 27 个采样，低到高
assert.equal(SAMPLE_NOTES.length, 27, '采样数应为 27')
assert.equal(SAMPLE_NOTES[0], 'A0')
assert.equal(SAMPLE_NOTES[SAMPLE_NOTES.length - 1], 'C8')

// 音名只允许 C / Ds / Fs / A 四种字母部分
for (const n of SAMPLE_NOTES) {
  const letter = n.replace(/\d+$/, '')
  assert.ok(['C', 'Ds', 'Fs', 'A'].includes(letter), `非法采样音名 ${n}`)
}

// sampleMap 与文件系统一致
const map = sampleMap()
assert.equal(Object.keys(map).length, 27)
assert.equal(map['C4'], 'C4.mp3')

const onDisk = readdirSync(new URL('./assets/salamander/', import.meta.url)).filter((f) =>
  f.endsWith('.mp3'),
)
assert.equal(onDisk.length, 27, '磁盘上的采样文件数与 SAMPLE_NOTES 不一致')
for (const n of SAMPLE_NOTES) {
  assert.ok(onDisk.includes(`${n}.mp3`), `缺少采样文件 ${n}.mp3`)
}

console.log('instrument.check.ts OK')
```

- [ ] **Step 4: 跑测试确认失败**

Run: `node src/piano/instrument.check.ts`
Expected: FAIL —— `Cannot find module './instrument.ts'` 或 `SAMPLE_NOTES is not exported`

- [ ] **Step 5: 写最小实现**

创建 `src/piano/instrument.ts`：

```ts
// 音源：把 Tone.Sampler 包起来，对外只暴露 midi 号与力度。
// 换掉 Tone 只需要保持下面这个 Instrument 接口不变。
import * as Tone from 'tone'

/** Salamander 上游的小三度采样网格，A0–C8 共 27 个 */
export const SAMPLE_NOTES = [
  'A0', 'C1', 'Ds1', 'Fs1', 'A1',
  'C2', 'Ds2', 'Fs2', 'A2',
  'C3', 'Ds3', 'Fs3', 'A3',
  'C4', 'Ds4', 'Fs4', 'A4',
  'C5', 'Ds5', 'Fs5', 'A5',
  'C6', 'Ds6', 'A6',
  'C7', 'A7', 'C8',
] as const

export function sampleMap(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const n of SAMPLE_NOTES) out[n] = `${n}.mp3`
  return out
}

export type Instrument = {
  ready: Promise<void>
  attack(midi: number, vel: number, when?: number): void
  release(midi: number, when?: number): void
  strike(midi: number, vel: number, dur: number, when?: number): void
  setVolume(db: number): void
  dispose(): void
}

const noteOf = (midi: number) => Tone.Frequency(midi, 'midi').toNote()

export function createInstrument(baseUrl: string): Instrument {
  let resolveReady!: () => void
  const ready = new Promise<void>((r) => (resolveReady = r))

  const sampler = new Tone.Sampler({
    urls: sampleMap(),
    baseUrl,
    release: 1.2,
    onload: () => resolveReady(),
  }).toDestination()

  return {
    ready,
    attack: (midi, vel, when) => sampler.triggerAttack(noteOf(midi), when, vel),
    release: (midi, when) => sampler.triggerRelease(noteOf(midi), when),
    strike: (midi, vel, dur, when) =>
      sampler.triggerAttackRelease(noteOf(midi), dur, when, vel),
    setVolume: (db) => {
      sampler.volume.value = db
    },
    dispose: () => sampler.dispose(),
  }
}
```

- [ ] **Step 6: 跑测试确认通过**

Run: `node src/piano/instrument.check.ts`
Expected: `instrument.check.ts OK`

注意：`instrument.check.ts` 会 import `instrument.ts`，后者 import `tone`。若 node 直跑时因 Tone 的浏览器 API 报错，把 `SAMPLE_NOTES` 与 `sampleMap` 拆到 `src/piano/sample-map.ts`（零依赖），`instrument.ts` 从那里 re-export，check 脚本改为 import `./sample-map.ts`。先跑一次，报错了再拆。

- [ ] **Step 7: tsconfig 排除 check 脚本**

修改 `tsconfig.json` 的 `exclude`：

```json
"exclude": ["src/journey/acts.check.ts", "src/piano/instrument.check.ts"]
```

- [ ] **Step 8: 提交**

```bash
git add scripts/fetch-salamander.sh src/piano/instrument.ts src/piano/instrument.check.ts src/piano/assets tsconfig.json
git commit -m "feat(piano): Salamander sample pipeline and Tone.Sampler wrapper"
```

---

### Task 2: score.ts 的乐理纯函数

**Files:**
- Create: `src/piano/score.ts`
- Create: `src/piano/score.check.ts`
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: 无
- Produces:
  - `type Note = { midi: number; t: number; d: number; v: number }`
  - `type Anchor = { t: number; memory: string }`
  - `type Piece = { id: string; title: string; latin: string; mood: string; duration: number; notes: Note[]; anchors: Anchor[] }`
  - `noteToMidi(name: string): number` —— `'c4' → 60`，支持 `#`/`b`
  - `mel(names: string, opts: { start: number; step: number; dur?: number; v?: number }): Note[]`
  - `arp(chord: string[], opts: { start: number; step: number; dur?: number; v?: number; times?: number }): Note[]`
  - `pad(chord: string[], opts: { start: number; d: number; v?: number }): Note[]`
  - `endOf(notes: Note[]): number`

- [ ] **Step 1: 写失败的测试**

创建 `src/piano/score.check.ts`：

```ts
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node src/piano/score.check.ts`
Expected: FAIL —— `Cannot find module './score.ts'`

- [ ] **Step 3: 写最小实现**

创建 `src/piano/score.ts`：

```ts
// 曲谱数据与乐理纯函数。零依赖，可被 node 直接跑。

export type Note = {
  midi: number // 21–108
  t: number // 起始秒
  d: number // 持续秒
  v: number // 力度 0–1
}
export type Anchor = { t: number; memory: string }
export type Piece = {
  id: string
  title: string
  latin: string
  mood: string
  duration: number
  notes: Note[]
  anchors: Anchor[]
}

const PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }

/** 'c4' → 60，'db4' → 61。超出 21–108 抛错。 */
export function noteToMidi(name: string): number {
  const m = /^([a-gA-G])([#b]?)(-?\d)$/.exec(name.trim())
  if (!m) throw new Error(`非法音名：${name}`)
  const [, letter, accidental, octave] = m
  const base = PC[letter.toLowerCase()]
  const acc = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0
  const midi = (Number(octave) + 1) * 12 + base + acc
  if (midi < 21 || midi > 108) throw new Error(`音高超出钢琴范围：${name}`)
  return midi
}

type MelOpts = { start: number; step: number; dur?: number; v?: number }

/**
 * 'c4 e4 - g4 . a4' →
 *   音名产生音符；'-' 把上一个音的时值延长一个 step；'.' 是休止，只推进时间。
 */
export function mel(names: string, opts: MelOpts): Note[] {
  const { start, step, dur = step, v = 0.6 } = opts
  const out: Note[] = []
  let t = start
  for (const tok of names.trim().split(/\s+/)) {
    if (tok === '-') {
      if (out.length) out[out.length - 1].d += step
      t += step
      continue
    }
    if (tok === '.') {
      t += step
      continue
    }
    out.push({ midi: noteToMidi(tok), t, d: dur, v })
    t += step
  }
  return out
}

type ArpOpts = { start: number; step: number; dur?: number; v?: number; times?: number }

/** 分解和弦：把 chord 依次弹出，重复 times 轮。 */
export function arp(chord: string[], opts: ArpOpts): Note[] {
  const { start, step, dur = step * 2, v = 0.35, times = 1 } = opts
  const out: Note[] = []
  let i = 0
  for (let round = 0; round < times; round++) {
    for (const name of chord) {
      out.push({ midi: noteToMidi(name), t: start + i * step, d: dur, v })
      i++
    }
  }
  return out
}

/** 柱式和弦：同起点、同时值。 */
export function pad(chord: string[], opts: { start: number; d: number; v?: number }): Note[] {
  const { start, d, v = 0.4 } = opts
  return chord.map((name) => ({ midi: noteToMidi(name), t: start, d, v }))
}

/** 最晚的结束时刻。 */
export function endOf(notes: Note[]): number {
  return notes.reduce((max, n) => Math.max(max, n.t + n.d), 0)
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node src/piano/score.check.ts`
Expected: `score.check.ts OK`

- [ ] **Step 5: tsconfig 排除并提交**

`tsconfig.json` 的 `exclude` 追加 `src/piano/score.check.ts`，然后：

```bash
git add src/piano/score.ts src/piano/score.check.ts tsconfig.json
git commit -m "feat(piano): music theory helpers for score authoring"
```

---

### Task 3: 三首曲子与记忆锚点

**Files:**
- Modify: `src/content/memories.ts`（`Memory` 加可选 `id`，给现有示例记忆补 id）
- Create: `src/piano/pieces.ts`
- Modify: `src/piano/score.check.ts`（追加曲子与锚点校验）
- Modify: `package.json`（`build` 前置 check）

**Interfaces:**
- Consumes: Task 2 的 `mel` / `arp` / `pad` / `endOf` / `Piece`
- Produces:
  - `PIECES: Piece[]` —— 长度 3，顺序为 晨窗 / 雨落 / 远山
  - `pieceForYear(year: number, birthYear: number): string` —— 返回曲子 id，用于校验锚点归属

- [ ] **Step 1: 给 Memory 加 id**

修改 `src/content/memories.ts` 的类型与每条示例数据：

```ts
export type Memory = {
  /** 全站唯一，格式 <年份>-<短名>，如 2006-first-pc。钢琴主题的锚点靠它引用。 */
  id?: string
  year: number
  kind: 'milestone' | 'moment'
  title: string
  story: string[]
}
```

给现有每一条记忆补上 `id`，命名遵循 `<年份>-<两三个词的英文短名>`，全小写连字符。例如 2026 年那条写 `id: '2026-abyss-built'`。

- [ ] **Step 2: 写失败的测试**

在 `src/piano/score.check.ts` 末尾（`console.log` 之前）追加：

```ts
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
  assert.ok(p.anchors.length >= 3, `${p.id} 至少要 3 个锚点`)
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

// 年份分段规则
assert.equal(pieceForYear(2000, 1994), 'morning-window')
assert.equal(pieceForYear(2012, 1994), 'morning-window') // 1994+18 = 2012，含边界
assert.equal(pieceForYear(2013, 1994), 'rainfall')
assert.equal(pieceForYear(2022, 1994), 'rainfall') // 1994+28 = 2022，含边界
assert.equal(pieceForYear(2023, 1994), 'distant-hills')
```

- [ ] **Step 3: 跑测试确认失败**

Run: `node src/piano/score.check.ts`
Expected: FAIL —— `Cannot find module './pieces.ts'`

- [ ] **Step 4: 写三首曲子**

创建 `src/piano/pieces.ts`。下面给出**晨窗**的完整写法作为范式，另外两首照此结构写；每首都靠 `mel` / `arp` / `pad` 拼出来，不手敲音符对象。

```ts
// 三首原创日系抒情小品。每首绑一个人生时期。
// 改曲子只动这个文件；改完跑 node src/piano/score.check.ts 校验。
import { arp, endOf, mel, pad, type Note, type Piece } from './score.ts'

/** 记忆年份 → 该归哪首曲子。锚点仍需显式写，此函数只负责校验归属。 */
export function pieceForYear(year: number, birthYear: number): string {
  if (year <= birthYear + 18) return 'morning-window'
  if (year <= birthYear + 28) return 'rainfall'
  return 'distant-hills'
}

const sort = (ns: Note[]) => ns.sort((a, b) => a.t - b.t)

/* ---------- 1 · 晨窗 Morning Window ----------
   C 大调，王道进行 Ⅳ–Ⅴ–iii–vi（F–G–Em–Am）。
   左手分解九和弦铺底，右手单音动机，每 8 拍一个乐句。          */

const MW_BAR = 3.2 // 每小节秒数
const MW_PROG: string[][] = [
  ['f2', 'c3', 'a3', 'e4'], // F(add9)
  ['g2', 'd3', 'b3', 'f4'], // G
  ['e2', 'b2', 'g3', 'd4'], // Em7
  ['a2', 'e3', 'c4', 'g4'], // Am7
]

function morningWindow(): Piece {
  const notes: Note[] = []
  const bars = 28

  // 左手：整曲循环分解和弦
  for (let bar = 0; bar < bars; bar++) {
    notes.push(
      ...arp(MW_PROG[bar % 4], {
        start: bar * MW_BAR,
        step: MW_BAR / 8,
        dur: MW_BAR / 3,
        v: 0.3,
        times: 2,
      }),
    )
  }

  // 右手：第 4 小节进入，两个乐句交替
  const phraseA = 'e5 g5 - a5 . g5 e5 -'
  const phraseB = 'd5 e5 - g5 . e5 c5 -'
  for (let bar = 4; bar < bars - 2; bar++) {
    const phrase = bar % 4 < 2 ? phraseA : phraseB
    notes.push(...mel(phrase, { start: bar * MW_BAR, step: MW_BAR / 8, dur: MW_BAR / 4, v: 0.62 }))
  }

  // 尾句：最后两小节柱式和弦收束
  notes.push(...pad(['f2', 'c3', 'a3'], { start: (bars - 2) * MW_BAR, d: MW_BAR, v: 0.34 }))
  notes.push(...pad(['c2', 'g2', 'e3', 'c4'], { start: (bars - 1) * MW_BAR, d: MW_BAR * 1.4, v: 0.4 }))

  sort(notes)
  return {
    id: 'morning-window',
    title: '晨窗',
    latin: 'MORNING WINDOW',
    mood: '童年 · 明亮，但已经带着回望',
    duration: endOf(notes),
    notes,
    // 锚点落在乐句交界（每 4 小节），引用最早时期的记忆
    anchors: [
      { t: MW_BAR * 8, memory: '2000-earliest' },
      { t: MW_BAR * 14, memory: '2006-first-pc' },
      { t: MW_BAR * 20, memory: '2012-basketball' },
    ],
  }
}

export const PIECES: Piece[] = [morningWindow() /* , rainfall(), distantHills() */]
```

**另外两首按同样结构写：**

- **雨落 Rainfall** —— `id: 'rainfall'`，A 小调，`RF_PROG = [['a2','e3','c4','g4'], ['f2','c3','a3','e4'], ['d2','a2','f3','c4'], ['e2','b2','g3','d4']]`（Am7–Fmaj7–Dm7–Em7）。左手用 `arp(..., { step: BAR/8, times: 2, v: 0.26 })` 做绵密八分音型；右手旋律用 `mel('a4 c5 - b4 . a4 g4 -', …)` 与其小三度变奏交替；第 16–20 小节转平行大调（进行换成 `['c3','g3','e4','b4']` 起头）再落回。`duration` 目标 ~100 s，锚点 4 个，引用 `pieceForYear` 判为 `rainfall` 的记忆。
- **远山 Distant Hills** —— `id: 'distant-hills'`，D 大调，左手空五度 `pad(['d2','a2'], { start: bar*BAR, d: BAR, v: 0.3 })` 长音铺底，右手长音旋律 `mel('fs4 - - a4 - b4 - -', { step: BAR/4 })`，织体最疏。`duration` 目标 ~110 s，锚点 3 个，引用近年记忆。

写完后把三个函数都放进 `PIECES` 数组。

- [ ] **Step 5: 跑测试，按报错修锚点 id**

Run: `node src/piano/score.check.ts`
Expected: 首次很可能因 `引用了不存在的记忆 id` 失败 —— 按报错把 `pieces.ts` 里的锚点 id 改成 `memories.ts` 里真实存在、且年份落在该曲区间的记忆 id。反复跑到输出 `score.check.ts OK`。

- [ ] **Step 6: 把 check 挂进构建**

修改 `package.json`：

```json
"scripts": {
  "dev": "vite",
  "build": "node src/piano/score.check.ts && node src/piano/instrument.check.ts && tsc --noEmit && vite build",
  "preview": "vite preview"
}
```

Run: `npm run build`
Expected: 两个 check 都打印 OK，然后构建成功

- [ ] **Step 7: 提交**

```bash
git add src/content/memories.ts src/piano/pieces.ts src/piano/score.check.ts package.json
git commit -m "feat(piano): three original pieces bound to life periods"
```

---

### Task 4: 88 键几何与输入

**Files:**
- Create: `src/piano/keys.ts`（纯几何，零依赖）
- Create: `src/piano/keys.check.ts`
- Create: `src/piano/keyboard.ts`（DOM 与输入）
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: 无
- Produces:
  - `type KeyGeom = { midi: number; black: boolean; x: number; w: number }` —— `x`/`w` 均为 0–1 归一化
  - `LAYOUT: KeyGeom[]` —— 88 项，midi 21→108
  - `centerX(midi: number): number` —— 0–1，水面涟漪的横向位置
  - `pitch01(midi: number): number` —— 21→0，108→1
  - `KEY_MAP: Record<string, number>` —— 电脑键盘字母 → 相对基准八度的半音偏移
  - `createKeyboard(root: HTMLElement, opts: { onNote(midi: number, vel: number): void; onKeyUp?(midi: number): void }): Keyboard`
  - `type Keyboard = { flash(midi: number, self: boolean): void; setOctave(delta: number): void; destroy(): void }`

- [ ] **Step 1: 写失败的测试**

创建 `src/piano/keys.check.ts`：

```ts
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node src/piano/keys.check.ts`
Expected: FAIL —— `Cannot find module './keys.ts'`

- [ ] **Step 3: 写最小实现**

创建 `src/piano/keys.ts`：

```ts
// 88 键的纯几何。x / w 都是 0–1 归一化，渲染与水面都用这套坐标。

export type KeyGeom = { midi: number; black: boolean; x: number; w: number }

const LOW = 21 // A0
const HIGH = 108 // C8
const BLACK_PC = new Set([1, 3, 6, 8, 10])
const WHITE_COUNT = 52
const WHITE_W = 1 / WHITE_COUNT
const BLACK_W = WHITE_W * 0.62

function build(): KeyGeom[] {
  const out: KeyGeom[] = []
  let whiteIndex = 0
  for (let midi = LOW; midi <= HIGH; midi++) {
    const black = BLACK_PC.has(midi % 12)
    if (black) {
      // 黑键压在刚放下的那个白键的右边界上
      out.push({ midi, black, x: whiteIndex * WHITE_W - BLACK_W / 2, w: BLACK_W })
    } else {
      out.push({ midi, black, x: whiteIndex * WHITE_W, w: WHITE_W })
      whiteIndex++
    }
  }
  return out
}

export const LAYOUT: KeyGeom[] = build()

const BY_MIDI = new Map(LAYOUT.map((k) => [k.midi, k]))

/** 键的水平中心，0–1。水面涟漪的发源点。 */
export function centerX(midi: number): number {
  const k = BY_MIDI.get(midi)
  if (!k) throw new Error(`midi ${midi} 不在 88 键内`)
  return k.x + k.w / 2
}

/** 音高归一化：A0 = 0，C8 = 1。决定涟漪的波长与颜色。 */
export function pitch01(midi: number): number {
  return (Math.min(HIGH, Math.max(LOW, midi)) - LOW) / (HIGH - LOW)
}

/** 电脑键盘 → 相对基准八度根音的半音偏移 */
export const KEY_MAP: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6,
  g: 7, y: 8, h: 9, u: 10, j: 11, k: 12,
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node src/piano/keys.check.ts`
Expected: `keys.check.ts OK`

注意：黑键靠左边界那一枚（midi 22，A#0）的 `x` 会是负的一点点。这是刻意的——渲染时用 `overflow: hidden` 裁掉即可，几何保持规整。测试里只断言黑键更窄，不断言 x ≥ 0。

- [ ] **Step 5: 写 keyboard.ts（DOM 与输入）**

创建 `src/piano/keyboard.ts`：

```ts
// 88 键的 DOM 与输入。只吐 onNote，不发声、不画水。
import { KEY_MAP, LAYOUT, type KeyGeom } from './keys.ts'

export type Keyboard = {
  flash(midi: number, self: boolean): void
  setOctave(delta: number): void
  destroy(): void
}

type Opts = {
  onNote(midi: number, vel: number): void
  onKeyUp?(midi: number): void
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const labelOf = (midi: number) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`

export function createKeyboard(root: HTMLElement, opts: Opts): Keyboard {
  const els = new Map<number, HTMLButtonElement>()
  let baseOctave = 4 // 电脑键盘 'a' 对应 C4
  const held = new Set<string>()

  root.innerHTML = ''
  root.setAttribute('role', 'group')
  root.setAttribute('aria-label', '钢琴键盘，88 键')

  const make = (k: KeyGeom) => {
    const el = document.createElement('button')
    el.className = `key ${k.black ? 'black' : 'white'}`
    el.style.left = `${k.x * 100}%`
    el.style.width = `${k.w * 100}%`
    el.dataset.midi = String(k.midi)
    el.type = 'button'
    el.setAttribute('aria-label', labelOf(k.midi))
    els.set(k.midi, el)
    root.appendChild(el)
  }
  // 先铺白键再铺黑键，保证黑键在上层
  LAYOUT.filter((k) => !k.black).forEach(make)
  LAYOUT.filter((k) => k.black).forEach(make)

  const press = (midi: number, vel: number) => opts.onNote(midi, vel)

  const onPointerDown = (e: PointerEvent) => {
    const el = (e.target as HTMLElement).closest('.key') as HTMLButtonElement | null
    if (!el) return
    e.preventDefault()
    const rect = el.getBoundingClientRect()
    // 越靠键的下沿力度越大，模拟按得深
    const vel = 0.45 + 0.45 * Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    press(Number(el.dataset.midi), vel)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const el = document.activeElement as HTMLElement | null
    if (el?.classList.contains('key') && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      press(Number(el.dataset.midi), 0.7)
      return
    }
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
    const off = KEY_MAP[e.key.toLowerCase()]
    if (off === undefined) return
    if (held.has(e.key.toLowerCase())) return
    held.add(e.key.toLowerCase())
    press((baseOctave + 1) * 12 + off, 0.72)
  }
  const onKeyUpEvt = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase()
    if (!held.delete(key)) return
    const off = KEY_MAP[key]
    if (off !== undefined) opts.onKeyUp?.((baseOctave + 1) * 12 + off)
  }

  root.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUpEvt)

  return {
    flash(midi, self) {
      const el = els.get(midi)
      if (!el) return
      el.classList.remove('lit', 'lit-self')
      void el.offsetWidth // 强制回流，让同一个键连续两次也能重放动画
      el.classList.add(self ? 'lit-self' : 'lit')
      window.setTimeout(() => el.classList.remove('lit', 'lit-self'), 320)
    },
    setOctave(delta) {
      baseOctave = Math.min(6, Math.max(1, baseOctave + delta))
    },
    destroy() {
      root.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUpEvt)
      root.innerHTML = ''
    },
  }
}
```

- [ ] **Step 6: tsconfig 排除、类型检查、提交**

`tsconfig.json` 的 `exclude` 追加 `src/piano/keys.check.ts`。

Run: `npx tsc --noEmit`
Expected: `No errors found`

```bash
git add src/piano/keys.ts src/piano/keys.check.ts src/piano/keyboard.ts tsconfig.json
git commit -m "feat(piano): 88-key geometry, DOM keyboard and input mapping"
```

---

### Task 5: 水面

**Files:**
- Create: `src/piano/ripples.ts`（纯环形缓冲，零依赖）
- Create: `src/piano/ripples.check.ts`
- Create: `src/piano/water.ts`（WebGL2 + Canvas 2D 降级）
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: 无
- Produces:
  - `type Ripple = { x: number; t0: number; amp: number; pitch: number; self: boolean }`
  - `createRipples(cap: number)` → `{ add(r: Ripple): void; pack(now: number, out: Float32Array): number; readonly capacity: number }`
  - `createWater(canvas: HTMLCanvasElement, opts: { cap: number; reduced: boolean })` → `type Water = { splash(x01: number, vel: number, pitch01: number, self: boolean): void; setDim(dim: number): void; resize(): void; start(): void; stop(): void }`

- [ ] **Step 1: 写失败的测试**

创建 `src/piano/ripples.check.ts`：

```ts
// ripples.ts 自检。跑法：node src/piano/ripples.check.ts
import assert from 'node:assert'
import { createRipples } from './ripples.ts'

const r = createRipples(3)
assert.equal(r.capacity, 3)

const buf = new Float32Array(3 * 4)

// 空状态
assert.equal(r.pack(0, buf), 0)

r.add({ x: 0.1, t0: 0, amp: 1, pitch: 0.2, self: false })
r.add({ x: 0.2, t0: 1, amp: 1, pitch: 0.4, self: true })
assert.equal(r.pack(1, buf), 2)
assert.equal(buf[0], 0.1, '第一条的 x')
assert.equal(buf[4], 0.2, '第二条的 x')

// 超出容量踢掉最旧的
r.add({ x: 0.3, t0: 2, amp: 1, pitch: 0.6, self: false })
r.add({ x: 0.4, t0: 3, amp: 1, pitch: 0.8, self: false })
const n = r.pack(3, buf)
assert.equal(n, 3)
const xs = [buf[0], buf[4], buf[8]].sort()
assert.deepEqual(xs, [0.2, 0.3, 0.4], '最旧的 0.1 应被踢掉')

// self 标记编码进第 4 个分量的符号位
r.add({ x: 0.5, t0: 4, amp: 1, pitch: 0.5, self: true })
r.pack(4, buf)
const selfSlot = [0, 1, 2].map((i) => buf.slice(i * 4, i * 4 + 4)).find((s) => s[0] === 0.5)!
assert.ok(selfSlot[3] < 0, 'self 的涟漪 pitch 分量取负')

console.log('ripples.check.ts OK')
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node src/piano/ripples.check.ts`
Expected: FAIL —— `Cannot find module './ripples.ts'`

- [ ] **Step 3: 写最小实现**

创建 `src/piano/ripples.ts`：

```ts
// 活跃涟漪的环形缓冲。满了踢最旧的。pack 出的 Float32Array 直接喂 shader uniform。
export type Ripple = { x: number; t0: number; amp: number; pitch: number; self: boolean }

export function createRipples(cap: number) {
  const items: Ripple[] = []

  return {
    get capacity() {
      return cap
    },
    add(r: Ripple) {
      if (items.length >= cap) items.shift()
      items.push(r)
    },
    /** 打包成 vec4(x, t0, amp, ±pitch)，返回条数。self 用 pitch 的符号位表示。 */
    pack(now: number, out: Float32Array): number {
      let n = 0
      for (const r of items) {
        if (n >= cap) break
        const age = now - r.t0
        if (age < 0 || age > 6) continue // 6 秒后必然衰减殆尽
        out[n * 4 + 0] = r.x
        out[n * 4 + 1] = r.t0
        out[n * 4 + 2] = r.amp
        out[n * 4 + 3] = r.self ? -Math.max(0.001, r.pitch) : r.pitch
        n++
      }
      return n
    },
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node src/piano/ripples.check.ts`
Expected: `ripples.check.ts OK`

- [ ] **Step 5: 写 water.ts**

创建 `src/piano/water.ts`。WebGL2 优先，拿不到上下文或 `reduced` 为真时走 Canvas 2D。

```ts
// 水面。对外只有 splash(x01, vel, pitch01, self)，不认识 midi、不认识音乐。
import { createRipples, type Ripple } from './ripples.ts'

export type Water = {
  splash(x01: number, vel: number, pitch01: number, self: boolean): void
  setDim(dim: number): void
  resize(): void
  start(): void
  stop(): void
}

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform vec4 uRipple[48];   // x, t0, amp, ±pitch
uniform int  uCount;
uniform float uTime;
uniform float uAspect;
uniform float uDim;

void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  float h = 0.0;
  float glowSelf = 0.0;
  float pitchMix = 0.0;

  for (int i = 0; i < 48; i++) {
    if (i >= uCount) break;
    vec4 r = uRipple[i];
    float age = uTime - r.y;
    if (age < 0.0) continue;

    float pitch = abs(r.w);
    bool self = r.w < 0.0;

    // 涟漪从水面底沿（贴着琴键那一侧）发出
    vec2 src = vec2(r.x * uAspect, -0.04);
    float d = distance(p, src);

    // 低音：长波长、慢衰减；高音：短波长、快衰减
    float k = mix(26.0, 88.0, pitch);
    float c = mix(0.22, 0.40, pitch);
    float decay = mix(0.45, 1.7, pitch);

    float env = exp(-decay * age) / (1.0 + d * 6.0);
    float wave = sin(k * (d - c * age)) * env * r.z;
    // 波前之外不该有振动
    wave *= smoothstep(0.0, 0.06, c * age - d + 0.06);

    h += wave;
    pitchMix += pitch * abs(wave);
    if (self) glowSelf += abs(wave);
  }

  // 伪法线
  float dx = dFdx(h) * 40.0;
  float dy = dFdy(h) * 40.0;
  vec3 n = normalize(vec3(-dx, -dy, 1.0));

  vec3 deep = vec3(0.020, 0.035, 0.062);
  vec3 cool = vec3(0.055, 0.16, 0.24);
  vec3 base = mix(deep, cool, clamp(pitchMix * 2.2, 0.0, 1.0));

  vec3 lightDir = normalize(vec3(0.35, 0.65, 0.72));
  float spec = pow(max(dot(n, lightDir), 0.0), 42.0);
  float rim = pow(1.0 - n.z, 2.0);

  vec3 col = base + spec * vec3(0.55, 0.78, 0.92) + rim * vec3(0.05, 0.11, 0.16);
  col += glowSelf * vec3(0.62, 0.46, 0.16);   // 用户弹的音，金边

  // 越靠下（贴近琴键）越暗，让键盘从水里长出来
  col *= mix(0.55, 1.0, smoothstep(0.0, 0.5, vUv.y));
  col *= uDim;

  outColor = vec4(col, 1.0);
}`

export function createWater(
  canvas: HTMLCanvasElement,
  opts: { cap: number; reduced: boolean },
): Water {
  const ripples = createRipples(opts.cap)
  const packed = new Float32Array(48 * 4)
  let dim = 1
  let raf = 0
  let t0 = performance.now()

  const gl = opts.reduced ? null : canvas.getContext('webgl2', { antialias: false, alpha: false })

  const splash: Water['splash'] = (x01, vel, pitch01, self) => {
    const r: Ripple = {
      x: x01,
      t0: (performance.now() - t0) / 1000,
      amp: 0.25 + vel * 0.75,
      pitch: pitch01,
      self,
    }
    ripples.add(r)
  }

  if (!gl) return createWater2D(canvas, ripples, opts, () => dim, splash, () => t0)

  const prog = gl.createProgram()!
  for (const [type, src] of [
    [gl.VERTEX_SHADER, VERT],
    [gl.FRAGMENT_SHADER, FRAG],
  ] as const) {
    const sh = gl.createShader(type)!
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(`shader 编译失败：${gl.getShaderInfoLog(sh)}`)
    }
    gl.attachShader(prog, sh)
  }
  gl.linkProgram(prog)
  gl.useProgram(prog)

  const quad = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

  const uRipple = gl.getUniformLocation(prog, 'uRipple')
  const uCount = gl.getUniformLocation(prog, 'uCount')
  const uTime = gl.getUniformLocation(prog, 'uTime')
  const uAspect = gl.getUniformLocation(prog, 'uAspect')
  const uDim = gl.getUniformLocation(prog, 'uDim')

  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const scale = window.innerWidth < 780 ? 0.5 : 1 // 移动端半分辨率
    canvas.width = Math.round(canvas.clientWidth * dpr * scale)
    canvas.height = Math.round(canvas.clientHeight * dpr * scale)
    gl.viewport(0, 0, canvas.width, canvas.height)
  }

  const frame = () => {
    const now = (performance.now() - t0) / 1000
    const n = ripples.pack(now, packed)
    gl.uniform4fv(uRipple, packed)
    gl.uniform1i(uCount, n)
    gl.uniform1f(uTime, now)
    gl.uniform1f(uAspect, canvas.clientWidth / Math.max(1, canvas.clientHeight))
    gl.uniform1f(uDim, dim)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    raf = requestAnimationFrame(frame)
  }

  resize()
  window.addEventListener('resize', resize)

  return {
    splash,
    setDim: (d) => {
      dim = d
    },
    resize,
    start: () => {
      if (!raf) {
        t0 = performance.now()
        raf = requestAnimationFrame(frame)
      }
    },
    stop: () => {
      cancelAnimationFrame(raf)
      raf = 0
    },
  }
}

/** 降级：Canvas 2D 同心圆环。reduced-motion 下不扩散，只做原地柔光。 */
function createWater2D(
  canvas: HTMLCanvasElement,
  ripples: ReturnType<typeof createRipples>,
  opts: { cap: number; reduced: boolean },
  getDim: () => number,
  splash: Water['splash'],
  getT0: () => number,
): Water {
  const ctx = canvas.getContext('2d')!
  const packed = new Float32Array(48 * 4)
  let raf = 0

  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(canvas.clientWidth * dpr)
    canvas.height = Math.round(canvas.clientHeight * dpr)
  }

  const frame = () => {
    const { width: W, height: H } = canvas
    const now = (performance.now() - getT0()) / 1000
    const n = ripples.pack(now, packed)

    ctx.fillStyle = '#050a10'
    ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'lighter'

    for (let i = 0; i < n; i++) {
      const x = packed[i * 4] * W
      const age = now - packed[i * 4 + 1]
      const amp = packed[i * 4 + 2]
      const pitch = Math.abs(packed[i * 4 + 3])
      const self = packed[i * 4 + 3] < 0
      const decay = 0.45 + pitch * 1.25
      const a = Math.max(0, amp * Math.exp(-decay * age)) * getDim()
      if (a <= 0.01) continue

      const r = opts.reduced ? H * 0.12 : (0.22 + pitch * 0.18) * age * H * 2.2
      ctx.strokeStyle = self
        ? `rgba(232,184,106,${a * 0.7})`
        : `rgba(${90 + pitch * 90},${170 + pitch * 60},${210 + pitch * 40},${a * 0.55})`
      ctx.lineWidth = Math.max(1, (1 - pitch) * 4)
      ctx.beginPath()
      ctx.arc(x, H, r, Math.PI, 2 * Math.PI)
      ctx.stroke()
    }

    ctx.globalCompositeOperation = 'source-over'
    raf = requestAnimationFrame(frame)
  }

  resize()
  window.addEventListener('resize', resize)

  return {
    splash,
    setDim: () => {},
    resize,
    start: () => {
      if (!raf) raf = requestAnimationFrame(frame)
    },
    stop: () => {
      cancelAnimationFrame(raf)
      raf = 0
    },
  }
}
```

- [ ] **Step 6: tsconfig 排除、类型检查、提交**

`exclude` 追加 `src/piano/ripples.check.ts`。

Run: `npx tsc --noEmit`
Expected: `No errors found`

```bash
git add src/piano/ripples.ts src/piano/ripples.check.ts src/piano/water.ts tsconfig.json
git commit -m "feat(piano): WebGL ripple water with Canvas 2D fallback"
```

---

### Task 6: 演出调度

**Files:**
- Create: `src/piano/player.ts`

**Interfaces:**
- Consumes: Task 1 的 `Instrument`、Task 2/3 的 `Piece`
- Produces:
  - `createPlayer(instrument: Instrument, opts: PlayerEvents)` → `type Player = { play(piece: Piece): Promise<void>; pause(): void; resume(): void; stop(): void; readonly playing: boolean; progress(): number }`
  - `type PlayerEvents = { onNote(midi: number, vel: number): void; onAnchor(memory: string): void; onEnd(): void }`
  - `shuffled<T>(items: T[], rng?: () => number): T[]`

- [ ] **Step 1: 写实现**

创建 `src/piano/player.ts`：

```ts
// 演出调度。吃一个 Piece，吐事件。不认识 DOM，也不认识水面。
import * as Tone from 'tone'
import type { Instrument } from './instrument.ts'
import type { Piece } from './score.ts'

/** 视觉回调比发声提前的秒数，让琴键在出声那一刻恰好压到底 */
const LEAD = 0.08

export type PlayerEvents = {
  onNote(midi: number, vel: number): void
  onAnchor(memory: string): void
  onEnd(): void
}

export type Player = {
  play(piece: Piece): Promise<void>
  pause(): void
  resume(): void
  stop(): void
  readonly playing: boolean
  progress(): number
}

/** Fisher–Yates。rng 可注入，便于复现。 */
export function shuffled<T>(items: T[], rng: () => number = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function createPlayer(instrument: Instrument, ev: PlayerEvents): Player {
  const parts: Tone.Part[] = []
  let current: Piece | null = null
  let playing = false

  const clear = () => {
    for (const p of parts) p.dispose()
    parts.length = 0
    Tone.getTransport().cancel()
    Tone.getTransport().stop()
    Tone.getTransport().seconds = 0
  }

  return {
    get playing() {
      return playing
    },
    progress() {
      if (!current) return 0
      return Math.min(1, Tone.getTransport().seconds / current.duration)
    },
    async play(piece) {
      clear()
      current = piece
      await instrument.ready

      const notePart = new Tone.Part((time, n: Piece['notes'][number]) => {
        instrument.strike(n.midi, n.v, n.d, time)
        Tone.getDraw().schedule(() => ev.onNote(n.midi, n.v), Math.max(0, time - LEAD))
      }, piece.notes.map((n) => [n.t, n] as [number, typeof n])).start(0)

      const anchorPart = new Tone.Part((time, a: Piece['anchors'][number]) => {
        Tone.getDraw().schedule(() => ev.onAnchor(a.memory), time)
      }, piece.anchors.map((a) => [a.t, a] as [number, typeof a])).start(0)

      parts.push(notePart, anchorPart)

      Tone.getTransport().scheduleOnce(() => {
        playing = false
        ev.onEnd()
      }, piece.duration + 2)

      playing = true
      Tone.getTransport().start()
    },
    pause() {
      Tone.getTransport().pause()
      playing = false
    },
    resume() {
      Tone.getTransport().start()
      playing = true
    },
    stop() {
      clear()
      playing = false
      current = null
    },
  }
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: `No errors found`

若 `Tone.Part` 的泛型签名报错，改用 `new Tone.Part<typeof n>(...)` 显式标注，或把回调参数类型标为 `any` 后在函数体首行做一次窄化赋值 —— 不要为了过类型把 `strict` 关掉。

- [ ] **Step 3: 提交**

```bash
git add src/piano/player.ts
git commit -m "feat(piano): Tone.Transport scheduler with 80ms visual lead"
```

---

### Task 7: 浮字层

**Files:**
- Create: `src/piano/reveal.ts`

**Interfaces:**
- Consumes: `src/content/memories.ts` 的 `memories`
- Produces: `createReveal(root: HTMLElement, opts: { reduced: boolean; onDim(dim: number): void })` → `type Reveal = { show(memoryId: string): void; clear(): void }`

- [ ] **Step 1: 写实现**

创建 `src/piano/reveal.ts`：

```ts
// 记忆浮字层。真实 DOM 文本 + aria-live，屏幕阅读器能读到；不画进 canvas。
import { memories } from '../content/memories.ts'

export type Reveal = { show(memoryId: string): void; clear(): void }

const HOLD_MS = 6000

export function createReveal(
  root: HTMLElement,
  opts: { reduced: boolean; onDim(dim: number): void },
): Reveal {
  root.setAttribute('aria-live', 'polite')
  let timer = 0
  let currentEl: HTMLElement | null = null

  const clear = () => {
    window.clearTimeout(timer)
    if (currentEl) {
      const el = currentEl
      el.classList.remove('in')
      window.setTimeout(() => el.remove(), 900)
      currentEl = null
    }
    opts.onDim(1)
  }

  return {
    clear,
    show(memoryId) {
      const m = memories.find((x) => x.id === memoryId)
      if (!m) {
        console.warn(`[piano] 找不到记忆 ${memoryId}`)
        return
      }
      clear() // 同一时刻只允许一条

      const el = document.createElement('article')
      el.className = `memory${opts.reduced ? ' reduced' : ''}`
      el.innerHTML =
        `<p class="memory-year">${m.year}</p>` +
        `<h2 class="memory-title">${m.title}</h2>` +
        m.story.map((s) => `<p class="memory-line">${s}</p>`).join('')
      root.appendChild(el)
      currentEl = el

      // 下一帧再加 in，保证过渡生效
      requestAnimationFrame(() => el.classList.add('in'))
      opts.onDim(0.65) // 文字在场时水面压暗 35%

      timer = window.setTimeout(clear, HOLD_MS)
    },
  }
}
```

- [ ] **Step 2: 类型检查并提交**

Run: `npx tsc --noEmit`
Expected: `No errors found`

```bash
git add src/piano/reveal.ts
git commit -m "feat(piano): memory reveal layer with aria-live text"
```

---

### Task 8: 页面、样式与装配

**Files:**
- Create: `piano.html`
- Create: `src/piano/style.css`
- Create: `src/piano/main.ts`
- Modify: `vite.config.ts`
- Modify: `index.html`、`journey.html`、`profile.html`（互链加「琴 →」）

**Interfaces:**
- Consumes: 前面所有模块
- Produces: 可跑的页面

- [ ] **Step 1: 加 vite 入口**

修改 `vite.config.ts` 的 `input`，追加：

```ts
piano: resolve(__dirname, 'piano.html'),
```

- [ ] **Step 2: 写 piano.html**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="一台可以弹的钢琴——三首曲子，三段人生。" />
    <meta name="theme-color" content="#050a10" />
    <title>琴 · Lee</title>
  </head>
  <body>
    <a class="skip-link" href="#memory-layer">跳到记忆文字</a>
    <a class="theme-link" href="./index.html">深渊 →</a>
    <a class="theme-link theme-link-2" href="./profile.html">炽热 →</a>

    <main class="stage">
      <section class="water-wrap" aria-hidden="true">
        <canvas id="water"></canvas>
        <p class="latin-mark" id="latin"></p>
      </section>

      <div class="memory-layer" id="memory-layer"></div>

      <header class="now-playing" hidden>
        <p class="np-title" id="np-title"></p>
        <p class="np-mood" id="np-mood"></p>
        <div class="np-progress"><i id="np-bar"></i></div>
      </header>

      <section class="piano" aria-label="钢琴">
        <div class="keys" id="keys"></div>
      </section>

      <div class="gate" id="gate">
        <p class="gate-title">一台可以弹的钢琴</p>
        <p class="gate-hint">按任意键 · 开始</p>
      </div>

      <div class="controls" hidden id="controls">
        <button id="btn-pause" type="button" aria-label="暂停或继续">⏸</button>
        <button id="btn-next" type="button" aria-label="下一首">⏭</button>
      </div>

      <p class="credit">
        Salamander Grand Piano · Alexander Holm ·
        <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">CC-BY 3.0</a>
      </p>
      <p class="fallback-note" id="fallback-note" hidden>音频不可用，仍可观看</p>
    </main>

    <noscript>
      <p class="noscript">这一页需要 JavaScript 才能发声。三首曲子分别对应童年、青年与此刻，各自绑着几段记忆。</p>
    </noscript>

    <script type="module" src="/src/piano/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 3: 写 style.css**

创建 `src/piano/style.css`，令牌沿用站点家族（深色底、米白衬线、金/蓝/薄荷三强调）。必须包含：

- `.stage` 满屏纵向分区：`.water-wrap` 占 60%（移动端 50%），`.piano` 占其余
- `.keys` 为 `position: relative; overflow: hidden`，`.key` 绝对定位（`left`/`width` 由 JS 写百分比）；白键米白、黑键近黑、按下有 `translateY(2px)` 与发光
- `.key.lit` 冷青高亮，`.key.lit-self` 金色高亮
- `.key:focus-visible` 明显光环
- `.memory-layer` 覆盖水面区域，`.memory` 初始 `opacity: 0; transform: translateY(28px)`，`.memory.in` 归零；`.memory.reduced` 只做 opacity 过渡
- `.gate` 全屏遮罩，触发后加 `.gone` 淡出
- `@media (prefers-reduced-motion: reduce)`：所有 transform 过渡关掉，只留 opacity
- `@media (max-width: 780px)`：`.keys` 改为 `overflow-x: auto`，内层容器宽度 `340%`，形成可横向拖动的键盘条

- [ ] **Step 4: 写 main.ts 装配层**

创建 `src/piano/main.ts`：

```ts
import './style.css'
import * as Tone from 'tone'
import { createInstrument } from './instrument.ts'
import { createKeyboard } from './keyboard.ts'
import { centerX, pitch01 } from './keys.ts'
import { createPlayer, shuffled } from './player.ts'
import { createReveal } from './reveal.ts'
import { createWater } from './water.ts'
import { PIECES } from './pieces.ts'
import type { Piece } from './score.ts'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const mobile = matchMedia('(max-width: 780px)').matches

const water = createWater($<HTMLCanvasElement>('water'), {
  cap: mobile ? 24 : 48,
  reduced,
})
const reveal = createReveal($('memory-layer'), { reduced, onDim: (d) => water.setDim(d) })

const instrument = createInstrument(
  new URL('./assets/salamander/', import.meta.url).href,
)

/** 一个音发生了：亮键 + 起涟漪。self = 用户弹的。 */
const strikeVisual = (midi: number, vel: number, self: boolean) => {
  keyboard.flash(midi, self)
  water.splash(centerX(midi), vel, pitch01(midi), self)
}

const keyboard = createKeyboard($('keys'), {
  onNote: (midi, vel) => {
    instrument.attack(midi, vel)
    window.setTimeout(() => instrument.release(midi), 900)
    strikeVisual(midi, vel, true)
    duck()
  },
})

const player = createPlayer(instrument, {
  onNote: (midi, vel) => strikeVisual(midi, vel, false),
  onAnchor: (memory) => reveal.show(memory),
  onEnd: () => nextPiece(),
})

/* ---------- 用户弹奏时曲子让路 ---------- */
let userNotes = 0
let duckTimer = 0
function duck() {
  userNotes++
  if (userNotes >= 8) instrument.setVolume(-6)
  window.clearTimeout(duckTimer)
  duckTimer = window.setTimeout(() => {
    userNotes = 0
    instrument.setVolume(0)
  }, 4000)
}

/* ---------- 随机不重复连播 ---------- */
let queue: Piece[] = []
function nextPiece() {
  if (!queue.length) queue = shuffled(PIECES)
  const piece = queue.shift()!
  $('np-title').textContent = piece.title
  $('np-mood').textContent = piece.mood
  $('latin').textContent = piece.latin
  reveal.clear()
  void player.play(piece)
}

/* ---------- 进度条 ---------- */
function tickProgress() {
  $('np-bar').style.width = `${(player.progress() * 100).toFixed(2)}%`
  requestAnimationFrame(tickProgress)
}

/* ---------- 开场闸门 ---------- */
let started = false
async function start() {
  if (started) return
  started = true
  $('gate').classList.add('gone')
  window.setTimeout(() => $('gate').setAttribute('hidden', ''), 800)
  water.start()
  tickProgress()

  try {
    await Tone.start()
    await Promise.race([
      instrument.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('采样加载超时')), 8000)),
    ])
  } catch (err) {
    console.warn('[piano] 进入静音模式：', err)
    $('fallback-note').removeAttribute('hidden')
  }

  document.querySelector('.now-playing')!.removeAttribute('hidden')
  $('controls').removeAttribute('hidden')
  nextPiece()
}

window.addEventListener('keydown', start, { once: true })
window.addEventListener('pointerdown', start, { once: true })

/* ---------- 控件与快捷键 ---------- */
$('btn-pause').addEventListener('click', () => (player.playing ? player.pause() : player.resume()))
$('btn-next').addEventListener('click', () => nextPiece())

window.addEventListener('keydown', (e) => {
  if (!started) return
  if (e.key === ' ') {
    e.preventDefault()
    player.playing ? player.pause() : player.resume()
  } else if (e.key.toLowerCase() === 'n') {
    nextPiece()
  } else if (e.key === 'ArrowLeft') {
    keyboard.setOctave(-1)
  } else if (e.key === 'ArrowRight') {
    keyboard.setOctave(1)
  }
})

/* ---------- 切后台不跳音 ---------- */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (player.playing) player.pause()
    water.stop()
  } else if (started) {
    water.start()
  }
})
```

- [ ] **Step 5: 跑起来看**

Run: `npm run dev`，浏览器开 `http://localhost:5173/piano.html`
Expected: 黑场 + 钢琴 + 「按任意键 · 开始」；按键后采样加载完开始弹，琴键随音亮起，水面起涟漪，锚点处浮字

- [ ] **Step 6: 三个主题互链**

`index.html`、`journey.html`、`profile.html` 各加一条指向 `./piano.html` 的「琴 →」链接，位置与既有 theme-link 一致（往下再错开一行）。

- [ ] **Step 7: 类型检查、构建、提交**

Run: `npm run build`
Expected: check 全过，构建成功

```bash
git add piano.html src/piano/style.css src/piano/main.ts vite.config.ts index.html journey.html profile.html
git commit -m "feat(piano): page shell, styles and wiring"
```

---

### Task 9: 降级、移动端与无障碍收口

**Files:**
- Modify: `src/piano/main.ts`、`src/piano/style.css`、`piano.html`

- [ ] **Step 1: 键盘可达性**

`keyboard.ts` 生成的 `<button>` 天然可 Tab，但 88 个键会淹没 Tab 序列。改为**键组内方向键导航**：容器 `tabindex="0"`，键本身 `tabindex="-1"`；容器聚焦后左右方向键在键之间移动焦点（`element.focus()`），Enter/空格发声。注意与「左右方向键移八度」冲突——键盘容器聚焦时方向键归导航，未聚焦时归移八度。在 `main.ts` 的全局 keydown 里判断 `document.activeElement?.closest('.keys')` 后再决定。

- [ ] **Step 2: 静音模式下特效照走**

`main.ts` 里若采样加载失败，仍要 `player.play(piece)` —— 因为 `instrument.strike` 内部对未加载的 Sampler 调用会静默失败或抛错。给 `instrument.ts` 的三个方法各包一层 `try { … } catch { /* 静音模式 */ }`，保证画面时间轴不被打断。

- [ ] **Step 3: 移动端键盘条**

`style.css` 的 `@media (max-width: 780px)` 里，`.keys` 外层加 `overflow-x: auto; -webkit-overflow-scrolling: touch`，内层宽 `340%`，初始 `scrollLeft` 定位到中央 C（在 `main.ts` 里 `keysEl.scrollLeft = keysEl.scrollWidth * 0.42`）。

- [ ] **Step 4: 逐项验收**

对照检查，每条都实测：

1. 关掉 WebGL（Chrome DevTools → Rendering → 禁用 WebGL，或临时把 `createWater` 的 `webgl2` 改成 `webgl9`）→ 落到 Canvas 2D，仍有涟漪
2. 系统开启「减弱动态效果」→ 涟漪不扩散、琴键不位移、浮字直接淡入
3. 断网后刷新 → 8 秒后出现「音频不可用，仍可观看」，特效仍跑完整曲
4. 切到别的标签页再回来 → 不跳音、不错位
5. 键盘 Tab 到琴键组 → 方向键移动、Enter 发声、焦点光环可见
6. 手机尺寸 → 键盘条可横向拖动、点击可发声
7. macOS VoiceOver 打开 → 浮字出现时被朗读

- [ ] **Step 5: 提交**

```bash
git add src/piano/main.ts src/piano/style.css src/piano/keyboard.ts piano.html
git commit -m "feat(piano): fallbacks, mobile keyboard strip and a11y pass"
```

---

### Task 10: 验收截图与文档

**Files:**
- Modify: `docs/superpowers/specs/2026-07-28-piano-theme-design.md`（如实现中有偏离，回写实际做法）
- Modify: `src/piano/pieces.ts`（按试听结果微调力度与时值）

- [ ] **Step 1: 三首完整试听**

各听完一遍，记录问题：有没有爆音（同时音符过多导致削波）、节奏是否稳、乐句是否自然、锚点浮字是否卡在旋律高点上。

爆音的处理：`instrument.ts` 里给 sampler 后面串一个 `new Tone.Limiter(-3)`，或整体 `setVolume(-4)`。

- [ ] **Step 2: 弹奏与合奏**

自动演奏时用电脑键盘连弹 10 个音，确认：音准对、涟漪带金边、连弹 8 个后曲子明显降下去、停手 4 秒后恢复、全程不掉帧（DevTools Performance 录 10 秒，看有没有长任务）。

- [ ] **Step 3: 截图存档**

用 Playwright 或系统截图，对开场、演奏中、浮字三态各截一张，贴给用户确认观感。若观感不合格，回到 `style.css` 与 shader 参数（`k` / `c` / `decay` / 颜色）调整——**这一步必须拿到用户认可才算完成**，参考项目里既有的「样张确认制」。

- [ ] **Step 4: 回写规格并提交**

```bash
git add docs/superpowers/specs/2026-07-28-piano-theme-design.md src/piano/
git commit -m "chore(piano): tuning pass after listening review"
```

---

## 自查记录

- **规格覆盖**：选型（Task 1/5/6）、架构七模块（Task 1–8 逐一落地）、数据结构与 id 约定（Task 2/3）、三首曲子与分段规则（Task 3）、版面与开场（Task 8）、shader 公式与音高映射（Task 5）、80 ms 提前量（Task 6）、你弹 vs 曲子弹（Task 5 金边 + Task 8 duck）、浮字与压暗（Task 7）、键位（Task 4/8）、降级矩阵（Task 5/9）、错误处理（Task 8/9）、性能预算（Task 5 移动端半分辨率 + Task 8 手势后加载）、无障碍（Task 4/7/9）、测试（Task 2/3/4/5 的 check + Task 9/10 人工清单）—— 均有对应任务。
- **YAGNI**：规格「不做」清单里的录制回放、MIDI 设备、乐谱显示、音色切换、真实水面模拟，计划里一处都没有。
- **命名一致性**：`splash(x01, vel, pitch01, self)`、`flash(midi, self)`、`show(memoryId)`、`strike(midi, vel, dur, when)` 在各任务间保持同名同签名。
