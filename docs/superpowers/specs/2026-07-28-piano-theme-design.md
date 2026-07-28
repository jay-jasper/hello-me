# 第四主题 · 「琴」Piano — 设计规格

日期：2026-07-28
入口：`piano.html` → `src/piano/`
状态：设计已确认，待写实施计划

---

## 1. 目的与成功标准

一台可以真的弹的钢琴。访客一进来按任意键，页面随机弹起一首原创日系抒情小品；每个音符在水面上激起一圈涟漪，和弦的波纹互相干涉成花纹；曲子走到乐句交界处，对应那个人生时期的一条记忆从水下浮上来。

与站点主旨一致：**这不是一个钢琴玩具，是用音乐讲一生。** 三首曲子各绑一个人生时期。

成功标准：

- 访客愿意听完至少一首，并且中途忍不住自己按几个键
- 站主往 `src/content/memories.ts` 添记忆后，只需在 `score.ts` 里加一个锚点就能挂上去，不碰任何特效代码
- 关掉 WebGL、开着 reduced-motion、或音频加载失败时，页面仍然完整可用

## 2. 选型

| 层 | 选型 | 理由 |
|---|---|---|
| 音频引擎 | **Tone.js** | `Tone.Sampler` 处理音高映射/变速/release 尾音，`Transport` + `Part` 提供 look-ahead 调度。音符级同步一旦时钟对不齐，特效会飘、听感会抖，而这正是 Tone 已解决的部分。代价约 40 KB gz |
| 音源 | **Salamander Grand Piano 子集**（CC-BY 3.0） | 每小三度取一个样本（约 15 个），转 webm/opus，其余音高实时变速。总体 1–2 MB。**须在页面底部署名** |
| 曲目 | **全原创**，日系抒情 / 忧郁向 | 零版权风险；三首对应三个人生时期的情绪 |
| 水面 | **WebGL 单 shader**（降级 Canvas 2D） | 活跃涟漪以 uniform 数组传入，片元里解析式叠加同心波。波纹相交处自然干涉——和弦在画面上的表达。ping-pong 波动方程模拟代价过高，不采用 |
| 键盘 | **完整 88 键**，电脑键盘映射中央两个八度 | 视觉壮观且好上手；自动演奏时任何音高都有键可亮 |

## 3. 架构

```
src/piano/
  score.ts        纯数据 + 纯函数：3 首曲子的音符与锚点。零依赖
  score.check.ts  node 直接跑的校验脚本
  instrument.ts   音源：包住 Tone.Sampler，只暴露 attack / release / ready
  player.ts       演出调度：吃一个 Piece，吐 onNote / onAnchor / onEnd。不认识 DOM
  keyboard.ts     88 键：绘制、midi↔键位、指针与电脑键盘输入，吐 onUserNote
  water.ts        水面：只有 splash(x01, vel) / resize / start / stop。不认识 midi
  reveal.ts       浮字层：按 memoryId 取记忆文本，浮出→停留→沉下
  main.ts         唯一的装配层
  style.css
  assets/         采样文件
```

数据流：

```
用户按键 ──────────────┐
                       ├─→ instrument.attack ─→ 声音
player 的 onNote ──────┘         │
                                 └─→ keyboard.flash + water.splash
player 的 onAnchor ──────────────────→ reveal.show(memoryId)
```

**边界铁律：water 不知道音乐，player 不知道画面，instrument 不知道曲子。** 三者可独立理解、独立替换——将来把水面换成波动方程模拟，只要还提供 `splash(x01, vel)`，其它文件一行不改。

`vite.config.ts` 加第四个入口 `piano`。

## 4. 数据结构

```ts
// src/piano/score.ts
export type Note = {
  midi: number   // 21–108，即 A0–C8
  t: number      // 起始秒，曲首为 0
  d: number      // 持续秒
  v: number      // 力度 0–1
}
export type Anchor = { t: number; memory: string }   // memory = 记忆 id
export type Piece = {
  id: string
  title: string     // 中文曲名
  latin: string     // 拉丁副标，用作水面深处的巨型水印
  mood: string      // 一句情绪注解，开场与左上角显示
  duration: number  // 秒；check 脚本校验其与末音符一致
  notes: Note[]
  anchors: Anchor[]
}
```

**记忆引用**：给 `src/content/memories.ts` 的 `Memory` 加可选字段 `id?: string`。不填 id 的记忆在其它三个主题里行为不变，只是钢琴主题引用不到。`score.check.ts` 校验每个 anchor 的 id 真实存在，避免改动记忆文件后钢琴主题静默失效。

id 命名约定：`<年份>-<两三个字的短名>`，例如 `2006-first-pc`、`2016-first-code`。全小写、连字符分隔、全站唯一。

**曲子与记忆的分段规则**（决定哪条记忆归哪首曲，避免"绑最早的几条"这种含糊）：按记忆年份切三段——**晨窗** 取 `year ≤ 出生年 + 18`，**雨落** 取 `出生年 + 18 < year ≤ 出生年 + 28`，**远山** 取 `year > 出生年 + 28`。出生年读 `src/config.ts` 的 `birthYear`。锚点在 `score.ts` 里仍是显式写死的 id 列表（不做运行时自动挑选），上述规则只是写锚点时的取材依据，并由 `score.check.ts` 校验所引记忆确实落在本曲的年份区间内。

**音符怎么写出来**：不手敲几千个数字。`score.ts` 内提供纯函数——`arp(chord, pattern, bar)` 展开分解和弦、`mel('e4 g4 a4 …', rhythm)` 把音名串转音符——每首曲子由「和声进行 + 旋律动机 + 织体模式」三行数据生成。可读、可微调，且这些函数本身可单测。

## 5. 曲目

| 曲 | 调性与织体 | 情绪 | 长度 | 锚点 |
|---|---|---|---|---|
| 晨窗 / *Morning Window* | C 大调，右手单音动机 + 左手分解九和弦，王道进行 Ⅳ–Ⅴ–iii–vi | 童年，明亮但已带回望感 | ~90 s | 3 个，绑最早的几条记忆 |
| 雨落 / *Rainfall* | A 小调，持续八分音型如雨，中段转平行大调后落回 | 青年，忧郁 | ~100 s | 4 个，绑中间时期 |
| 远山 / *Distant Hills* | D 大调，左手空五度铺底，右手长音旋律 | 此刻，开阔、释然 | ~110 s | 3 个，绑近年记忆 |

## 6. 画面与交互

**版面（桌面）**：上 6 成水面，下 4 成 88 键钢琴（轻微透视，不做立体贴图）。左上角曲名 + 情绪注解 + 极细进度线；右下角暂停 / 下一首 / 音量；底部一行 Salamander CC-BY 署名。水面深处压巨型拉丁曲名水印——沿用「炽热」主题手法，保持三个主题的家族感。

**开场**：黑场里一台静止的钢琴，中央「按任意键 · 开始」。首个手势解锁 AudioContext → 下载采样（进度即水面上一圈缓慢扩大的涟漪，加载完波纹散开）→ 随机抽第一首。

**播放机制**：三首随机不重复连播，播完一轮重新洗牌。右下角可暂停 / 跳下一首。

**水面 shader**：uniform 数组存最多 48 个活跃涟漪 `vec4(x位置, 起始时间, 振幅, 衰减)`。片元对每个涟漪计算

```
sin(k · (dist − c · age)) · exp(−decay · age) / (1 + dist · 6)
```

叠成高度场，用梯度做伪法线，混冷色环境光与一道高光。**低音 = 长波长、慢衰减、偏深蓝；高音 = 短波长、快衰减、偏青白**——「听见低音」与「看见长波」是同一件事，和弦的干涉花纹就是和声本身。超过 48 个同时音符时踢掉最旧的。

**同步细节**：音符事件提前约 80 ms 通知画面，使琴键在发声那一刻恰好压到底，避免声音先到、键后动。实现方式：`Tone.Part` 的回调里拿到该音符的精确发声时刻 `time`（AudioContext 时间轴），把发声交给 `instrument.attack(midi, vel, time)`，同时用 `Tone.Draw.schedule(fn, time - 0.08)` 把视觉回调排到发声前 80 ms 的下一帧。画面因此不依赖 rAF 与音频时钟的自然对齐。

**你弹 vs 曲子弹**：用户按下的音，涟漪多一圈金边以示区分。弹奏不打断演奏（可合奏）；连弹 8 个音后曲子音量降 6 dB 让路，停手 4 秒恢复。

**浮字**：锚点到达时记忆从水下浮上、停 6 秒、沉下；同一时刻只有一条。文字在场时水面整体亮度降 35%，保证正文对比度 ≥ 4.5:1（`PRODUCT.md` 的可读性底线）。

**键位**：`A S D F G H J K` 白键、`W E T Y U` 黑键、`←/→` 移八度、`空格` 暂停、`N` 下一首。

## 7. 降级矩阵

| 环境 | 行为 |
|---|---|
| 无 WebGL | `water.ts` 内部切 Canvas 2D 圆环实现，`splash()` 接口不变，其余文件零改动 |
| `prefers-reduced-motion` | 涟漪不扩散，改为原地柔光晕淡入淡出；琴键只变色不位移；浮字直接淡入不上浮 |
| 音频不可用 / 采样加载失败 | 静音模式：特效仍按时间轴走完整曲目，顶部显示「音频不可用，仍可观看」 |
| 移动端 | 水面占比降到 5 成；琴键改为可横向拖动的键盘条（一屏约两个八度）；涟漪上限 24，半分辨率渲染；采样取更稀疏子集 |
| 无 JS | `<noscript>` 列出三首曲子的标题与其绑定记忆的全文 |

## 8. 错误处理

- 单个采样文件失败 → 该音区回退到邻近采样变速，不整体失败
- 采样加载超时 8 s → 转静音模式
- 页面切后台、AudioContext 被挂起 → 暂停 Transport 与 rAF；回前台从原位置继续，不跳音
- `score.check.ts` 失败 → 构建前置步骤直接报错，不允许带着坏数据构建

## 9. 性能预算

- 首屏 JS ≤ 60 KB gz（Tone 约 40 + 本主题约 15）
- 采样 ≤ 2 MB，且**在开场手势之后才下载**，首屏不背这 2 MB
- shader 每帧最多 48 次循环，1080p 60 fps；移动端上限 24 且半分辨率渲染

## 10. 无障碍

- 琴键 Tab 可达、方向键移动、Enter 发声、焦点有可见光环
- 每键 `aria-label="C4"`，钢琴容器 `role="group"`
- 浮字是真实 DOM 文本 + `aria-live="polite"`，屏幕阅读器能读到——不画在 canvas 里
- 正文对比度 ≥ 4.5:1，文字在场时水面自动压暗

## 11. 测试

**`src/piano/score.check.ts`**（沿用 `src/journey/acts.check.ts` 的做法。本机 Node v22.23 已默认支持类型剥离，`node src/piano/score.check.ts` 可直接跑 TS；`package.json` 的 `build` 脚本改为 `node src/piano/score.check.ts && tsc --noEmit && vite build`，并在 `tsconfig.json` 的 `exclude` 里追加该文件）：

- 音高落在 21–108
- 时长非负，音符不超出 `duration`
- 锚点落在曲长内
- 锚点引用的 memory id 在 `src/content/memories.ts` 中真实存在
- `duration` 与末音符结束时间一致

**纯函数单测**：`arp` / `mel` 的输出、midi ↔ 键位几何映射。

**人工验收清单**：

1. 三首各完整听一遍，无爆音、无节奏抖动
2. 演奏中连续弹奏，不掉帧、曲子正确让路并恢复
3. 切后台再回前台，不跳音、不错位
4. 禁用 WebGL 后降级正常
5. 开启 reduced-motion 后无扩散动画且内容完整
6. 移动端可拖动键盘、可发声
7. 屏幕阅读器能读到浮出的记忆文字

## 12. 不做（YAGNI）

- 不做录制 / 回放用户演奏
- 不做 MIDI 设备接入
- 不做乐谱显示
- 不做音色切换（只有一台三角钢琴）
- 不做真实水面反射贴图与波动方程模拟
