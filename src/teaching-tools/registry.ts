// 教学工具注册表 —— 唯一数据源。
// 面板、分类、搜索、收藏、最近使用、属性面板、加载器全部从这里读取。
// 来源地址见《附录：教学工具仓库地址清单》，勿自行猜测替代仓库。

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
  sourceName: string;
  offline: boolean;
  version: string;
  loadMode: LoadMode;
  localPath?: string; // local-iframe 时：相对 public 的路径
  entryUrl?: string; // remote-iframe / link 时
  paramsSchema: ParamField[];
  defaultParams: Record<string, unknown>;
  previewImage?: string;
  note?: string; // 许可证 / 协议 / 降级说明
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
  // ============ P0：Open Lab Components（零依赖 STEM 组件，MIT） ============
  {
    id: 'openlab-pendulum',
    name: '单摆（Open Lab）',
    subject: '物理',
    description: '单摆周期演示，可拖动摆长与角度观察周期变化。',
    license: 'MIT',
    sourceUrl: 'https://github.com/itkdm/open-lab-components',
    sourceName: 'Open Lab Components',
    offline: true,
    version: '-',
    loadMode: 'local-iframe',
    localPath: 'teaching-tools/openlab/pendulum.html',
    paramsSchema: [],
    defaultParams: {},
    note: '第三方自包含页面，控件在工具自身 UI 内；不实现 postMessage 参数/快照协议。',
  },
  {
    id: 'openlab-function-graph',
    name: '函数图像（Open Lab）',
    subject: '数学',
    description: '函数图像绘制，可调节函数与坐标系。',
    license: 'MIT',
    sourceUrl: 'https://github.com/itkdm/open-lab-components',
    sourceName: 'Open Lab Components',
    offline: true,
    version: '-',
    loadMode: 'local-iframe',
    localPath: 'teaching-tools/openlab/function-graph.html',
    paramsSchema: [],
    defaultParams: {},
    note: '第三方自包含页面，控件在工具自身 UI 内。',
  },
  {
    id: 'openlab-ideal-gas',
    name: '理想气体定律（Open Lab）',
    subject: '化学',
    description: '理想气体状态方程交互演示（P·V=n·R·T）。',
    license: 'MIT',
    sourceUrl: 'https://github.com/itkdm/open-lab-components',
    sourceName: 'Open Lab Components',
    offline: true,
    version: '-',
    loadMode: 'local-iframe',
    localPath: 'teaching-tools/openlab/ideal-gas.html',
    paramsSchema: [],
    defaultParams: {},
    note: '第三方自包含页面，控件在工具自身 UI 内。',
  },

  // ============ P0：Physics Notebook（纯 JS + Canvas，MIT） ============
  {
    id: 'physics-notebook-shm',
    name: '简谐振动（Physics Notebook）',
    subject: '物理',
    description: '弹簧振子简谐振动模拟（Harmonic Oscillator）。',
    license: 'MIT',
    sourceUrl: 'https://github.com/CasberryIndia/Physics-Notebook',
    sourceName: 'Physics Notebook',
    offline: true,
    version: '-',
    loadMode: 'local-iframe',
    localPath: 'teaching-tools/physics-notebook/Concepts/simple-oscillations.html',
    paramsSchema: [],
    defaultParams: {},
    note: '第三方页面（含站点导航），核心模拟可离线运行。',
  },
  {
    id: 'physics-notebook-projectile',
    name: '抛体运动（Physics Notebook）',
    subject: '物理',
    description: '斜抛运动轨迹模拟（Projectile Motion）。',
    license: 'MIT',
    sourceUrl: 'https://github.com/CasberryIndia/Physics-Notebook',
    sourceName: 'Physics Notebook',
    offline: true,
    version: '-',
    loadMode: 'local-iframe',
    localPath: 'teaching-tools/physics-notebook/Concepts/projectile-motion.html',
    paramsSchema: [],
    defaultParams: {},
    note: '第三方页面（含站点导航），核心模拟可离线运行。',
  },
  {
    id: 'physics-notebook-pendulum',
    name: '单摆（Physics Notebook）',
    subject: '物理',
    description: '单摆周期演示（Simple Pendulum）。',
    license: 'MIT',
    sourceUrl: 'https://github.com/CasberryIndia/Physics-Notebook',
    sourceName: 'Physics Notebook',
    offline: true,
    version: '-',
    loadMode: 'local-iframe',
    localPath: 'teaching-tools/physics-notebook/Concepts/simple-pendulum.html',
    paramsSchema: [],
    defaultParams: {},
    note: '第三方页面（含站点导航），核心模拟可离线运行。',
  },

  // ============ P0：cn-math-taxonomy（数学知识图谱，CC BY-NC 4.0） ============
  {
    id: 'cn-math-taxonomy',
    name: '数学知识图谱',
    subject: '数学',
    description: '高中数学知识点关系图谱（可缩放 Cytoscape 面板），支持全屏查看。',
    license: 'CC BY-NC 4.0（署名-非商业）',
    sourceUrl: 'https://github.com/xiaoyang111222/cn-math-taxonomy',
    sourceName: 'cn-math-taxonomy',
    offline: true,
    version: '-',
    loadMode: 'local-iframe',
    localPath: 'teaching-tools/cn-math-taxonomy/index.html',
    paramsSchema: [],
    defaultParams: {},
    note: '非商业许可（CC BY-NC 4.0），保留版权声明；若商用请改用远程链接并联系作者。',
  },

  // ============ P0：horizon-lab / keshihua（克隆受限，暂为外部卡片） ============
  {
    id: 'horizon-lab',
    name: '地球视距（horizon-lab）',
    subject: '地理',
    description: 'Canvas 地球视距教学项目，含 31 个中国省会城市预设（纯前端，零构建）。',
    license: 'MIT',
    sourceUrl: 'https://atomgit.com/weixin_52908342/horizon-lab',
    sourceName: 'horizon-lab',
    offline: false,
    version: '-',
    loadMode: 'link',
    entryUrl: 'https://atomgit.com/weixin_52908342/horizon-lab',
    paramsSchema: [],
    defaultParams: {},
    note: 'TODO：仓库克隆受限，暂以外部卡片接入；确认可部署地址后改为本地打包。',
  },
  {
    id: 'keshihua',
    name: '时空史图（keshihua）',
    subject: '历史',
    description: '高中历史教材数据可视化；只接入 /textbook 教材资料路径，不暴露演示主页。',
    license: '待核对',
    sourceUrl: 'https://github.com/liuerming1/keshihua',
    sourceName: 'keshihua',
    offline: false,
    version: '-',
    loadMode: 'link',
    entryUrl: 'https://github.com/liuerming1/keshihua',
    paramsSchema: [],
    defaultParams: {},
    note: 'TODO：仅接入 /textbook 路径；克隆受限，暂为外部卡片，许可证待核对 LICENSE。',
  },

  // ============ P1：交互式数学/物理 ============
  {
    id: 'math-viz',
    name: 'math-viz',
    subject: '数学',
    description: '高中数学题型交互可视化。GitHub 主仓库不明确，以 HuggingFace Space 为运行参考。',
    license: '待核对',
    sourceUrl: 'https://huggingface.co/spaces/Shizhi-LJD/math-viz',
    sourceName: 'math-viz',
    offline: false,
    version: '-',
    loadMode: 'remote-iframe',
    entryUrl: 'https://huggingface.co/spaces/Shizhi-LJD/math-viz',
    paramsSchema: [],
    defaultParams: {},
    note: 'TODO：需向作者确认 GitHub 主仓库；运行环境复杂时降级为「外部卡片 + 全屏 + 截图」。',
  },
  {
    id: 'physics-os',
    name: 'PhysicsOS',
    subject: '物理',
    description: '物理可视化智能体，优先外部链接/iframe 卡片接入，不强行本地化。',
    license: '待核对',
    sourceUrl: 'https://github.com/122-syf-wcy/PhysicsOS',
    sourceName: 'PhysicsOS',
    offline: false,
    version: '-',
    loadMode: 'link',
    entryUrl: 'https://github.com/122-syf-wcy/PhysicsOS',
    paramsSchema: [],
    defaultParams: {},
    note: '待核对 LICENSE；需后端/运行时，故不本地化。',
  },
  {
    id: 'teach-math-with-manim',
    name: 'Manim 数学动画',
    subject: '数学',
    description: 'Manim 动画源码（MIT）；优先「动画预览/视频插入」，不做前端实时渲染。',
    license: 'MIT',
    sourceUrl: 'https://github.com/Scorpio69t/teach-math-with-manim',
    sourceName: 'teach-math-with-manim',
    offline: false,
    version: '-',
    loadMode: 'link',
    entryUrl: 'https://github.com/Scorpio69t/teach-math-with-manim',
    paramsSchema: [],
    defaultParams: {},
    note: 'TODO：后续接入预渲染视频/GIF，而非前端跑 Manim。',
  },

  // ============ P2：按需接入 ============
  {
    id: 'molecuar',
    name: 'MolecuAR',
    subject: '化学',
    description: 'WebAR 分子可视化（MIT），需摄像头/AR 权限，作为外部工具卡片。',
    license: 'MIT',
    sourceUrl: 'https://github.com/arigony/hand_molecule',
    sourceName: 'MolecuAR',
    offline: false,
    version: '-',
    loadMode: 'link',
    entryUrl: 'https://github.com/arigony/hand_molecule',
    paramsSchema: [],
    defaultParams: {},
    note: '需摄像头/AR 权限，勿默认打包。',
  },
  {
    id: 'chemanim',
    name: 'chemanim',
    subject: '化学',
    description: '化学动画库（PyPI 包，非 GitHub 仓库）；后台/构建阶段预生成动画或视频，前端不跑 Python。',
    license: 'PyPI（见项目页）',
    sourceUrl: 'https://pypi.org/project/chemanim/',
    sourceName: 'chemanim',
    offline: false,
    version: '-',
    loadMode: 'link',
    entryUrl: 'https://pypi.org/project/chemanim/',
    paramsSchema: [],
    defaultParams: {},
    note: '勿与已归档的 kilacoda/chanim 混淆；后台预生成，前端不跑 Python。',
  },
  {
    id: 'bodyvista',
    name: 'BodyVista',
    subject: '生物',
    description: '3D 人体解剖平台，作为外部 iframe/新窗口工具，注意性能与许可证。',
    license: '待核对',
    sourceUrl: 'https://github.com/FreedomIntelligence/BodyVista',
    sourceName: 'BodyVista',
    offline: false,
    version: '-',
    loadMode: 'link',
    entryUrl: 'https://github.com/FreedomIntelligence/BodyVista',
    paramsSchema: [],
    defaultParams: {},
    note: '3D 资源勿默认打包进主包，按需懒加载。',
  },
  {
    id: 'aetherviz-master',
    name: 'AetherViz Master',
    subject: '通用工具',
    description: 'AI 驱动 3D 交互网页，作为外部工具卡片。',
    license: '待核对',
    sourceUrl: 'https://github.com/andyhuo520/aetherviz-master',
    sourceName: 'AetherViz Master',
    offline: false,
    version: '-',
    loadMode: 'link',
    entryUrl: 'https://github.com/andyhuo520/aetherviz-master',
    paramsSchema: [],
    defaultParams: {},
    note: '优先此主仓库；另有 Make-dream-clear/aetherviz-master。',
  },
  {
    id: 'edulab',
    name: 'edulab',
    subject: '通用工具',
    description: '题目转单文件交互网页（增强版，技能数更多），作为外部工具卡片。',
    license: '待核对',
    sourceUrl: 'https://github.com/liangdabiao/edulab',
    sourceName: 'edulab',
    offline: false,
    version: '-',
    loadMode: 'link',
    entryUrl: 'https://github.com/liangdabiao/edulab',
    paramsSchema: [],
    defaultParams: {},
    note: '基于 wy51ai/edulab 的增强版；原始仓库也可作为有效来源。',
  },
];

const FAV_KEY = 'daiyi-board-teaching-fav-v2';
const RECENT_KEY = 'daiyi-board-teaching-recent-v2';

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
