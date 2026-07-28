# 第三主题 · 「炽热」Profile — 复刻 my.liuyuyang.net

参考站：https://my.liuyuyang.net（Next.js + Tailwind v4 + GSAP）
本仓库实现：Vite 多入口 + 原生 TS + GSAP/ScrollTrigger，入口 `profile.html` → `src/profile/`

内容：Lee 自己的（复用 `src/config.ts` / `src/content/memories.ts`，新增 `src/profile/data.ts`）
图片：AI 生成同风格素材，放 `src/profile/assets/`

---

## 设计令牌（从参考站实测）

```
背景        #050608  (body)  · 段落局部 #06060f / #0a0c10 / #0b0f14
正文        #f4f0e8  米白
弱文        rgba(244,240,232,.55)
金/琥珀     #e8b86a  #f0c060  #d89828  #c4923f   ← 强调 1（数字、序号、关键词）
蓝          #539dfd  #8ec5ff  #b7d9ff             ← 强调 2（姓名、链接）
薄荷        #9fe8d0  #b7ffe8  #63d47f             ← 强调 3（地名、身份）
主字体      'Noto Serif SC', 'Songti SC', serif   （已装 @fontsource/noto-serif-sc）
等宽/字母间距标签  ui-monospace + letter-spacing: .2em + uppercase
```

排版规律：
- 巨型标题 clamp 到 5–9rem，字重 600，行高 1.05
- 每段有一个「水印巨字」：同文案放大到 12–20rem，`color: rgba(255,255,255,.03)`，斜体或正体，压在背景上
- 小标签一律 `letter-spacing:.25em; font-size:.7rem; text-transform:uppercase`
- 段落间不留白，段与段直接切换背景

## 段落清单（11 段，顺序即滚动顺序）

| # | id | 参考站原意 | 本站内容 | 核心动效 |
|---|----|-----------|---------|---------|
| 1 | `hero` | Hello 我叫刘宇阳 | Hello 我叫 Lee | 黑洞背景缓慢旋转；巨字逐字上浮；6 个标签气泡各自呼吸浮动；4 格 stat 卡依次淡入 |
| 2 | `place` | 目前我在浙江宁波 | 目前所在城市 | 地图底图缓推近；定位点脉冲环；底部坐标 HUD 数字滚动 |
| 3 | `creed` | 四页理念 pin scroll | 四条自述 | ScrollTrigger pin + snap，四页横向/淡入切换，水印巨字交叉换字，左侧竖线进度 + `01 / 04` |
| 4 | `freedom` | 我渴望自由去环游世界 | 同题 | 背景图慢速 ken-burns；地名跑马灯无限横滚 |
| 5 | `photos` | 照片墙 14 张拍立得 | 同（AI 生成风景） | 滚动驱动拍立得散开/聚拢，各自随机旋转 |
| 6 | `identity` | 我是开源项目作者 | 我还有一个身份 | 地球缓慢上移；标题渐变色（金→薄荷）逐字亮起 |
| 7 | `works` | ThriveX 截图墙 | 本站两个既有主题的真实截图 + 项目 | 3D perspective 墙，滚动时整体 rotateY 微转、各卡视差 |
| 8 | `stack` | 服务器赞助卡 | 「此站构造」技术栈卡 | 中央卡片描边呼吸；左右两张虚线「虚位以待」卡 |
| 9 | `voices` | 留言弹幕墙 | 语录/自言自语墙 | 多行反向无限横滚，每行速度不同，边缘渐隐遮罩 |
| 10 | `summit` | 半山腰风景很美，我更想到山顶 | 同题 | 剪影图视差上移；「山顶」二字放大淡入 |
| 11 | `milestones` | 里程碑横向拖拽时间轴 | 用 `memories.ts` 生成 | 横向滚动 + 拖拽；金色正弦曲线连接节点；卡片上下交错 |

## 动效规则

- 全部走 GSAP ScrollTrigger，`prefers-reduced-motion` 时只保留淡入
- 段内元素统一 `y: 40 → 0, opacity: 0 → 1, duration: .9, ease: 'power3.out'`，`stagger: .08`
- pin 段（creed）用 `snap: 1 / 3`
- 横滚段（voices / freedom 跑马灯）用 CSS `animation: marquee linear infinite`，不占 ScrollTrigger
- milestones 用 ScrollTrigger `pin + horizontal translate`，叠加 pointer 拖拽

## 图片资产（AI 生成，`src/profile/assets/`）

| 文件 | 用途 | 提示词方向 |
|------|------|-----------|
| `hero-void.webp` | 1 hero | 深空黑洞吸积盘，暗调，极简，右上角构图 |
| `map-city.webp` | 2 place | 暗色卫星/线框地图俯视，去饱和，暖光晕 |
| `valley.webp` | 4 freedom | 宽阔山谷草原河流，青蓝调，插画感 |
| `earth.webp` | 6 identity | 太空看地球弧线，夜面城市灯，冷调 |
| `summit.webp` | 10 summit | 黄昏草原上一个逆光人影剪影，暖橙+青蓝 |
| `photo-01..08.webp` | 5 photos | 旅行风景：城市仰拍、水乡、山岩、古建、湖夜景等 |

## 无障碍

- 每段 `<section aria-label>`，装饰层 `aria-hidden`
- 跳过链接直达 `#milestones`
- 巨型水印字用 `aria-hidden`，不进朗读
