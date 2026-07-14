# 旧路 / The Long Road 主题实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 spec（docs/superpowers/specs/2026-07-14-long-road-theme-design.md）的芙莉莲风独立主题：纵向滚动=沿路前行，晨→夜时刻流转，蓝月草记忆花丛，WebGL 粒子层，终点流星。

**Architecture:** Vite 第二入口 `road.html`。2D 分层视差（DOM/SVG/CSS）为画面底，three.js 单 Points 粒子层叠加。纯逻辑（进度→时刻插值、年份→路程映射）抽离 `journey.ts` 可独立自检。内容复用 `src/content/memories.ts` 与 `src/config.ts`，不 import 深海站模块（`src/scene.ts`、`src/main.ts`、`src/style.css` 禁触）。

**Tech Stack:** Vite 6 多页、TypeScript、three.js（仅粒子层）、@fontsource/noto-serif-sc、@fontsource/eb-garamond。无测试框架——纯逻辑用 Node 22 原生跑 TS 自检（`node src/road/journey.check.ts`）。

## Global Constraints（spec 逐字）

- 色板 token 逐字用 spec 值：`--dawn-sky: oklch(0.90 0.04 60)`、`--day-sky: oklch(0.87 0.05 230)`、`--dusk-sky: oklch(0.80 0.09 60)`、`--night-sky: oklch(0.26 0.04 265)`、`--meadow-day: oklch(0.74 0.07 125)`、`--meadow-dusk: oklch(0.55 0.07 80)`、`--meadow-night: oklch(0.28 0.04 260)`、`--bluemoon: oklch(0.80 0.09 285)`、`--paper: oklch(0.96 0.012 90)`、`--ink-on-paper: oklch(0.25 0.02 60)`。
- 构图五律：地平线在画面下 1/3；云白昼为主角；旅人剪影 ≤ 视口高 8% 且在下 1/3；同屏最多一处花丛；黄昏段旅人与树为剪影。
- 空气透视：远景层颜色向当前天空色混 25~35%。
- 动效：滚动 lerp 0.08；花丛盛开 500ms ease-out-quart；面板展开 400ms / 收起 300ms；无弹跳缓动。
- 预算：粒子 ≤ 2000，DPR ≤ 2，移动端粒子减半、关流星拖尾。
- 版式：正文测量 ≤ 38em、行高 1.9、级差 1.25、display ≤ 4.5rem、标题字距 +0.05em。
- 对比度：纸面墨字 ≈ 12:1；场景文字任意时刻 ≥ 4.5:1；夜段结语 `--paper` 色 ≥ 7:1。
- prefers-reduced-motion：无视差平移无粒子漂移，静态分层 + 交叉淡入，流星改定格星空。
- WebGL 不可用：省略粒子层，内容完整。
- 禁令：禁写实 3D、禁描边线稿、禁灰暗滤镜、禁模板 portfolio 语法、禁鲜艳饱和色。

## 文件结构

| 文件 | 职责 |
|---|---|
| `road.html` | 第二入口：语义骨架（序章/记忆带 sections/终点）+ 舞台容器 |
| `src/road/journey.ts` | 纯逻辑：时刻色插值、year→progress 映射、视差偏移。零 DOM 依赖 |
| `src/road/journey.check.ts` | journey.ts 的 assert 自检（node 直接跑） |
| `src/road/style.css` | 主题全部样式：token、字体、版式、层、面板、HUD、reduced-motion/移动端分支 |
| `src/road/scenery.ts` | 2D 分层：天空/云/远山/原野/路面/近景草 + 旅人剪影 + 云影，滚动驱动与着色 |
| `src/road/flowers.ts` | 蓝月草花丛：定位、盛开、纸面面板、键盘导航、年份路标 HUD |
| `src/road/particles.ts` | three.js 粒子层：四路段形态、风向、流星；WebGL 检测 |
| `src/road/main.ts` | 装配：滚动驱动循环、签名时刻编排、模块接线 |
| `vite.config.ts`（改） | 多页 input |
| `index.html`（改） | 加一个不显眼的「旧路」入口链接 |

---

### Task 1: 脚手架——第二入口 + 字体 + token

**Files:**
- Create: `road.html`, `src/road/style.css`, `src/road/main.ts`（骨架）
- Modify: `vite.config.ts`, `package.json`（devDependencies）

**Interfaces:**
- Produces: `road.html` 的 DOM 骨架 id：`#stage`（舞台）、`#journey`（语义内容：`section#prologue`、`section.memory[data-year]`×N、`section#terminus`）、`#hud`。CSS token 名见 Global Constraints。

- [ ] **Step 1: 装字体依赖**

```bash
npm i -D @fontsource/noto-serif-sc @fontsource/eb-garamond
```

- [ ] **Step 2: vite.config.ts 多页**

```ts
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        road: resolve(__dirname, 'road.html'),
      },
    },
  },
})
```

- [ ] **Step 3: road.html 骨架**：`<main id="journey">` 内为语义 sections（序章含 `config.site.name`/`tagline` 占位由 main.ts 填充；每条记忆一个 `<section class="memory">`；终点含 now/路牌/结语容器）；`<div id="stage" aria-hidden="true">`（视差层挂载点）；`<aside id="hud">`。滚动高度由 main.ts 按记忆数设定。

- [ ] **Step 4: style.css 写入全部 token（逐字 spec 值）+ 字体引入 + 纸纹颗粒 overlay（SVG feTurbulence data-URI，opacity 0.03）+ 版式标尺**。

- [ ] **Step 5: main.ts 骨架**：import 字体 css、style.css、`site`、`memories`，渲染语义内容（含按 year 升序排列——旧路是出生→当下，与深海站相反）。

- [ ] **Step 6: 验证**

Run: `npm run dev` 后访问 `/road.html`
Expected: 语义内容可读（无样式崩坏），控制台无错误。
Run: `npm run build`
Expected: 两个入口都出现在 dist。

- [ ] **Step 7: Commit** `feat(road): scaffold second entry with tokens and fonts`

---

### Task 2: journey.ts 纯逻辑 + 自检

**Files:**
- Create: `src/road/journey.ts`, `src/road/journey.check.ts`

**Interfaces:**
- Produces:
  - `type Oklch = { l: number; c: number; h: number }`
  - `skyAt(progress: number): Oklch`、`meadowAt(progress: number): Oklch`——四停靠点（0 晨 / 0.35 昼 / 0.7 黄昏 / 1 夜）间线性插值（色相走最短弧）。
  - `oklchCss(c: Oklch): string` → `"oklch(0.87 0.05 230)"` 格式。
  - `hazeMix(base: Oklch, sky: Oklch, amount: number): Oklch`——空气透视混色。
  - `progressForYear(year: number, birthYear: number, nowYear: number): number`——年份→路程（0.08~0.88 区间，序章/终点留白）。
  - `phaseAt(progress: number): 'dawn' | 'day' | 'dusk' | 'night'`（边界 0.2 / 0.55 / 0.85）。

- [ ] **Step 1: 先写 journey.check.ts（失败态）**

```ts
import assert from 'node:assert'
import { skyAt, meadowAt, oklchCss, hazeMix, progressForYear, phaseAt } from './journey.ts'

// 停靠点端值精确命中 spec token
assert.deepEqual(skyAt(0), { l: 0.90, c: 0.04, h: 60 })
assert.deepEqual(skyAt(1), { l: 0.26, c: 0.04, h: 265 })
assert.deepEqual(meadowAt(0.35), { l: 0.74, c: 0.07, h: 125 })
// 插值单调且在界内
const mid = skyAt(0.5)
assert.ok(mid.l < 0.87 && mid.l > 0.26)
// css 输出
assert.equal(oklchCss({ l: 0.9, c: 0.04, h: 60 }), 'oklch(0.9 0.04 60)')
// 雾色：amount=1 即天空色
assert.deepEqual(hazeMix({ l: 0.5, c: 0.1, h: 100 }, { l: 0.9, c: 0.04, h: 60 }, 1).l, 0.9)
// 年份映射：出生=0.08，今年=0.88，单调
assert.equal(progressForYear(1994, 1994, 2026), 0.08)
assert.equal(progressForYear(2026, 1994, 2026), 0.88)
assert.ok(progressForYear(2010, 1994, 2026) < progressForYear(2020, 1994, 2026))
// 路段
assert.equal(phaseAt(0.1), 'dawn'); assert.equal(phaseAt(0.4), 'day')
assert.equal(phaseAt(0.7), 'dusk'); assert.equal(phaseAt(0.9), 'night')
console.log('journey ok')
```

- [ ] **Step 2: 跑，确认失败**

Run: `node src/road/journey.check.ts`
Expected: FAIL（journey.ts 不存在）。

- [ ] **Step 3: 实现 journey.ts**（停靠点数组 + 分段线性插值；色相最短弧：差 >180 时绕行；晨昼段色相 60→230 走短弧即直插）。

- [ ] **Step 4: 跑到过**

Run: `node src/road/journey.check.ts`
Expected: `journey ok`

- [ ] **Step 5: Commit** `feat(road): journey pure logic with self-check`

---

### Task 3: scenery.ts 2D 分层 + 滚动驱动

**Files:**
- Create: `src/road/scenery.ts`
- Modify: `src/road/main.ts`（接线滚动循环）, `src/road/style.css`（层样式）

**Interfaces:**
- Consumes: journey.ts 全部导出。
- Produces: `createScenery(stage: HTMLElement): Scenery`，`Scenery.update(progress: number, velocity: number): void`——每帧调用，负责：五层 translateX（速率 0.05/0.15/0.4/1.0/1.6）、天空/原野着色、远山/树向天空色 hazeMix(0.25~0.35)、云影暗斑缓移、黄昏段旅人与树切剪影色。

- [ ] **Step 1: 生成五层**：天空（双 stop 渐变 div）、远山（inline SVG 多边形两排，程序生成起伏）、原野（色块 + 稀疏树剪影 SVG）、路面（透视梯形路 + 花丛挂载槽）、近景草（SVG 草叶簇）。全部平涂 + `filter: blur(1px)` 级别柔边（禁描边）。地平线锁定视口 66% 高度处。
- [ ] **Step 2: 旅人剪影**：披风旅人 inline SVG（≤ 8vh），fixed 于左 1/3、地平线下；步行微摆（2 帧姿态切换，velocity>0 时）。
- [ ] **Step 3: main.ts 滚动循环**：`raf` 循环，`target = scrollY/(scrollHeight-innerHeight)`，`progress += (target-progress)*0.08`；驱动 scenery.update；页面总高 = (记忆数+3) × 100vh。
- [ ] **Step 4: 验证**：dev 打开，滚动看到行进 + 晨→夜流转 + 地平线不动摇；黄昏段剪影生效。build 过。
- [ ] **Step 5: Commit** `feat(road): parallax scenery with time-of-day drive`

---

### Task 4: flowers.ts 花丛、面板、HUD、键盘

**Files:**
- Create: `src/road/flowers.ts`
- Modify: `src/road/main.ts`, `src/road/style.css`

**Interfaces:**
- Consumes: `progressForYear`、`memories`、`site.birthYear`。
- Produces: `createFlowers(roadLayer: HTMLElement, opts): Flowers`，`Flowers.update(progress: number): void`（靠近中央盛开/离开收拢、HUD 年份 = 当前 progress 反解年份）。面板为 `<dialog>`（原生 Esc/焦点圈闭）。

- [ ] **Step 1: 花丛节点**：每条 memory 一丛，SVG 蓝月草 3 姿态取模轮换，按 `progressForYear` 定位在路面层横坐标；`<button>` 语义，aria-label = `${year} ${title}`。
- [ ] **Step 2: 盛开态**：进入视口中央 ±15% 时加 `.bloom`（500ms ease-out-quart 展瓣 + 浮现年份标题小签）；同屏只允许一丛 bloom（构图稀疏律）。
- [ ] **Step 3: 纸面面板**：`<dialog>` 纸色底 + 墨字 + 纸纹，标题行「YYYY · 标题」（年份 EB Garamond oldstyle），story 段落 38em/1.9；展开 400ms 收起 300ms；开启时 `#stage` 加 `.dimmed`（轻模糊降饱和）。
- [ ] **Step 4: 键盘**：花丛 button 天然 Tab 序；focus 时平滑滚动到其路程位置并 bloom；focus ring = 蓝月草色双层 box-shadow 光环。
- [ ] **Step 5: HUD 年份路标**：右下小路牌，EB Garamond `font-variant-numeric: oldstyle-nums`，显示反解年份；路过花丛短暂替换为其标题。
- [ ] **Step 6: 验证**：鼠标 + 纯键盘各走一遍全部记忆；Esc、点外部收起；对比度抽查（devtools）。
- [ ] **Step 7: Commit** `feat(road): bluemoon memory flowers with paper panels`

---

### Task 5: 序章与终点

**Files:**
- Modify: `src/road/main.ts`, `road.html`, `src/road/style.css`

**Interfaces:**
- Consumes: `site.name/tagline/now/socials`、`site.birthYear`。
- Produces: `#prologue`（晨曦 + 木路标：名字大字 + tagline + 「沿路而行 ↓」提示）、`#terminus`（now 段落 + 多向路牌 socials + 结语 + 旅人停步）。竖排旁白 2~3 句（`writing-mode: vertical-rl`，paper 色 60%，`aria-hidden`），分布在昼/黄昏留白处。

- [ ] **Step 1: 序章路标**：木牌 SVG + 名字（Noto Serif SC 600，≤4.5rem）+ tagline + 下行提示；文字墨色（晨曦浅底达标 4.5:1，不足则加半透明纸底签）。
- [ ] **Step 2: 终点**：夜空下 now 文案（paper 色）、路牌 socials（每牌一链接，hover 微亮 + 下划线浮现）、结语（spec 语气：路停在这里，流星落向没走的路）；旅人剪影行至此停步面向天空。
- [ ] **Step 3: 竖排旁白**：从 config 不新增字段——旁白写死在 road 主题内（主题文案属于主题），2~3 句宿命感短句。
- [ ] **Step 4: 验证**：首尾情绪节奏走查；键盘可达路牌。
- [ ] **Step 5: Commit** `feat(road): prologue signpost and night terminus`

---

### Task 6: particles.ts WebGL 粒子层 + 签名时刻

**Files:**
- Create: `src/road/particles.ts`
- Modify: `src/road/main.ts`

**Interfaces:**
- Consumes: `phaseAt(progress)`、velocity。
- Produces: `createParticles(canvas): Particles | null`（WebGL 不可用返回 null，调用方直接跳过）；`Particles.update(progress, velocity)`。单 Points ≤2000，attribute `kind` 区分形态，shader 按 kind/相位控制颜色尺寸；uniform `uWind` = -velocity 驱动横向掠过，静止回落慢漂。

- [ ] **Step 1: 粒子系统**：晨=暖白种子/雾尘、昼=花瓣草絮、黄昏=金尘 + 稀疏归鸟（大粒子远层）、夜=星（顶部固定渐显）+ 蓝月草辉光浮游。相位过渡时粒子颜色/透明度按 progress 插值，不硬切。
- [ ] **Step 2: 流星**：夜段（progress>0.85）触发流星拖尾（Line 或拉长 sprite，随机间隔 2~5s 一颗，划向行进方向前方）；移动端关拖尾保留星空。
- [ ] **Step 3: 签名时刻·启程**：首次滚动事件——序章路标文字 span 化逐字随风散去（transform + opacity stagger），风粒子速度脉冲一次。
- [ ] **Step 4: 签名时刻·终点流星**：首次抵达夜段时流星群密度前 3s 加倍（情绪落点），之后回落稀疏。
- [ ] **Step 5: 验证**：四路段粒子形态肉眼过；`chrome://` 关 WebGL（或强制 `createParticles` 返回 null）页面完整可用；帧率 devtools 抽查 ≥55fps。
- [ ] **Step 6: Commit** `feat(road): webgl particle layer with departure and meteor moments`

---

### Task 7: 可访问性、reduced-motion、移动端、入口互链

**Files:**
- Modify: `src/road/style.css`, `src/road/main.ts`, `src/road/scenery.ts`, `index.html`, `road.html`

- [ ] **Step 1: reduced-motion**：`matchMedia('(prefers-reduced-motion: reduce)')`——关 lerp 平滑（直接跟随）、关粒子漂移与流星（静态星空长曝：预散布星点 + 一道定格流星）、视差层不平移（静态分层构图）、花丛改透明度渐显、区段交叉淡入。
- [ ] **Step 2: 移动端（≤768px）**：层数减为 3（天空/原野/路面），近景草与归鸟删除，粒子减半，DPR ≤ 2 全局。
- [ ] **Step 3: 语义与 aria**：`#stage`、HUD 装饰部分 `aria-hidden`；sections 标题层级完整；`<html lang="zh-CN">`；跳转链接「跳到终点」供键盘用户速达。
- [ ] **Step 4: 互链**：index.html 深海站角落加不显眼「旧路 →」链接（muted 色小字）；road.html 序章角落「回到深海 →」。
- [ ] **Step 5: 验证**：devtools 模拟 reduced-motion + 375px 视口走全程；Tab 全站走一遍。
- [ ] **Step 6: Commit** `feat(road): a11y, reduced-motion, mobile, cross-links`

---

### Task 8: 构图校验与收尾

- [ ] **Step 1: 构图五律截图自查**：无头浏览器截 progress ≈ 0 / 0.35 / 0.7 / 1 四屏，逐条对照：地平线 66%、天空占比、旅人 ≤8vh、同屏一丛、黄昏剪影、色板灰调（吸色抽查 chroma ≤ spec 值）。
- [ ] **Step 2: 全量验证**

Run: `npm run build`
Expected: tsc 无错，两入口产物完整。
Run: `node src/road/journey.check.ts`
Expected: `journey ok`

- [ ] **Step 3: Commit**（若有修正）`fix(road): composition audit fixes`

## Self-Review 记录

- Spec 覆盖：定位/概念（Task 1、5）、IA（1、4、5）、色彩（1、2、3）、构图（3、8）、字体版式（1、4）、布局交互（3、4）、动效粒子（6）、组件（4、5）、可访问性降级（7）、工程边界（1、7）、禁令（3、8）。无缺口。
- 类型一致：`Scenery.update(progress, velocity)` / `Flowers.update(progress)` / `Particles.update(progress, velocity)` 命名统一；`progressForYear(year, birthYear, nowYear)` 全文一致。
- 无占位符。
