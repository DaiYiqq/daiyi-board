// 教学工具注册表 —— 唯一数据源。
// 面板、分类、搜索、收藏、最近使用、属性面板、加载器全部从这里读取。

export type TeachingSubject =
  | '数学'
  | '物理'
  | '化学'
  | '生物'
  | '地理'
  | '历史'
  | '通用工具';

export type LoadMode =
  | 'local-iframe' // 本地 HTML 静态资源，随应用打包，离线可用
  | 'remote-iframe' // 远程 iframe，需网络，失败降级
  | 'link'; // 外部工具卡片，新窗口打开

export type ParamField = {
  key: string;
  label: string;
  type: 'slider' | 'select' | 'toggle' | 'text';
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string | number }[];
  defaultValue: string | number | boolean;
};

export type TeachingTool = {
  id: string;
  name: string;
  subject: TeachingSubject;
  description: string;
  license: string;
  sourceUrl: string;
  offline: boolean;
  version: string;
  loadMode: LoadMode;
  localPath?: string; // local-iframe 时：相对 public 的路径
  entryUrl?: string; // remote-iframe / link 时
  paramsSchema: ParamField[];
  defaultParams: Record<string, unknown>;
  previewImage?: string;
};

export const SUBJECTS: TeachingSubject[] = [
  '数学',
  '物理',
  '化学',
  '生物',
  '地理',
  '历史',
  '通用工具',
];

export const TEACHING_TOOLS: TeachingTool[] = [
  // ---------------- P0：本地离线工具（自研等效 HTML，MIT） ----------------
  {
    id: 'physics-shm',
    name: '简谐振动',
    subject: '物理',
    description: '弹簧振子的简谐振动模拟，可调振幅、频率与阻尼。',
    license: 'MIT',
    sourceUrl: '',
    offline: true,
    version: '1.0.0',
    loadMode: 'local-iframe',
    localPath: 'teaching-tools/simple-harmonic.html',
    paramsSchema: [
      { key: 'amplitude', label: '振幅', type: 'slider', min: 10, max: 90, step: 1, defaultValue: 45 },
      { key: 'frequency', label: '频率', type: 'slider', min: 0.5, max: 3, step: 0.1, defaultValue: 1 },
      { key: 'damping', label: '阻尼', type: 'slider', min: 0, max: 1, step: 0.01, defaultValue: 0 },
    ],
    defaultParams: { amplitude: 45, frequency: 1, damping: 0 },
  },
  {
    id: 'physics-projectile',
    name: '抛体运动',
    subject: '物理',
    description: '斜抛运动轨迹模拟，可调初速度与抛射角度。',
    license: 'MIT',
    sourceUrl: '',
    offline: true,
    version: '1.0.0',
    loadMode: 'local-iframe',
    localPath: 'teaching-tools/projectile.html',
    paramsSchema: [
      { key: 'speed', label: '初速度', type: 'slider', min: 10, max: 100, step: 1, defaultValue: 50 },
      { key: 'angle', label: '角度', type: 'slider', min: 5, max: 85, step: 1, defaultValue: 45 },
    ],
    defaultParams: { speed: 50, angle: 45 },
  },
  {
    id: 'physics-pendulum',
    name: '单摆',
    subject: '物理',
    description: '单摆周期演示，可调摆长与重力加速度。',
    license: 'MIT',
    sourceUrl: '',
    offline: true,
    version: '1.0.0',
    loadMode: 'local-iframe',
    localPath: 'teaching-tools/pendulum.html',
    paramsSchema: [
      { key: 'length', label: '摆长', type: 'slider', min: 40, max: 180, step: 1, defaultValue: 100 },
      { key: 'gravity', label: '重力加速度', type: 'slider', min: 1, max: 20, step: 0.1, defaultValue: 9.8 },
    ],
    defaultParams: { length: 100, gravity: 9.8 },
  },
  {
    id: 'geo-horizon',
    name: '地球视距',
    subject: '地理',
    description: '地球曲率视距演示（horizon），可调观察者高度。',
    license: 'MIT',
    sourceUrl: '',
    offline: true,
    version: '1.0.0',
    loadMode: 'local-iframe',
    localPath: 'teaching-tools/horizon.html',
    paramsSchema: [
      { key: 'height', label: '观察者高度（米）', type: 'slider', min: 1, max: 10000, step: 10, defaultValue: 100 },
    ],
    defaultParams: { height: 100 },
  },
  {
    id: 'math-plot',
    name: '函数绘图',
    subject: '数学',
    description: '初等函数图像绘制，支持 sin/cos/幂函数等表达式。',
    license: 'MIT',
    sourceUrl: '',
    offline: true,
    version: '1.0.0',
    loadMode: 'local-iframe',
    localPath: 'teaching-tools/function-plot.html',
    paramsSchema: [
      { key: 'expr', label: '函数表达式', type: 'text', defaultValue: 'sin(x)*x/5' },
    ],
    defaultParams: { expr: 'sin(x)*x/5' },
  },

  // ---------------- P1/P2：外部工具卡片（来源 URL 待确认，优先新窗口打开） ----------------
  {
    id: 'open-lab-components',
    name: 'Open Lab Components',
    subject: '通用工具',
    description: '零依赖 STEM 交互组件库。来源 URL 待确认，暂以外部卡片接入。',
    license: '待确认',
    sourceUrl: 'https://github.com/search?q=open+lab+components&type=repositories',
    offline: false,
    version: '-',
    loadMode: 'link',
    entryUrl: 'https://github.com/search?q=open+lab+components&type=repositories',
    paramsSchema: [],
    defaultParams: {},
  },
  {
    id: 'physics-notebook',
    name: 'Physics Notebook',
    subject: '物理',
    description: '纯 JS + Canvas 物理模拟（简谐、抛体等）。来源 URL 待确认。',
    license: '待确认',
    sourceUrl: 'https://github.com/search?q=physics+notebook&type=repositories',
    offline: false,
    version: '-',
    loadMode: 'link',
    entryUrl: 'https://github.com/search?q=physics+notebook&type=repositories',
    paramsSchema: [],
    defaultParams: {},
  },
  {
    id: 'keshihua',
    name: '时空史图 keshihua',
    subject: '历史',
    description: '高中历史教材数据可视化。来源 URL 待确认。',
    license: '待确认',
    sourceUrl: 'https://github.com/search?q=keshihua&type=repositories',
    offline: false,
    version: '-',
    loadMode: 'link',
    entryUrl: 'https://github.com/search?q=keshihua&type=repositories',
    paramsSchema: [],
    defaultParams: {},
  },
  {
    id: 'cn-math-taxonomy',
    name: '数学知识图谱',
    subject: '数学',
    description: '高中数学知识图谱（可缩放）。来源 URL 待确认。',
    license: '待确认',
    sourceUrl: 'https://github.com/search?q=cn-math-taxonomy&type=repositories',
    offline: false,
    version: '-',
    loadMode: 'link',
    entryUrl: 'https://github.com/search?q=cn-math-taxonomy&type=repositories',
    paramsSchema: [],
    defaultParams: {},
  },
  {
    id: 'math-viz',
    name: 'math-viz',
    subject: '数学',
    description: '高中数学题型交互可视化。外部卡片 + 全屏打开 + 截图插入。',
    license: '待确认',
    sourceUrl: 'https://github.com/search?q=math-viz&type=repositories',
    offline: false,
    version: '-',
    loadMode: 'link',
    entryUrl: 'https://github.com/search?q=math-viz&type=repositories',
    paramsSchema: [],
    defaultParams: {},
  },
  {
    id: 'molecuar',
    name: 'MolecuAR',
    subject: '化学',
    description: 'WebAR 分子可视化（需摄像头/AR 权限）。外部卡片。',
    license: '待确认',
    sourceUrl: 'https://github.com/search?q=molecuar&type=repositories',
    offline: false,
    version: '-',
    loadMode: 'link',
    entryUrl: 'https://github.com/search?q=molecuar&type=repositories',
    paramsSchema: [],
    defaultParams: {},
  },
];

const FAV_KEY = 'daiyi-board-teaching-fav-v1';
const RECENT_KEY = 'daiyi-board-teaching-recent-v1';

export function getTool(id: string): TeachingTool | undefined {
  return TEACHING_TOOLS.find((t) => t.id === id);
}

export function readFavorites(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}
export function toggleFavorite(id: string): string[] {
  const cur = readFavorites();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  localStorage.setItem(FAV_KEY, JSON.stringify(next));
  return next;
}

export function readRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}
export function pushRecent(id: string): string[] {
  const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, 12);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}
