# 星图 · 人即星座 — 设计规格

第五个主题。技法源自 OpenAI GPT-6 Astra 发布页的粒子成形背景（2026-09-04 实测提取），
隐喻自定：**每段人生阶段是一个星座，每条记忆是一颗星**。

## Concept

滚动 = 沿时间走过自己的星图。

每个星座先以一个符号成形（求学是一本书、迁徙是一架飞机……），停留片刻，
再塌陷成该阶段真实记忆的星点分布，星与星按年份顺序连成折线——**线本身就是时间**。

场景句：深空真空里的一次巡天。没有大气、没有雾、光不衰减；
星芒锐利，中心过曝，其余是彻底的黑。

与「深渊下潜」的区分是**质地不是色相**：
深渊是浑浊的水体，有体积雾、光会被水吞；星图是绝对干净的真空，光锐利到刺眼。
两者都暗，远看不会认错。

## 源站提取（实测，非推测）

2026-09-04 用 ego-browser 通过 Cloudflare 后从 `https://openai.com/index/gpt-6-astra/` 读出：

- `<canvas data-engine="three.js r180">`，WebGL2，`position: fixed; inset: 0; z-0`，
  正文（33408px 长滚）滚过固定背景
- 粒子按 SVG 路径成形。页面内 `shapeTarget`（19×19 viewBox 的 sparkle 描边路径）
  + `shapeCue` 容器（`max-width: 36rem; height: 80vh`）
- 实拍三态：螺旋星系 → 光标箭头 → OpenAI 结
- 粒子非纯白：大量冷白 + 少量暖橙/冷蓝杂色；大颗粒带十字星芒；中心一团过曝辉光
- ambient 辉光层（全程恒定 `#23435F`）：

  ```css
  background: radial-gradient(ellipse farthest-corner at center, transparent 0%,
    color-mix(in srgb, var(--ambient) 6.25%, transparent) 25%,
    color-mix(in srgb, var(--ambient) 25%, transparent) 50%,
    color-mix(in srgb, var(--ambient) 56.25%, transparent) 75%,
    var(--ambient) 100%);
  mix-blend-mode: plus-lighter;
  opacity: .55;                 /* 5.5s ease-out 淡入 */
  ```

- 暗角：`radial-gradient(circle, transparent 47%, rgba(0,0,0,.18) 72%, rgba(0,0,0,.78) 100%)`
- `dragSurface`：整屏可拖，`cursor: grab/grabbing`，`touch-action: pan-y`，`:focus-visible` 有 outline
- replay 圆钮：2.25rem，`rgba(255,255,255,.15)`，右下 `.75rem`
- 左右钉字逐字母揭示：`translateX` + opacity，`cubic-bezier(.22, 1, .36, 1)`，交错 delay，
  `text-shadow: rgba(250,250,250,.08) 0 0 1.5rem`
- 滚动驱动 `--astra-title-parallax-y`、`--astra-copy-opacity`
- 降级完整：`prefers-reduced-motion` 停粒子/停视差/显线稿；无 WebGL 时 `[data-astra-static]`
  换预渲染 webp 静帧

**主动偏离原站一处**：原站 ambient 色全程恒定（只有一个产品要讲）。
本主题每座一个 ambient 色，5.5s 交叉淡入，年代越早越冷、越近越暖——有一生要讲。

## 技术路线

`THREE.Points`，单次 draw call，2–4 万粒子（移动端 12k / 桌面 30k）。
每个粒子三个 attribute：`aSymbol`（符号态位置）、`aStar`（星点态位置）、`aSeed`。
vertex shader 里 `mix(aSymbol, aStar, uProgress)` 再叠 curl noise 漂移。

**「先成符号，再散为星点」= 一个 uniform 从 0 走到 1**，不是两套系统。

星芒用程序生成的十字星芒 sprite 贴图 + additive blending，**不做后处理 bloom**：
省一整个 render pass，移动端不掉帧。

被否决的路线：

- CPU 补间（GSAP 每帧写 position attribute）：3 万粒子必卡，实际只能撑 3–5k，
  星云退化成稀疏点阵，出不来「尘」感
- Canvas2D：景深、星芒、辉光全得手画，2 万点必卡；等于换个东西做

依赖：`three@^0.170`、`gsap@^3.15` 均已在 `package.json`，**不新增依赖**。

## 图层

```
z0  [fixed canvas]   THREE.Points 星云            唯一 WebGL 层
z1  [fixed div]      ambient 辉光 (plus-lighter)  色随星座变
z2  [fixed div]      暗角 vignette                静态
z3  [fixed button]   dragSurface 拖拽面
z4  [scroll]         正文 DOM（星座标题 + 记忆卡片）
z5  [fixed]          左右钉字、底部滚动提示、右下 replay
```

背景全程 `fixed`，正文滚过它——背景永不重排，长滚不抖。

## 数据

新增 `src/content/constellations.ts`，本主题唯一需要站主填写的文件：

```ts
export type Constellation = {
  id: string
  name: string      // 「求学」
  yearFrom: number  // 含
  yearTo: number    // 含
  symbol: string    // SVG path 的 d，描边
  ambient: string   // 该座辉光色
  blurb: string     // 一句话
}
```

星座区间必须互不重叠、按 `yearFrom` 升序；由自检强制。

星点不另填：`src/content/memories.ts` 的条目按 `year` 落进区间自动归座。
加一条记忆，对应星座就多一颗星，不碰特效代码——沿用现有「内容与特效解耦」。

`memories.ts` 现有形状（复用，不改）：

```ts
type Memory = {
  id?: string
  year: number
  kind: 'milestone' | 'moment'
  title: string
  story: string[]
}
```

`id` 在 `memories.ts` 里是可选字段。本主题的确定性布局依赖它，
因此缺 `id` 的记忆按 `` `${year}-${title}` `` 兜底成键，同样确定性。

**符号 → 点云**：把 SVG path 画进离屏 canvas，按 alpha 拒绝采样取 N 个点。
一条代码路径同时吃描边与填充、吃任何 SVG。不用按路径长度取点——那只能处理描边，且拐角堆点。

**星点布局**：一条记忆一颗星。位置由 `id` 哈希决定（确定性，刷新不变），
落在该座包围体内；`kind: 'milestone'` 半径 ×2、更亮。
连线**按年份顺序连成折线**（不是最小生成树）：一年连一年，线即时间，代码也少一半。
用 `LineSegments` + additive，低透明度。

**粒子分配**：

- 符号态：全部 N 个粒子 = 符号采样点
- 星点态：粒子按星均分，每颗星吸走 `N / 星数` 个粒子聚成高斯小球，余量作尘散开

粒子有 z 向厚度——拖拽旋转时看得出是体积而非贴片。

## 滚动编排

**开场（第 0 屏）**：名字钉左右边缘垂直居中，逐字母揭示
（`cubic-bezier(.22, 1, .36, 1)` + 交错 delay）。
中间是**全部记忆一起的总星云**，未分座——先看一生的全貌，往下滚才拆。

**每座一节，高度 200vh**：

| 节内进度 | 粒子 | DOM |
|---|---|---|
| 0 → .35 | 上一座溃散，汇聚成本座符号 | 标题淡入 |
| .35 → .55 | 符号稳住 | 星座名 + 一句话 |
| .55 → .85 | `uProgress` 0→1，符号塌成星点，连线依次亮起 | 记忆卡片逐条浮现 |
| .85 → 1 | 星座整体后退变暗 | 卡片淡出 |

ambient 色在 `.35` 处开始向本座色交叉淡入，5.5s，`plus-lighter`。

## 交互

- **拖拽**：整屏 `dragSurface` 旋转整片点云。y 轴自由，x 轴夹在 ±35°。
  `touch-action: pan-y`——移动端横拖旋转、竖划照常滚页，不抢滚动。
- **键盘**：`dragSurface` 可聚焦，方向键旋转，`:focus-visible` 有 outline。
  （源站只有 drag；补键盘是为了跟站上其余四个主题的 roving focus 惯例一致。）
- **replay**：右下圆钮重播当前星座成形。规格照搬源站。

## 排版（零新依赖）

- 星座名 → 已装的 **Noto Serif SC**。宋体尖横粗竖与锐利星芒同构。
  不用深渊那套霞鹜文楷——手写楷是日记的温度，真空里不该有温度。
- 名字大字 / 年份 / 坐标 → 已装的 **Fragment Mono**，宽字距，像天文台仪表读数。
- 底色 `#000`。正文永远在 DOM 层；对比度不因发光感妥协。

## 降级

- `prefers-reduced-motion` 或无 WebGL 上下文：用同一份星点坐标渲染成 DOM 里的
  SVG 圆点 + 折线。位置数据本就算好，**零美术资产**——不像源站还要预渲染 webp 静帧。
- 静态分支下拖拽与 replay 关闭，星座标题与记忆卡片全部直接可读。

## 性能闸

- DPR 上限 2
- 粒子数按设备分档：移动 12k / 桌面 30k
- 标签页隐藏或 canvas 离屏时停 rAF

三条缺一，长滚页在移动端会烧电发烫。

## 文件

```
starmap.html                    新增 vite rollupOptions.input 条目
src/starmap/main.ts             滚动编排、拖拽、replay、降级分支
src/starmap/nebula.ts           THREE.Points + GLSL，唯一碰 WebGL 的文件
src/starmap/sample.ts           纯函数：SVG→点云采样、星点布局、按年归座
src/starmap/sample.check.ts     assert 自检
src/starmap/style.css
src/content/constellations.ts   站主填写
```

`sample.ts` 全纯函数、不碰 DOM 不碰 three——成形逻辑可单独测，
`nebula.ts` 只负责把坐标喂 GPU。

例外：SVG→点云采样需要一个 canvas 光栅化。`sample.ts` 接收一个
`(width, height) => CanvasLike` 工厂参数，浏览器传 `OffscreenCanvas`，
自检传 `node:canvas` 或一个手写的 alpha 位图桩——函数本身仍不引用全局 DOM。

其余四个主题页加入本主题的互链。

## 自检

`sample.check.ts` 与 piano 现有四个 `*.check.ts` 并列，加进 `build` script：

- 采样点数量正确，且全部落在 alpha > 0 区域内
- 同一个 `id` 两次布局坐标完全一致（确定性哈希）
- 缺 `id` 的记忆走 `` `${year}-${title}` `` 兜底键，同样两次一致
- 记忆按 `year` 正确归座
- 星座区间互不重叠且按 `yearFrom` 升序，否则报错
- 某座区间内一条记忆都没有 → 报错，而不是画一个空星座

外加 `tsc --noEmit` 与 `vite build` 全通过。

## 验收样张流程（本次改动）

站主铁律是整幅样张逐张认可后才实现。前四个主题的样张是 AI 生成的动画帧（插画）；
本主题不是插画，是程序化图形——**AI 出的图给不出真实的粒子密度、星芒形状、塌陷手感，
认可了也做不出来**。

改为：先写一个能跑的一次性原型（单文件 HTML，硬编码假数据），跑出三态截图逐张认可：

1. 开场：总星云 + 名字钉左右
2. 符号态：某座符号成形
3. 星点态：塌成星座 + 连线 + 卡片

认可后原型丢弃，按本规格正式实现。
原型是探针不是资产——这一步的产出是三张截图和站主的「行/不行」，不是代码。

## 不做（YAGNI）

- 后处理 bloom（星芒 sprite 已够，省一个 pass）
- 预渲染静帧 webp（降级用 SVG，零资产）
- 最小生成树连线（按年份折线更少代码且更有意义）
- 星座之间的转场特效（塌陷/汇聚本身就是转场）
