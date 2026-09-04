// 站点第三个「只填内容不碰代码」的文件（另两个是 src/config.ts 与 src/content/memories.ts）。
//
// 星图主题把一生切成若干星座：每段人生阶段一座，段内的每条记忆是一颗星。
// 星点不在这里填 —— memories.ts 的条目按 year 落进 [yearFrom, yearTo] 自动归座，
// 你加一条记忆，对应星座就多一颗星。
//
// 规矩（src/starmap/sample.check.ts 会强制）：
//   1. 区间不许重叠，且按 yearFrom 升序
//   2. 每座至少要有一条记忆落进去，否则报错（空星座是数据错，不是视觉选择）
//   3. 超过 7 座只是警告 —— 页面会很长，但那是你的判断

export type Constellation = {
  /** 全站唯一 */
  id: string
  /** 星座名，两到四个字最好看 */
  name: string
  /** 含 */
  yearFrom: number
  /** 含 */
  yearTo: number
  /**
   * 这一段人生的符号，SVG path 的 d，画在 24×24 的 viewBox 里，按描边处理。
   * 粒子会沿它成形，再塌陷成星点 —— 所以要选轮廓清楚、笔画不太密的形。
   */
  symbol: string
  /** 该座的氛围辉光色。年代越早越冷，越近越暖。 */
  ambient: string
  /** 一句话。出现在星座名下面。 */
  blurb: string
}

export const constellations: Constellation[] = [
  {
    id: 'origin',
    name: '起点',
    yearFrom: 1994,
    yearTo: 2007,
    // 纸飞机
    symbol: 'M2.5 12L21.5 3.5L17.5 21L11.5 15.5L2.5 12M11.5 15.5L21.5 3.5',
    ambient: '#1B2E4A',
    blurb: '还不知道要去哪，先把纸折起来扔出去。',
  },
  {
    id: 'study',
    name: '求学',
    yearFrom: 2008,
    yearTo: 2016,
    // 摊开的书
    symbol:
      'M12 5.2C12 5.2 9.4 3.4 6.2 3.4C4.4 3.4 2.6 3.9 2.6 3.9V19.4C2.6 19.4 4.4 18.9 6.2 18.9C9.4 18.9 12 20.6 12 20.6' +
      'M12 5.2C12 5.2 14.6 3.4 17.8 3.4C19.6 3.4 21.4 3.9 21.4 3.9V19.4C21.4 19.4 19.6 18.9 17.8 18.9C14.6 18.9 12 20.6 12 20.6' +
      'M12 5.2V20.6',
    ambient: '#23435F',
    blurb: '一间接一间的教室，一盏接一盏没关的灯。',
  },
  {
    id: 'craft',
    name: '入行',
    yearFrom: 2017,
    yearTo: 2020,
    // 尖括号
    symbol: 'M9 7.5L3.5 12L9 16.5M15 7.5L20.5 12L15 16.5M13.4 4.8L10.6 19.2',
    ambient: '#2C5163',
    blurb: '把想做的事，写成了能跑起来的东西。',
  },
  {
    id: 'faraway',
    name: '远行',
    yearFrom: 2021,
    yearTo: 2024,
    // 经纬球
    symbol:
      'M12 2.5A9.5 9.5 0 1 0 12 21.5A9.5 9.5 0 1 0 12 2.5' +
      'M2.5 12H21.5' +
      'M12 2.5C15.2 6 15.2 18 12 21.5M12 2.5C8.8 6 8.8 18 12 21.5',
    ambient: '#4A4A63',
    blurb: '走远一点才知道，家是拿来回的。',
  },
  {
    id: 'now',
    name: '此刻',
    yearFrom: 2025,
    yearTo: 2035,
    // 四角星
    symbol: 'M12 2.2L14.2 9.8L21.8 12L14.2 14.2L12 21.8L9.8 14.2L2.2 12L9.8 9.8L12 2.2',
    ambient: '#6B5540',
    blurb: '还在写。这一座往后会越来越亮。',
  },
]
