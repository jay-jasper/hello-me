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

/* ---------- 2 · 雨落 Rainfall ----------
   A 小调，进行 Am7–Fmaj7–Dm7–Em7。
   左手绵密八分音型如雨滴，右手旋律在小三度内起伏；
   第 16–20 小节（0 起 15–19）转平行大调再落回。            */

const RF_BAR = 3.0
const RF_BARS = 33
const RF_PROG: string[][] = [
  ['a2', 'e3', 'c4', 'g4'], // Am7
  ['f2', 'c3', 'a3', 'e4'], // Fmaj7
  ['d2', 'a2', 'f3', 'c4'], // Dm7
  ['e2', 'b2', 'g3', 'd4'], // Em7
]
// 中段转向的平行（关系）大调进行：C – G – F – Em，明亮四小节后落回 Am7
const RF_PROG_MAJOR: string[][] = [
  ['c3', 'g3', 'e4', 'b4'], // Cmaj9
  ['g2', 'd3', 'b3', 'f4'], // G
  ['f2', 'c3', 'a3', 'e4'], // Fmaj7
  ['e2', 'b2', 'g3', 'd4'], // Em7
]
const RF_MAJOR_START = 15
const RF_MAJOR_END = 19 // 含

function rainfall(): Piece {
  const notes: Note[] = []

  // 左手：整曲绵密八分音型，如雨滴敲打
  for (let bar = 0; bar < RF_BARS; bar++) {
    const inMajor = bar >= RF_MAJOR_START && bar <= RF_MAJOR_END
    const chord = inMajor ? RF_PROG_MAJOR[(bar - RF_MAJOR_START) % 4] : RF_PROG[bar % 4]
    notes.push(
      ...arp(chord, {
        start: bar * RF_BAR,
        step: RF_BAR / 8,
        dur: RF_BAR / 6,
        v: 0.26,
        times: 2,
      }),
    )
  }

  // 右手：旋律在小三度内往复，中段转明亮
  const phraseA = 'a4 c5 - b4 . a4 g4 -'
  const phraseB = 'c5 e5 - d5 . c5 b4 -' // 三度上移变奏
  const phraseMajor = 'c5 e5 - g5 . e5 d5 -' // 平行大调的明亮变奏
  for (let bar = 2; bar < RF_BARS - 2; bar++) {
    const inMajor = bar >= RF_MAJOR_START && bar <= RF_MAJOR_END
    const phrase = inMajor ? phraseMajor : bar % 4 < 2 ? phraseA : phraseB
    notes.push(...mel(phrase, { start: bar * RF_BAR, step: RF_BAR / 8, dur: RF_BAR / 4, v: 0.58 }))
  }

  // 尾句：落回 A 小调收束
  notes.push(...pad(['a2', 'e3', 'c4'], { start: (RF_BARS - 2) * RF_BAR, d: RF_BAR, v: 0.3 }))
  notes.push(...pad(['a2', 'e3', 'c4', 'g4'], { start: (RF_BARS - 1) * RF_BAR, d: RF_BAR * 1.4, v: 0.36 }))

  sort(notes)
  return {
    id: 'rainfall',
    title: '雨落',
    latin: 'RAINFALL',
    mood: '青年 · 绵密、忧郁，中段有一线微光',
    duration: endOf(notes),
    notes,
    // 锚点落在右手乐句交界（每小节），引用雨落时期的记忆
    anchors: [
      { t: RF_BAR * 6, memory: '2016-first-code' },
      { t: RF_BAR * 16, memory: '2018-graduation-rain' }, // 落在转明亮的中段
      { t: RF_BAR * 26, memory: '2021-first-loved-job' },
    ],
  }
}

/* ---------- 3 · 远山 Distant Hills ----------
   D 大调，左手空五度长音铺底（D–G–A–Bm 的五度，即 王道进行 I–IV–V–vi），
   右手长音旋律，全曲织体最疏，收在渐弱的长音上。              */

const DH_BAR = 3.5
const DH_BARS = 30
const DH_PROG: string[][] = [
  ['d2', 'a2'], // I：D 的五度
  ['g2', 'd3'], // IV：G 的五度
  ['a2', 'e3'], // V：A 的五度
  ['b1', 'f#2'], // vi：Bm 的五度
]

function distantHills(): Piece {
  const notes: Note[] = []

  // 左手：空五度长音铺底，直到最后一小节延音渐弱
  for (let bar = 0; bar < DH_BARS - 1; bar++) {
    notes.push(...pad(DH_PROG[bar % 4], { start: bar * DH_BAR, d: DH_BAR, v: 0.3 }))
  }
  notes.push(
    ...pad(DH_PROG[(DH_BARS - 1) % 4], {
      start: (DH_BARS - 1) * DH_BAR,
      d: DH_BAR * 2.5,
      v: 0.34,
    }),
  )

  // 中声部：极轻的分解和弦。这一首本来只有 90 个音，水面上大半时间是空的——
  // 加一层弱奏内声部，让余韵接得上，同时不破坏"最疏"的听感（力度只有旋律的四成）。
  for (let bar = 2; bar < DH_BARS - 2; bar++) {
    notes.push(
      ...arp([...DH_PROG[bar % 4], DH_PROG[(bar + 1) % 4][0]], {
        start: bar * DH_BAR + DH_BAR / 4,
        step: DH_BAR / 6,
        dur: DH_BAR / 2,
        v: 0.2,
      }),
    )
  }

  // 右手：长音旋律，每句跨 2 小节，之后留白只剩铺底，织体最疏
  const phraseA = 'f#4 - - a4 - b4 - -'
  const phraseB = 'e4 - - f#4 - a4 - -'
  for (let bar = 4; bar < DH_BARS - 6; bar += 2) {
    const phrase = (bar / 2) % 2 === 0 ? phraseA : phraseB
    notes.push(...mel(phrase, { start: bar * DH_BAR, step: DH_BAR / 4, v: 0.5 }))
  }

  sort(notes)
  return {
    id: 'distant-hills',
    title: '远山',
    latin: 'DISTANT HILLS',
    mood: '此刻 · 开阔，安宁',
    duration: endOf(notes),
    notes,
    // 锚点落在乐句交界（每 2 小节），引用近年的记忆
    anchors: [
      { t: DH_BAR * 8, memory: '2023-far-trip' },
      { t: DH_BAR * 16, memory: '2026-abyss-built' },
    ],
  }
}

export const PIECES: Piece[] = [morningWindow(), rainfall(), distantHills()]
