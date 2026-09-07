# Astra 极光星云特效与个人网站主题 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建可复用的 Astra 极光星云流体特效（Three.js + GLSL），并在 `hello-me` 个人站点中构建专属的 `astra.html` 主题页面与数据分离层。

**Architecture:** 核心视觉层由 `AstraNebula` 类封装，在全屏透视/正交相机下渲染带有 FBM 域扭曲与色谱渐变的 `RawShaderMaterial` 平面，叠加 `THREE.Points` 星尘引力粒子；上层 DOM 采用沉浸式深空观测站视窗架构，包含 Hero 视窗、星体工坊卡片与跃迁日志。

**Tech Stack:** TypeScript, Three.js, Vite, GLSL (WebGL Shaders), HTML5/CSS3.

## Global Constraints

- 支持 `prefers-reduced-motion` 媒体查询，动态降速并平滑过渡。
- 保证移动端与桌面端自适应，DPR 限制不超过 2。
- 遵循数据分离，个人内容存储在 `src/astra/content/data.ts`。
- 遵循多页面配置，在 `vite.config.ts` 注册 `astra.html`，保证 `npm run build` 成功。

---

### Task 1: 着色器与流体数学模块 (Aurora Shaders)

**Files:**
- Create: `src/astra/effects/shaders/aurora.vert.ts`
- Create: `src/astra/effects/shaders/aurora.frag.ts`

**Interfaces:**
- Produces:
  - `auroraVertexShader: string`
  - `auroraFragmentShader: string` (包含 Uniforms: `u_time`, `u_resolution`, `u_mouse`, `u_scroll`, `u_color_bg`, `u_color_primary`, `u_color_secondary`, `u_color_accent`, `u_intensity`)

- [ ] **Step 1: 编写顶点着色器 `aurora.vert.ts`**
- [ ] **Step 2: 编写片段着色器 `aurora.frag.ts`（包含 FBM、域扭曲 Simplex 噪声与极光色谱余弦渐变）**
- [ ] **Step 3: 运行 TypeScript 类型检查确认无语法错误**
- [ ] **Step 4: Commit 顶点与片段着色器**

---

### Task 2: 星尘粒子与引力物理模拟 (Stardust Particles)

**Files:**
- Create: `src/astra/effects/particles.ts`

**Interfaces:**
- Produces:
  - `class AstraParticles`:
    - `constructor(count: number, scene: THREE.Scene)`
    - `update(time: number, mouse: THREE.Vector2, mouseVelocity: number): void`
    - `destroy(): void`

- [ ] **Step 1: 编写粒子位置、初速度、呼吸相位与渐变缓冲生成逻辑**
- [ ] **Step 2: 实现光标引力吸收、回弹阻尼物理模拟**
- [ ] **Step 3: 运行 TypeScript 类型检查**
- [ ] **Step 4: Commit 粒子模拟模块**

---

### Task 3: 核心特效引擎封装 (`AstraNebula.ts`)

**Files:**
- Create: `src/astra/effects/AstraNebula.ts`

**Interfaces:**
- Consumes: `aurora.vert.ts`, `aurora.frag.ts`, `particles.ts`
- Produces:
  - `export interface AstraNebulaOptions`
  - `export class AstraNebula`
    - `setScrollProgress(progress: number): void`
    - `setColors(colors: Partial<AstraNebulaOptions['colors']>): void`
    - `setIntensity(intensity: number): void`
    - `resize(): void`
    - `destroy(): void`

- [ ] **Step 1: 封装 Three.js WebGLRenderer、Scene、OrthographicCamera 与 Canvas 绑定**
- [ ] **Step 2: 组装极光 ShaderMesh 与粒子系统，配置动画循环与生命周期管理**
- [ ] **Step 3: 绑定事件监听与 ResizeObserver**
- [ ] **Step 4: 运行 TypeScript 类型检查**
- [ ] **Step 5: Commit 核心特效引擎**

---

### Task 4: 主题数据层与样式系统 (`data.ts` & `astra.css`)

**Files:**
- Create: `src/astra/content/data.ts`
- Create: `src/astra/astra.css`

**Interfaces:**
- Produces:
  - `export interface ProjectItem`, `export interface LogEntry`, `export interface AstraContent`
  - CSS 变量定义：`--astra-bg`, `--astra-primary`, `--astra-cyan`, `--astra-gold`, `--astra-card-bg` 等

- [ ] **Step 1: 编写个人主题数据 `data.ts`**
- [ ] **Step 2: 编写毛玻璃、星舰微光、HUD 仪器与流式排版样式 `astra.css`**
- [ ] **Step 3: Commit 数据与样式模块**

---

### Task 5: 页面结构与脚本交互集成 (`astra.html` & `src/astra/main.ts`)

**Files:**
- Create: `astra.html`
- Create: `src/astra/main.ts`
- Modify: `index.html` (添加极光入口导航)
- Modify: `vite.config.ts` (注册 astra 入口)

**Interfaces:**
- Consumes: `AstraNebula.ts`, `data.ts`, `astra.css`

- [ ] **Step 1: 创建 `astra.html` DOM 视窗骨架**
- [ ] **Step 2: 编写 `src/astra/main.ts` 实现数据动态渲染、滚动视差联动与鼠标交互**
- [ ] **Step 3: 更新 `index.html` 顶部固定导航，加入 “极光 →” 链接**
- [ ] **Step 4: 更新 `vite.config.ts` 打包配置**
- [ ] **Step 5: 运行 `npx tsc --noEmit` 与 `npm run build` 全面验证构建**
- [ ] **Step 6: Commit 页面与构建配置**
