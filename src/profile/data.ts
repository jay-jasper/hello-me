// 「炽热」主题唯一需要维护的文件。里程碑段直接复用 src/content/memories.ts。
// 改这里不需要懂任何特效代码。

/** 一段可高亮的文字：accent = 金色，hl = 蓝色底纹 */
type Line = { text: string; accent?: boolean; hl?: boolean }

export const profile = {
  eyebrow: '一个平凡却认真的人',
  greeting: 'Hello,',
  nameLead: '我叫',
  name: 'Lee',
  role: '全栈工程师',
  intro: <Line[]>[
    { text: '我是一名 ' },
    { text: '写代码也写生活', accent: true },
    { text: ' 的人。' },
  ],
  lede: '一直对「把东西造出来」这件事着迷，从命令行到三维海底，从一行 CSS 到一整个人生记录站。你现在看到的，就是折腾出来的其中一个。',
  links: [
    { label: '深渊来信', href: './index.html', primary: true },
    { label: '旅路三幕', href: './journey.html' },
    { label: 'GITHUB', href: 'https://github.com/jay-jasper' },
  ],
  bubbles: [
    '💻 全栈开发工程师',
    '🖥 数码科技爱好者',
    '🌊 造过一片海',
    '✨ 源于热爱而发电',
    '📓 一生记录者',
    '🎬 动画演出爱好者',
  ],
  stats: [
    { k: '角色', v: '前端 / 后端' },
    { k: '坐标', v: '中国 · 杭州' },
    { k: '作品', v: 'HELLO-ME' },
    { k: '态度', v: '热爱驱动' },
  ],

  /* 2 · 所在地 —————————————————————————— */
  place: {
    prefix: '目前我在',
    region: '浙江',
    city: '杭州',
    cityLatin: 'HANGZHOU',
    suffix: '写代码，也写自己',
    lat: '30.2741° N',
    lng: '120.1551° E',
    meta: 'EAST CHINA · FULL STACK',
  },

  /* 3 · 四页自述（pin 滚动） ————————————— */
  creed: [
    {
      mark: '热爱',
      title: '热爱',
      lines: <Line[]>[
        { text: '对很多人来说，写代码是一件 ' },
        { text: '不得不做', accent: true },
        { text: ' 的事；\n对我来说，它是我下班后还想继续做的那件。' },
      ],
    },
    {
      mark: '全局',
      title: '全局',
      lines: <Line[]>[
        { text: '所谓：' },
        { text: '「不谋全局者，不足谋一域」', hl: true },
        { text: '\n只盯着一个领域，是做不出一个完整的东西的。' },
      ],
    },
    {
      mark: '记录',
      title: '记录',
      lines: <Line[]>[
        { text: '人这一生会忘掉绝大部分事。\n所以我把它们 ' },
        { text: '沉进海里', accent: true },
        { text: '，写进路上，\n让每一段都还能被重新走一遍。' },
      ],
    },
    {
      mark: '长期',
      title: '长期',
      lines: <Line[]>[
        { text: '不追当季的框架，只造 ' },
        { text: '能留很久的东西', accent: true },
        { text: '。\n十年后打开还能跑，才算做完。' },
      ],
    },
  ],

  /* 4 · 自由 ————————————————————————————— */
  freedom: {
    watermark: 'FREEDOM',
    title1: '我渴望自由，',
    title2: '去环游世界',
    lede: '代码之外，还有辽阔的山海与未知的远方。我想用脚步丈量世界，用双眼收藏自由。',
    places: ['冰岛', '西藏', '巴塔哥尼亚', '挪威', '日本', '新西兰', '瑞士', '加拿大', '摩洛哥', '苏格兰'],
  },

  /* 5 · 照片墙 ————————————————————————— */
  photos: {
    caption: 'RANDOM · 8 SHOTS',
    action: { label: '打开完整相册', href: './journey.html' },
  },

  /* 6 · 另一个身份 ——————————————————————— */
  identity: {
    line1: '对了，我还有一个',
    line1Accent: '身份',
    line2: '我是一名',
    line2Accent: '造站的人',
    sub: '热爱是所有的理由与解释',
  },

  /* 7 · 作品墙 ——————————————————————————— */
  works: {
    watermark: '我想造一个',
    title: '完整',
    titleTail: '的东西。',
    lede: '一个人从设计、前端、动效到部署全都做完 —— 这个站本身就是答案。',
    items: [
      { name: '深渊来信', tag: 'THREE.JS', shot: 'shot-abyss' },
      { name: '旅路三幕', tag: 'GSAP', shot: 'shot-journey' },
      { name: '炽热', tag: 'SCROLL', shot: 'shot-profile' },
    ],
  },

  /* 8 · 此站构造（对应参考站的赞助位） ————— */
  stack: {
    badge: '此站构造',
    name: 'HELLO · ME',
    lede: '三个主题，同一个人',
    chips: ['VITE', 'TS', 'GSAP', 'THREE'],
    action: { label: '看源码', href: 'https://github.com/jay-jasper' },
    placeholders: ['虚位以待', '虚位以待'],
  },

  /* 9 · 语录墙 ————————————————————————— */
  voices: {
    title1: '一些',
    title2: '自言自语',
    rows: [
      [
        { who: '2019', text: '第一次把 hello world 跑起来，屏幕亮的那一下现在还记得。' },
        { who: '深夜', text: '写不出来的时候就去洗个澡，答案一般在花洒下面。' },
        { who: '同事', text: '你这个人怎么连自己的博客都要写动效。' },
        { who: '我', text: '因为好看的东西，值得多花两个通宵。' },
      ],
      [
        { who: '朋友', text: '你造这些站有什么用？' },
        { who: '我', text: '没什么用，但我三十年后一定会打开看。' },
        { who: '2023', text: '去了一个没有信号的地方，才发现时间原来可以这么慢。' },
        { who: '妈', text: '别老熬夜。' },
      ],
      [
        { who: '读者', text: '第一次见有人把人生做成一次下潜。' },
        { who: '我', text: '越深，越早 —— 这是整个站唯一的规则。' },
        { who: '2026', text: '第三个主题上线了。还会有第四个。' },
        { who: '未来的我', text: '希望你还在写。' },
      ],
    ],
  },

  /* 10 · 山顶 ————————————————————————— */
  summit: {
    lead: ['半山腰风景很美，', '然而我还是更想到'],
    big: '山顶',
    tail: '去看看。',
  },

  /* 11 · 里程碑 ————————————————————————— */
  milestones: {
    title: '里程碑',
    hint: '← 拖拽探索 →',
  },
}
