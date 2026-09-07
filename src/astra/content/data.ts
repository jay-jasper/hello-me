export interface ProjectItem {
  id: string;
  title: string;
  category: string;
  description: string;
  tags: string[];
  link?: string;
  linkText?: string;
}

export interface LogEntry {
  epoch: string;
  title: string;
  content: string;
  coordinates: string;
}

export interface AstraContent {
  identity: {
    name: string;
    title: string;
    subheading: string;
    bio: string;
    metrics: { label: string; value: string }[];
  };
  projects: ProjectItem[];
  logs: LogEntry[];
  links: { name: string; url: string; note: string }[];
}

export const astraData: AstraContent = {
  identity: {
    name: 'Lee',
    title: '探寻智能疆界的工程师与创作者',
    subheading: 'AT THE CONVERGENCE OF AGENTIC SYSTEMS & VISUAL DYNAMICS',
    bio: '专注下一代 Agentic AI 交互、沉浸式生成图形与复杂软件工程。在星云流转与数学秩序间，编织具有生命力与真实触感的数字世界。',
    metrics: [
      { label: 'OBSERVATORY STATUS', value: 'NOMINAL · 60 FPS' },
      { label: 'ORBITAL FIELD', value: 'ASTRA AURORA V2' },
      { label: 'COORDINATES', value: '31.2304° N, 121.4737° E' },
    ],
  },
  projects: [
    {
      id: 'piano',
      title: 'Salamander 纯律琴房',
      category: 'AUDIO & WEBGL SYNTHESIS',
      description: '高精度采样三角钢琴，声波波纹与琴键发光交互，将音符具象化为空间荡漾的微光水纹。',
      tags: ['Tone.js', 'AudioContext', 'Interactive Canvas'],
      link: './piano.html',
      linkText: '进入琴房 →',
    },
    {
      id: 'starmap',
      title: '恒星记忆星图',
      category: 'CELESTIAL 3D MAPPING',
      description: '基于 Three.js 的三维空间恒星观测仪，将思维与灵感碎片映射为银河中的引力星团。',
      tags: ['Three.js', '3D Coordinates', 'Raycasting'],
      link: './starmap.html',
      linkText: '观测星图 →',
    },
    {
      id: 'descent',
      title: '深渊下潜 (The Descent)',
      category: 'NARRATIVE EXPERIENCE',
      description: '时间即深度，从阳光层月光水面下潜至万米深海生物荧光，用滚动刻画的人生档案。',
      tags: ['Procedural Shader', 'Fauna AI', 'Visual Novel'],
      link: './index.html',
      linkText: '下潜深渊 →',
    },
    {
      id: 'journey',
      title: '旅路轨迹 (The Journey)',
      category: 'TIMELINE & CHRONICLE',
      description: '长镜头视差滚动，跨越地理空间与开发周期的技术足迹与历程。',
      tags: ['Kinetic Typography', 'Scroll Dynamics'],
      link: './journey.html',
      linkText: '阅览旅路 →',
    },
  ],
  logs: [
    {
      epoch: '2026.09',
      title: '极光流体与 Agentic 视觉语言',
      coordinates: 'SECTOR-09',
      content: 'GPT-6 Astra 带来的不仅是多步自主执行能力的跃迁，更是一种将极度复杂的流动智能具象化的全新审美范式：暗夜冷黑、流体多维扭曲、高能星芒。',
    },
    {
      epoch: '2026.05',
      title: '从单纯的 UI 渲染到世界模拟 (World Simulation)',
      coordinates: 'SECTOR-05',
      content: '当图形渲染由确定性管线转向概率流场，界面不再是一组静态的矩形，而是一个持续对环境、光标与心流产生物理回应的微型生态系统。',
    },
    {
      epoch: '2025.11',
      title: '代码重构与模块解耦的纯粹性',
      coordinates: 'SECTOR-01',
      content: '保持特效与业务表达的边界干净。特效应像物理定律一样独立自足，而内容负责给这个世界赋予灵魂。',
    },
  ],
  links: [
    { name: '深海首页', url: './index.html', note: '回到原始下潜体验' },
    { name: '旅路', url: './journey.html', note: '技术里程碑' },
    { name: '炽热', url: './profile.html', note: '生命热力图' },
    { name: 'GitHub', url: 'https://github.com', note: '源代码与开源构想' },
  ],
};
