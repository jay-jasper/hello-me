# Astra 极光星云特效与个人网站主题设计规范 (Design Spec)

- **日期**：2026-09-07
- **主题**：Astra 极光流动星云 (Aurora Nebula) 视觉特效组件提取与个人网站主题
- **目标页面**：`astra.html`
- **复用组件**：`src/astra/effects/AstraNebula.ts`

---

## 1. 架构概述 (Architecture Overview)

本项目基于 **Three.js + 自定义 GLSL ShaderMaterial** 实现高性能、高沉浸感的极光星云流体特效。整个架构划分为：
1. **特效内核层 (`src/astra/effects/`)**：纯视图渲染，与业务逻辑和 DOM 解耦，提供规范且简洁的 TypeScript API，可供任何项目或页面复用。
2. **主题表现层 (`astra.html`, `src/astra/`)**：基于 Astra 科技极客与宇宙探索风格构建的个人主页，包含 Hero 视窗、作品星图、思考日志与交互 Dock。
3. **数据分离层 (`src/astra/content/data.ts`)**：文字、项目、经历等纯数据存储，无需修改特效逻辑即可更新个人资料。

```
┌─────────────────────────────────────────────────────────────┐
│                         astra.html                          │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │               DOM 叙事层 (astra.css)                │   │
│   │  [Hero 视窗] -> [星体工坊] -> [跃迁日志] -> [Dock]  │   │
│   └──────────────────────────┬──────────────────────────┘   │
│                              │ 滚动/鼠标事件驱动            │
│                              ▼                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │          AstraNebula 控制器 (AstraNebula.ts)        │   │
│   └───────────────┬─────────────────────┬───────────────┘   │
│                   │                     │                   │
│                   ▼                     ▼                   │
│      ┌───────────────────────┐ ┌───────────────────────┐    │
│      │   极光流体着色器平面   │ │  星尘引力粒子系统   │    │
│      │   (aurora.frag/vert)  │ │     (particles.ts)    │    │
│      └───────────────────────┘ └───────────────────────┘    │
│                                                             │
│                      WebGL Canvas 画布                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 核心特效模块：`AstraNebula` API 规范

### 2.1 构造参数与类型
```typescript
export interface AstraNebulaOptions {
  canvas: HTMLCanvasElement;
  colors?: {
    primary?: string;     // 主色调：极光紫 (默认: #7952ff)
    secondary?: string;   // 辅色调：极光青 (默认: #00f0ff)
    accent?: string;      // 高光色：恒星金 (默认: #ffb86c)
    background?: string;  // 底色：深空黑 (默认: #06080e)
  };
  fluidSpeed?: number;    // 流体流动基准速率 (默认: 1.0)
  particleCount?: number; // 粒子数目 (默认: 1200)
  enableMouseInteraction?: boolean; // 是否开启鼠标引力与涟漪反馈 (默认: true)
  dprLimit?: number;      // 最大设备像素比限制 (默认: 2)
}
```

### 2.2 公共控制方法
- `setScrollProgress(progress: number): void`：根据页面当前滚动进度（0.0 ~ 1.0）动态插值流体演化阶段、旋转角与视点。
- `setColors(colors: Partial<AstraNebulaOptions['colors']>): void`：支持运行时动态平滑过渡色板。
- `setIntensity(intensity: number): void`：调整流体起伏扰动幅度与辉光强度。
- `resize(): void`：自动重新计算宽高比与着色器投影尺寸。
- `destroy(): void`：全面清理 WebGL 上下文、材质几何体、事件监听及动画帧循环。

---

## 3. 着色器实现与流体算法 (Shader & Fluid Mathematics)

1. **分形布朗运动 (FBM) & 域扭曲 (Domain Warping)**：
   - 采用多八度 Simplex 噪声叠合。
   - 使用第一层噪声扰动第二层纹理采样坐标：`q = fbm(uv + time)`, `r = fbm(uv + 4.0 * q + vec2(1.7, 9.2) + 0.15 * time)`。
   - 最终呈现类似 OpenAI Astra 具有流体卷曲、拉伸和粘滞感的极光渐变。
2. **色谱映射 (Color Gradient Ramp)**：
   - 混合因子由高度场 $H = \text{clamp}(r.x \cdot 2.0, 0.0, 1.0)$ 与噪声导数共同决定。
   - 在 `background -> primary -> secondary -> accent` 之间进行余弦平滑过渡，确保色彩纯净、无灰阶脏色。
3. **交互反馈 (Interactive Ripple & Vector Field)**：
   - 传入 Uniform 变量 `u_mouse` 与 `u_mouse_velocity`，在鼠标光标周围形成微型斥力波与旋转涡流。

---

## 4. 个人网站主题：`astra.html` 架构设计

### 4.1 视觉系统 (Design Tokens)
- **背景底色**：`#06080e`（极深冷空黑）。
- **玻璃拟态容器**：`rgba(14, 18, 28, 0.65)`，配备 `1px solid rgba(140, 160, 255, 0.15)` 微光边框与 `backdrop-filter: blur(16px)`。
- **字体规范**：
  - 代码/参数/年份：`Fragment Mono`
  - 标题与正文：`霞鹜文楷 LXGW WenKai Screen`、`EB Garamond`。

### 4.2 页面版块 (Sections)
1. **Header & 导航条**：
   - 呼应现有的多页面体系（深海下潜、旅路、炽热、琴、星图、极光）。
2. **Hero 观测台**：
   - 标题：`Lee · Astra 极光星云`
   - 标语：在流转星尘与数学秩序间，记录智能、代码与真实世界。
   - 仪表读数：动态展示时间戳、流体湍流系数与探测器坐标。
3. **Works 星体工坊 (Featured Projects)**：
   - 网格卡片展示：包含本项目的交互式作品（如钢琴声波、星空图鉴、深海记忆）及其他项目。
   - 卡片拥有鼠标光标靠近时的边缘光折射跟随动效。
4. **Log 跃迁日志 (Chronicle)**：
   - 极简时间轴/手记，记录关键技术洞见与人生节点。
5. **Dock 交互中枢 (Footer)**：
   - 社交链接（GitHub、Blog、Mail），支持无缝复制与跳转。

---

## 5. 性能、无障碍与工程配置

1. **减弱动态模式 (prefers-reduced-motion)**：
   - 当系统开启减弱动画时，着色器流动速度降为 0.1x，粒子不再跟随鼠标剧烈位移，保证视觉舒缓。
2. **能耗优化**：
   - 监听页面 `visibilitychange`，切入后台时暂停 `requestAnimationFrame`。
3. **构建打包 (`vite.config.ts`)**：
   - 在 `build.rollupOptions.input` 中注册 `astra: resolve(__dirname, 'astra.html')`，确保构建产物完整且可直接上线预览。
4. **验证命令**：
   - `npx tsc --noEmit`
   - `npm run build`
