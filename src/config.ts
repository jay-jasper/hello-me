// 站点唯一需要日常维护的两个文件之一（另一个是 src/content/memories.ts）。
// 改这里不需要懂任何特效代码。

export const site = {
  name: 'Lee',
  tagline: '在无垠黑暗里，记录我的一生。',
  // 出生年：决定海底的年份，也决定"深度→年代"的映射。
  birthYear: 1994,
  // 此刻在做什么（-20m 展示）
  now: [
    '给自己造了一片海——你现在就在里面。',
    '写代码，也写下沉淀下来的生活。',
  ],
  socials: [
    { label: 'GitHub', url: 'https://github.com/jay-jasper' },
    { label: 'Email', url: 'mailto:li563816210@gmail.com' },
  ],
  seabedText: (birthYear: number) =>
    `${birthYear} 年，一切从这里开始。那时还没有光，也没有故事——只有一颗即将上浮的气泡。`,
}
