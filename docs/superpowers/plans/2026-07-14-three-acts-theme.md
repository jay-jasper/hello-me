# 旅路三幕主题实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 spec（docs/superpowers/specs/2026-07-14-three-acts-theme-design.md）：三张已认可动画帧交叉渐变的三幕人生主题。

**Architecture:** `journey.html` 第二入口。三幅全屏帧图叠放，滚动驱动透明度交叉渐变 + Ken Burns；记忆光点 DOM 按钮 + `<dialog>` 纸面面板；Canvas 2D 粒子层。纯逻辑独立 `acts.ts` 可 node 自检。

**Tech Stack:** Vite 多页、TypeScript、Canvas 2D（无 three.js）、@fontsource/noto-serif-sc、@fontsource/eb-garamond。

## Global Constraints（spec 逐字）

- 三张样张原图直接用（转 WebP q82，单张 ≤ 500KB），不重生成不改图；禁分层拼贴、禁角色贴图动画、禁视差。
- 色 token：`--act1: oklch(0.92 0.05 75)`、`--act2: oklch(0.75 0.12 55)`、`--act3: oklch(0.22 0.05 265)`、强调 `oklch(0.75 0.14 55)`、纸 `oklch(0.96 0.012 90)`、墨 `oklch(0.25 0.02 60)`。
- 总高约 9 屏；幕间交叉渐变带 ≈ 1 屏；Ken Burns scale 1.02→1.07。
- 粒子 ≤ 400、DPR ≤ 2、移动端减半；流星 3~6s 一颗。
- 面板 38em / 行高 1.9；序章 display ≤ 4rem；夜段文字对比 ≥ 7:1，序章文字 ≥ 4.5:1（纸色衬底）。
- reduced-motion：关 Ken Burns 与粒子，仅透明度淡变。
- 记忆分幕：year ≤ birthYear+22 → 第一幕，否则第二幕；各幕 ≥1（不满足时移动阈值）。

## Tasks

### Task 1: 素材 + 脚手架
- Create: `src/journey/assets/act-{1,2,3}.webp`（PIL 转换样张）、`journey.html`、`src/journey/style.css`（token/字体/骨架）、`src/journey/main.ts`（骨架渲染序章/三幕 section/终点）
- Modify: `vite.config.ts`（双入口）、`tsconfig.json`（vite/client + exclude acts.check.ts）、`index.html`（角落入口）
- 验证：build 两入口；/journey.html 语义内容可读。Commit `feat(journey): scaffold`

### Task 2: acts.ts 纯逻辑 + 自检
- Produces:
  - `layout(memories, birthYear): Slot[]`——每条记忆的触发进度（避开渐变带，幕内均布）
  - `frameOpacity(act: 1|2|3, progress): number`——三帧透明度（渐变带线性过渡，任意进度和为 1±ε）
  - `kenBurns(act, progress): {scale, tx, ty}`——幕内 1.02→1.07
  - `actAt(progress): 1|2|3`、`yearAt(progress, slots, birthYear, nowYear)`（分段线性、单调）
- 自检 `acts.check.ts`：先失败后过。Commit `feat(journey): acts pure logic`

### Task 3: 场景装配
- 三个 `.frame` 全屏 div（webp 背景，cover + 焦点位），滚动循环（lerp 0.08）驱动透明度/Ken Burns/页面底色插值。
- 序章文字叠第一幕天空，首滚淡出；终点（第三幕）此刻文案 + 篝火旁社交链接 + 结语。
- 验证：滚动三幕渐变顺滑，无硬切。Commit `feat(journey): three-act crossfade scene`

### Task 4: 记忆光点 + 面板 + HUD
- 每幕锚位表（比例坐标沿路排布），光点 `<button>` 暖光晕 + 年份小签；靠近亮起（同屏一处）；`<dialog>` 纸面面板；Tab 聚焦自动滚动；HUD 年份。
- 验证：鼠标 + 键盘全走一遍。Commit `feat(journey): memory lights and panels`

### Task 5: 粒子层
- Canvas 2D：蒲公英絮/金尘/流星+火星+星闪，密度随幕透明度过渡。
- 验证：三幕粒子形态、帧率。Commit `feat(journey): particle layer`

### Task 6: a11y、降级、移动端、收尾
- reduced-motion、skip link、noscript、移动端 cover 焦点位与粒子减半；构图/对比度截图抽查；build + 自检全过。
- Commit `feat(journey): a11y and fallbacks`，合回 main。

## Self-Review

- Spec 覆盖：定位/结构（T1/T3）、记忆面板（T4）、粒子（T5）、版式色彩（T1/T3）、可访问性移动端（T6）、工程素材（T1/T2）。无缺口。
- 命名一致：`frameOpacity/kenBurns/actAt/yearAt/layout` 全文统一。无占位符。
