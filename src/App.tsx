import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  Camera,
  Check,
  CircleHelp,
  Download,
  Eraser,
  ExternalLink,
  FilePenLine,
  FolderOpen,
  GripVertical,
  Info,
  Menu as MenuIcon,
  Minus,
  MousePointer2,
  Palette,
  Pencil,
  Plus,
  Redo2,
  RefreshCw,
  Save,
  Settings,
  SlidersHorizontal,
  Trash2,
  Undo2,
  X,
  Clock3,
  Timer,
  Crosshair,
  ScanSearch,
  Maximize2,
  Pause,
  Play,
} from 'lucide-react';
import CameraStage from './components/CameraStage';
import type { DesktopUpdaterApi, PwaUpdaterApi, UpdateSnapshot } from './update-types';

declare global {
  interface Window {
    boardDesktop?: DesktopUpdaterApi;
    boardPwaUpdates?: PwaUpdaterApi;
  }
}

type Point = { x: number; y: number; pressure?: number };
type Mark = {
  id: string;
  kind: 'pen' | 'highlighter';
  color: string;
  width: number;
  points: Point[];
};
type Page = { id: string; title: string; marks: Mark[] };
type BoardData = { version: 1; pages: Page[]; activePage: string };
type Tool = 'select' | 'pen' | 'eraser';
type Preferences = { theme: 'dark' | 'light'; compact: boolean; visibleTools: Tool[] };
type ClassEntry = {
  id: string;
  name: string;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  days: number[]; // 0=周日..6=周六；空数组 = 每天
};

const STORAGE_KEY = 'daiyi-board-v1';
const PREFS_KEY = 'daiyi-board-preferences-v1';
const APP_VERSION = '0.7.1';
const RELEASE_URL = 'https://github.com/DaiYiqq/daiyi-board/releases/latest';
const SCHEDULE_KEY = 'daiyi-board-schedule-v1';
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const COLORS = [
  '#FFFFFF',
  '#000000',
  '#E5484D',
  '#2878D0',
  '#15803D',
  '#F1A61A',
  '#8B5CF6',
  '#0F9D9A',
];
const TOOL_LABEL: Record<Tool, string> = { select: '选择', pen: '画笔', eraser: '橡皮' };
const toolIcon = { select: MousePointer2, pen: Pencil, eraser: Eraser };
const defaultPrefs: Preferences = {
  theme: 'dark',
  compact: false,
  visibleTools: ['select', 'pen', 'eraser'],
};
const newPage = (n: number): Page => ({
  id: crypto.randomUUID(),
  title: `白板 ${String(n).padStart(2, '0')}`,
  marks: [],
});
const pressureWidth = (width: number, pressure = 0.5) =>
  width * (0.45 + Math.max(0, Math.min(1, pressure)) * 0.9);
const boundsFor = (points: Point[]) => {
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
};
const isValidPage = (value: unknown): value is Page => {
  if (!value || typeof value !== 'object') return false;
  const page = value as Page;
  if (
    typeof page.id !== 'string' ||
    !page.id ||
    typeof page.title !== 'string' ||
    page.title.length > 80 ||
    !Array.isArray(page.marks) ||
    page.marks.length > 5000
  )
    return false;
  return page.marks.every((value: unknown) => {
    if (!value || typeof value !== 'object') return false;
    const mark = value as Mark;
    return (
      typeof mark.id === 'string' &&
      !!mark.id &&
      (mark.kind === 'pen' || mark.kind === 'highlighter') &&
      /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(mark.color) &&
      Number.isFinite(mark.width) &&
      mark.width > 0 &&
      mark.width <= 64 &&
      Array.isArray(mark.points) &&
      mark.points.length > 0 &&
      mark.points.length <= 10000 &&
      mark.points.every(
        (point) =>
          Number.isFinite(point.x) &&
          Number.isFinite(point.y) &&
          point.x >= 0 &&
          point.x <= 1 &&
          point.y >= 0 &&
          point.y <= 1 &&
          (point.pressure === undefined ||
            (Number.isFinite(point.pressure) && point.pressure >= 0 && point.pressure <= 1)),
      )
    );
  });
};
const isValidBoard = (value: unknown): value is BoardData => {
  if (!value || typeof value !== 'object') return false;
  const data = value as BoardData;
  return (
    data.version === 1 &&
    Array.isArray(data.pages) &&
    data.pages.length > 0 &&
    data.pages.length <= 200 &&
    data.pages.every(isValidPage) &&
    new Set(data.pages.map((page) => page.id)).size === data.pages.length
  );
};

function readBoard(): BoardData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved) as unknown;
      if (isValidBoard(data))
        return {
          ...data,
          activePage: data.pages.some((page) => page.id === data.activePage)
            ? data.activePage
            : data.pages[0].id,
        };
    }
  } catch {
    /* Ignore an invalid saved board and start with a clean board. */
  }
  const page = { id: 'welcome-board', title: '白板 01', marks: [] };
  return { version: 1, pages: [page], activePage: page.id };
}
function readPrefs(): Preferences {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Record<string, unknown>;
    const tools = Array.isArray(raw.visibleTools)
      ? raw.visibleTools.filter(
          (tool): tool is Tool => tool === 'select' || tool === 'pen' || tool === 'eraser',
        )
      : defaultPrefs.visibleTools;
    return {
      theme: raw.theme === 'light' ? 'light' : 'dark',
      compact: typeof raw.compact === 'boolean' ? raw.compact : false,
      visibleTools: tools.length ? tools : defaultPrefs.visibleTools,
    };
  } catch {
    return defaultPrefs;
  }
}
const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map((v) => Number(v));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};
const classActiveOn = (entry: ClassEntry, dow: number) =>
  entry.days.length === 0 || entry.days.includes(dow);
const parseSchedule = (raw: unknown): ClassEntry[] => {
  if (!Array.isArray(raw)) return [];
  const result: ClassEntry[] = [];
  for (const value of raw) {
    if (!value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    if (
      typeof v.name !== 'string' || !v.name.trim() || v.name.length > 60 ||
      typeof v.start !== 'string' || !/^\d{1,2}:\d{2}$/.test(v.start) ||
      typeof v.end !== 'string' || !/^\d{1,2}:\d{2}$/.test(v.end)
    )
      continue;
    const days = Array.isArray(v.days)
      ? v.days
          .filter((d): d is number => Number.isInteger(d) && Number(d) >= 0 && Number(d) <= 6)
          .map(Number)
      : [];
    result.push({
      id: typeof v.id === 'string' && v.id ? v.id : crypto.randomUUID(),
      name: v.name.trim(),
      start: v.start,
      end: v.end,
      days,
    });
  }
  return result;
};
function readSchedule(): ClassEntry[] {
  try {
    return parseSchedule(JSON.parse(localStorage.getItem(SCHEDULE_KEY) ?? '[]'));
  } catch {
    return [];
  }
}
const currentClassFor = (schedule: ClassEntry[], now: Date): ClassEntry | null => {
  const dow = now.getDay();
  const m = now.getHours() * 60 + now.getMinutes();
  return (
    schedule.find((c) => classActiveOn(c, dow) && m >= toMinutes(c.start) && m < toMinutes(c.end)) ??
    null
  );
};
const nextClassFor = (schedule: ClassEntry[], now: Date): ClassEntry | null => {
  const dow = now.getDay();
  const m = now.getHours() * 60 + now.getMinutes();
  return (
    schedule
      .filter((c) => classActiveOn(c, dow) && m < toMinutes(c.start))
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))[0] ?? null
  );
};

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export default function App() {
  const initial = useMemo(readBoard, []);
  const [pages, setPages] = useState<Page[]>(initial.pages);
  const pagesRef = useRef(pages);
  const [activePage, setActivePage] = useState(initial.activePage);
  const activeRef = useRef(activePage);
  const undoStack = useRef<BoardData[]>([]);
  const redoStack = useRef<BoardData[]>([]);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(() => (readPrefs().theme === 'dark' ? '#FFFFFF' : '#000000'));
  const [width, setWidth] = useState(4);
  const [prefs, setPrefs] = useState<Preferences>(readPrefs);
  const [panel, setPanel] = useState<
    'menu' | 'pen' | 'customize' | 'advanced' | 'developer' | 'help' | 'camera' | null
  >(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState('点击底部“保存”手动保存工程');
  const [dragTool, setDragTool] = useState<Tool | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scheduleFileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<{
    kind: 'new' | 'move' | 'resize';
    mark?: Mark;
    id?: string;
    from?: Point;
    start?: Point;
    initial?: Point[];
    bounds?: ReturnType<typeof boundsFor>;
  } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [schedule, setSchedule] = useState<ClassEntry[]>(readSchedule);
  const [startupProgress, setStartupProgress] = useState(0);
  const [updateState, setUpdateState] = useState<UpdateSnapshot>(() => ({
    source: window.boardDesktop ? 'desktop' : 'pwa',
    status: 'idle',
  }));
  const [updateNoticeVisible, setUpdateNoticeVisible] = useState(false);
  const [advancedMode, setAdvancedMode] = useState<'clock' | 'timer' | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(10 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerDeadlineRef = useRef<number | null>(null);
  const [laserEnabled, setLaserEnabled] = useState(false);
  const [magnifierEnabled, setMagnifierEnabled] = useState(false);
  const [pointerPosition, setPointerPosition] = useState<{ x: number; y: number } | null>(null);
  const active = pages.find((p) => p.id === activePage) ?? pages[0];
  const activeIndex = Math.max(
    0,
    pages.findIndex((p) => p.id === activePage),
  );

  const commit = useCallback((next: Page[]) => {
    undoStack.current.push({
      version: 1,
      pages: structuredClone(pagesRef.current),
      activePage: activeRef.current,
    });
    if (undoStack.current.length > 60) undoStack.current.shift();
    redoStack.current = [];
    pagesRef.current = next;
    setPages(next);
    setDirty(true);
  }, []);
  const replaceCurrent = useCallback(
    (marks: Mark[]) => {
      const next = pagesRef.current.map((p) => (p.id === activeRef.current ? { ...p, marks } : p));
      commit(next);
    },
    [commit],
  );
  const undo = useCallback(() => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push({
      version: 1,
      pages: structuredClone(pagesRef.current),
      activePage: activeRef.current,
    });
    const restoredActive = previous.pages.some((page) => page.id === previous.activePage)
      ? previous.activePage
      : previous.pages[0].id;
    pagesRef.current = previous.pages;
    activeRef.current = restoredActive;
    setPages(previous.pages);
    setActivePage(restoredActive);
    setSelected(null);
    setDirty(true);
  }, []);
  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push({
      version: 1,
      pages: structuredClone(pagesRef.current),
      activePage: activeRef.current,
    });
    const restoredActive = next.pages.some((page) => page.id === next.activePage)
      ? next.activePage
      : next.pages[0].id;
    pagesRef.current = next.pages;
    activeRef.current = restoredActive;
    setPages(next.pages);
    setActivePage(restoredActive);
    setSelected(null);
    setDirty(true);
  }, []);

  useEffect(() => {
    activeRef.current = activePage;
    const canvas = canvasRef.current;
    if (!canvas || panel === 'camera') return;
    const bounds = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(bounds.width * dpr));
    canvas.height = Math.max(1, Math.round(bounds.height * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, bounds.width, bounds.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const mark of active?.marks ?? []) {
      if (!mark.points.length) continue;
      if (mark.points.length === 1) {
        ctx.beginPath();
        ctx.arc(
          mark.points[0].x * bounds.width,
          mark.points[0].y * bounds.height,
          Math.max(1, mark.width / 2),
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = mark.color;
        ctx.fill();
        continue;
      }
      ctx.strokeStyle = mark.kind === 'highlighter' ? `${mark.color}65` : mark.color;
      for (let i = 1; i < mark.points.length; i++) {
        const a = mark.points[i - 1],
          b = mark.points[i];
        ctx.beginPath();
        ctx.moveTo(a.x * bounds.width, a.y * bounds.height);
        ctx.lineTo(b.x * bounds.width, b.y * bounds.height);
        ctx.lineWidth = pressureWidth(mark.width, b.pressure);
        ctx.stroke();
      }
    }
    if (selected && active?.marks.some((m) => m.id === selected)) {
      const item = active.marks.find((m) => m.id === selected)!;
      if (item.points.length) {
        const box = boundsFor(item.points);
        const pad = 14;
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#1eb8c7';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(
          box.minX * bounds.width - pad,
          box.minY * bounds.height - pad,
          (box.maxX - box.minX) * bounds.width + pad * 2,
          (box.maxY - box.minY) * bounds.height + pad * 2,
        );
        ctx.setLineDash([]);
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(box.maxX * bounds.width + pad - 4, box.maxY * bounds.height + pad - 4, 8, 8);
        ctx.restore();
      }
    }
  }, [active, selected, panel, zoom, pages, layoutTick]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* Interface preferences are optional; board content is saved only on explicit action. */
    }
  }, [prefs]);
  useEffect(() => {
    try {
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
    } catch {
      /* 课程表为可选本地数据。 */
    }
  }, [schedule]);
  useEffect(() => {
    const resize = () => setLayoutTick((tick) => tick + 1);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      setStartupProgress(Math.min(100, elapsed / 50));
      if (elapsed >= 5000) window.clearInterval(timer);
    }, 50);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const showIfReady = (snapshot: UpdateSnapshot): void => {
      setUpdateState(snapshot);
      if (['available', 'downloading', 'downloaded'].includes(snapshot.status))
        setUpdateNoticeVisible(true);
    };
    const desktop = window.boardDesktop;
    if (desktop) {
      const unsubscribe = desktop.subscribeUpdateState(showIfReady);
      void desktop.getUpdateState().then(showIfReady).catch(() => undefined);
      return unsubscribe;
    }
    const pwa = window.boardPwaUpdates;
    if (pwa) {
      const unsubscribe = pwa.subscribeUpdateState(showIfReady);
      showIfReady(pwa.getUpdateState());
      return unsubscribe;
    }
  }, []);
  useEffect(() => {
    if (!timerRunning) return;
    const updateRemaining = () => {
      const deadline = timerDeadlineRef.current;
      if (deadline === null) return;
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimerSeconds(remaining);
      if (remaining === 0) {
        timerDeadlineRef.current = null;
        setTimerRunning(false);
      }
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 250);
    document.addEventListener('visibilitychange', updateRemaining);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', updateRemaining);
    };
  }, [timerRunning]);
  useEffect(() => {
    const source = canvasRef.current,
      lens = magnifierCanvasRef.current;
    if (!magnifierEnabled || !pointerPosition || !source || !lens) return;
    const context = lens.getContext('2d');
    if (!context) return;
    const dpr = window.devicePixelRatio || 1;
    const crop = 82 * dpr;
    const centerX = pointerPosition.x * dpr,
      centerY = pointerPosition.y * dpr;
    context.clearRect(0, 0, lens.width, lens.height);
    context.imageSmoothingEnabled = false;
    context.drawImage(
      source,
      Math.max(0, Math.min(source.width - crop, centerX - crop / 2)),
      Math.max(0, Math.min(source.height - crop, centerY - crop / 2)),
      crop,
      crop,
      0,
      0,
      lens.width,
      lens.height,
    );
  }, [magnifierEnabled, pointerPosition, active, selected, layoutTick]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
      if (e.key === 'Escape') {
        setPanel(null);
        setAdvancedMode(null);
        pauseTimer();
        setLaserEnabled(false);
        setMagnifierEnabled(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const pointAt = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const r = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (event.clientY - r.top) / r.height)),
      pressure: event.pressure || 0.5,
    };
  };
  const onCanvasDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (panel) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointAt(event);
    if (tool === 'eraser') {
      const remaining = active.marks.filter(
        (mark) => !mark.points.some((p) => distance(p, point) < Math.max(0.025, width / 900)),
      );
      if (remaining.length !== active.marks.length) replaceCurrent(remaining);
      return;
    }
    if (tool === 'select') {
      const selectedMark = active.marks.find((mark) => mark.id === selected);
      if (selectedMark?.points.length) {
        const r = event.currentTarget.getBoundingClientRect(),
          box = boundsFor(selectedMark.points);
        const handle = { x: box.maxX + 14 / r.width, y: box.maxY + 14 / r.height };
        if (distance(point, handle) < Math.max(0.02, 20 / Math.min(r.width, r.height))) {
          drawing.current = {
            kind: 'resize',
            id: selectedMark.id,
            start: point,
            initial: structuredClone(selectedMark.points),
            bounds: box,
          };
          return;
        }
      }
      const hit = [...active.marks]
        .reverse()
        .find((mark) => mark.points.some((p) => distance(p, point) < 0.035));
      setSelected(hit?.id ?? null);
      if (hit) drawing.current = { kind: 'move', id: hit.id, start: point, from: hit.points[0] };
      return;
    }
    setSelected(null);
    drawing.current = {
      kind: 'new',
      mark: { id: crypto.randomUUID(), kind: 'pen', color, width, points: [point] },
    };
  };
  const onCanvasMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const action = drawing.current;
    if (!action) return;
    const point = pointAt(event);
    if (action.kind === 'new' && action.mark) {
      action.mark.points.push(point);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const r = canvas.getBoundingClientRect();
        ctx.beginPath();
        const pts = action.mark.points;
        const a = pts[Math.max(0, pts.length - 2)],
          b = pts[pts.length - 1];
        ctx.moveTo(a.x * r.width, a.y * r.height);
        ctx.lineTo(b.x * r.width, b.y * r.height);
        ctx.strokeStyle = color;
        ctx.lineWidth = pressureWidth(width, b.pressure);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    } else if ((action.kind === 'move' || action.kind === 'resize') && action.id && action.start) {
      let next: Mark[];
      if (action.kind === 'move') {
        const dx = point.x - action.start.x,
          dy = point.y - action.start.y;
        next = active.marks.map((m) =>
          m.id === action.id
            ? {
                ...m,
                points: m.points.map((p) => ({
                  ...p,
                  x: Math.max(0, Math.min(1, p.x + dx)),
                  y: Math.max(0, Math.min(1, p.y + dy)),
                })),
              }
            : m,
        );
      } else if (action.initial && action.bounds) {
        const box = action.bounds,
          start = action.start;
        const sx = Math.max(
          0.12,
          (box.maxX - box.minX + point.x - start.x) / Math.max(0.02, box.maxX - box.minX),
        );
        const sy = Math.max(
          0.12,
          (box.maxY - box.minY + point.y - start.y) / Math.max(0.02, box.maxY - box.minY),
        );
        const scale = Math.max(0.12, Math.min(6, (sx + sy) / 2));
        const resized = action.initial.map((p) => ({
          ...p,
          x: Math.max(0, Math.min(1, box.minX + (p.x - box.minX) * scale)),
          y: Math.max(0, Math.min(1, box.minY + (p.y - box.minY) * scale)),
        }));
        next = active.marks.map((m) => (m.id === action.id ? { ...m, points: resized } : m));
      } else return;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d'),
          r = canvas.getBoundingClientRect();
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.scale(dpr, dpr);
          for (const mark of next) {
            if (mark.points.length === 1) {
              ctx.beginPath();
              ctx.arc(
                mark.points[0].x * r.width,
                mark.points[0].y * r.height,
                Math.max(1, mark.width / 2),
                0,
                Math.PI * 2,
              );
              ctx.fillStyle = mark.color;
              ctx.fill();
              continue;
            }
            ctx.strokeStyle = mark.color;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            for (let i = 1; i < mark.points.length; i++) {
              const a = mark.points[i - 1],
                b = mark.points[i];
              ctx.beginPath();
              ctx.moveTo(a.x * r.width, a.y * r.height);
              ctx.lineTo(b.x * r.width, b.y * r.height);
              ctx.lineWidth = pressureWidth(mark.width, b.pressure);
              ctx.stroke();
            }
          }
          ctx.restore();
        }
      }
      movingPreview.current = next;
    }
  };
  const movingPreview = useRef<Page['marks'] | null>(null);
  const finishDrawing = () => {
    const action = drawing.current;
    drawing.current = null;
    if (!action) return;
    if (action.kind === 'new' && action.mark) replaceCurrent([...active.marks, action.mark]);
    if ((action.kind === 'move' || action.kind === 'resize') && movingPreview.current) {
      replaceCurrent(movingPreview.current);
      movingPreview.current = null;
    }
  };

  const addPage = () => {
    const page = newPage(pagesRef.current.length + 1);
    commit([...pagesRef.current, page]);
    activeRef.current = page.id;
    setActivePage(page.id);
    setSelected(null);
  };
  const clearPage = () => {
    if (active.marks.length && window.confirm('清空当前白板？此操作可以撤销。')) replaceCurrent([]);
  };
  const deletePage = (pageId: string) => {
    if (pagesRef.current.length < 2) {
      window.alert('至少保留一页白板。');
      return;
    }
    if (!window.confirm('删除此白板页面？此操作可以撤销。')) return;
    const oldIndex = pagesRef.current.findIndex((page) => page.id === pageId);
    const next = pagesRef.current.filter((page) => page.id !== pageId);
    const nextActive =
      pageId === activeRef.current
        ? next[Math.min(Math.max(0, oldIndex - 1), next.length - 1)]
        : (next.find((page) => page.id === activeRef.current) ?? next[0]);
    commit(next);
    activeRef.current = nextActive.id;
    setActivePage(nextActive.id);
    setSelected(null);
  };
  const renamePage = (pageId: string) => {
    const page = pagesRef.current.find((item) => item.id === pageId);
    if (!page) return;
    const title = window.prompt('为白板页面命名', page.title)?.trim();
    if (title && title !== page.title)
      commit(pagesRef.current.map((item) => (item.id === pageId ? { ...item, title } : item)));
  };
  const deleteSelected = () => {
    if (selected) {
      replaceCurrent(active.marks.filter((m) => m.id !== selected));
      setSelected(null);
    }
  };
  const saveFile = () => {
    const board: BoardData = { version: 1, pages, activePage };
    let savedToDevice = true;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
    } catch {
      savedToDevice = false;
    }
    const file = new Blob([JSON.stringify(board, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = `白板工程-${new Date().toISOString().slice(0, 10)}.daiyi-board.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSavedAt(savedToDevice ? '已手动保存到本机并导出备份' : '已导出备份；本机存储不可用');
    setDirty(!savedToDevice);
    if (!savedToDevice)
      window.alert('工程 JSON 备份已下载，但本机存储不可用。请妥善保存下载的工程文件。');
  };
  const openFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('文件过大');
      const raw = JSON.parse(await file.text()) as unknown;
      if (!raw || typeof raw !== 'object') throw new Error('格式不正确');
      const parsed = raw as BoardData;
      if (!isValidBoard(parsed)) throw new Error('格式不正确');
      const nextActive = parsed.pages.some((page) => page.id === parsed.activePage)
        ? parsed.activePage
        : parsed.pages[0].id;
      commit(parsed.pages);
      setActivePage(nextActive);
      activeRef.current = nextActive;
      setSavedAt('工程已打开，尚未手动保存');
    } catch {
      window.alert('无法打开该白板工程。请确认文件来自 DY Board 导出的 .json 文件。');
    }
    event.target.value = '';
  };
  const moveTool = (target: Tool) => {
    if (!dragTool || dragTool === target) return;
    const order = [...prefs.visibleTools],
      from = order.indexOf(dragTool),
      to = order.indexOf(target);
    order.splice(from, 1);
    order.splice(to, 0, dragTool);
    setPrefs({ ...prefs, visibleTools: order });
    setDragTool(null);
  };
  const toggleToolVisibility = (target: Tool) => {
    const visible = prefs.visibleTools.includes(target)
      ? prefs.visibleTools.filter((id) => id !== target)
      : [...prefs.visibleTools, target];
    if (!visible.length) return;
    setPrefs({ ...prefs, visibleTools: visible });
  };
  const addClass = () =>
    setSchedule((s) => [
      ...s,
      { id: crypto.randomUUID(), name: '', start: '08:00', end: '09:40', days: [1, 2, 3, 4, 5] },
    ]);
  const removeClass = (id: string) => setSchedule((s) => s.filter((c) => c.id !== id));
  const updateClass = (id: string, patch: Partial<Omit<ClassEntry, 'id'>>) =>
    setSchedule((s) => s.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const toggleDay = (id: string, dow: number) =>
    setSchedule((s) =>
      s.map((c) => {
        if (c.id !== id) return c;
        const has = c.days.includes(dow);
        return { ...c, days: has ? c.days.filter((d) => d !== dow) : [...c.days, dow].sort() };
      }),
    );
  const importScheduleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('文件过大');
      const entries = parseSchedule(JSON.parse(await file.text()));
      if (!entries.length) throw new Error('没有有效课程');
      setSchedule(entries);
      window.alert(`已导入 ${entries.length} 门课程。`);
    } catch {
      window.alert('导入失败：请使用 JSON 数组，每项含 name、start、end（可选 days，0=周日…6=周六）。');
    }
    event.target.value = '';
  };
  const quitApplication = async () => {
    setPanel(null);
    if (window.boardDesktop?.quit) {
      if (window.confirm('确定退出 DY Board？')) await window.boardDesktop.quit();
      return;
    }
    window.alert('浏览器不允许网页关闭自身。请使用浏览器的关闭按钮或关闭当前标签页退出 DY Board。');
  };
  const checkForUpdates = async () => {
    setPanel(null);
    setUpdateNoticeVisible(true);
    if (window.boardDesktop) {
      setUpdateState({ source: 'desktop', status: 'checking' });
      try {
        const started = await window.boardDesktop.checkForUpdates();
        if (!started) setUpdateState(await window.boardDesktop.getUpdateState());
      } catch {
        setUpdateState({
          source: 'desktop',
          status: 'error',
          message: '更新检查失败，请检查网络后重试。',
        });
      }
      return;
    }
    if (window.boardPwaUpdates) {
      setUpdateState(await window.boardPwaUpdates.checkForUpdates());
      return;
    }
    setUpdateState({
      source: 'pwa',
      status: 'unsupported',
      message: '当前环境未启用 PWA 更新服务，请打开在线版后重试。',
    });
  };
  const downloadUpdate = async () => {
    const desktop = window.boardDesktop;
    if (!desktop) return;
    if (!(await desktop.downloadUpdate())) setUpdateState(await desktop.getUpdateState());
  };
  const installUpdate = async () => {
    const desktop = window.boardDesktop;
    if (desktop && !(await desktop.installUpdate())) setUpdateState(await desktop.getUpdateState());
  };
  const applyPwaUpdate = () => {
    if (!window.boardPwaUpdates?.applyUpdate())
      setUpdateState({
        source: 'pwa',
        status: 'error',
        message: '未找到待应用的更新，请重新检查。',
      });
  };
  const openReleasePage = async () => {
    if (window.boardDesktop) {
      await window.boardDesktop.openReleasePage();
      return;
    }
    window.open(RELEASE_URL, '_blank', 'noopener,noreferrer');
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      window.alert('当前浏览器未允许切换全屏，请使用浏览器的全屏快捷键。');
    }
  };
  const trackPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!laserEnabled && !magnifierEnabled) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (rect) setPointerPosition({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  };
  const clockText = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const dateText = now.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const currentClass = currentClassFor(schedule, now);
  const nextClass = nextClassFor(schedule, now);
  const hasClassToday = schedule.some((c) => classActiveOn(c, now.getDay()));
  const islandClassText = currentClass
    ? currentClass.name
    : hasClassToday && !nextClass
      ? '已下课'
      : '';
  const timerText = `${String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:${String(timerSeconds % 60).padStart(2, '0')}`;
  const updateHeading =
    updateState.status === 'checking'
      ? '正在检查更新'
      : updateState.status === 'available'
        ? updateState.version
          ? `发现新版本 ${updateState.version}`
          : '有新版本可用'
        : updateState.status === 'downloading'
          ? '正在下载更新'
          : updateState.status === 'downloaded'
            ? '更新已下载'
            : updateState.status === 'not-available'
              ? '当前已是最新版本'
              : updateState.status === 'unsupported'
                ? '需要手动更新'
                : '更新检查失败';
  const updateDescription =
    updateState.message ??
    (updateState.status === 'checking'
      ? '正在连接更新源，请稍候。'
      : updateState.status === 'available'
        ? updateState.source === 'pwa'
          ? '新版已就绪；刷新应用后生效。'
          : '下载后可选择合适的时间重启安装。'
        : updateState.status === 'downloading'
          ? `更新包下载进度 ${Math.round(updateState.percent ?? 0)}%。`
          : updateState.status === 'downloaded'
            ? '重启 DY Board 完成安装；当前白板内容已保存在本机。'
            : updateState.status === 'not-available'
              ? `当前版本 ${APP_VERSION}。`
              : updateState.status === 'unsupported'
                ? '此安装方式不支持应用内更新。'
                : '请检查网络连接后重试。');

  function startTimer() {
    if (timerSeconds <= 0) return;
    timerDeadlineRef.current = Date.now() + timerSeconds * 1000;
    setTimerRunning(true);
  }
  function pauseTimer() {
    const deadline = timerDeadlineRef.current;
    if (deadline !== null) setTimerSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    timerDeadlineRef.current = null;
    setTimerRunning(false);
  }
  function resetTimer(seconds = 10 * 60) {
    timerDeadlineRef.current = null;
    setTimerRunning(false);
    setTimerSeconds(seconds);
  }

  return (
    <main className={`app-shell theme-${prefs.theme} ${prefs.compact ? 'is-compact' : ''}`}>
      <section className="workspace">
        <div
          className="time-island"
          aria-label={`系统时间 ${clockText}${islandClassText ? `，${islandClassText}` : ''}`}
        >
          <span className="island-logo">Yi+</span>
          <span className="island-separator" />
          <Clock3 size={14} />
          <time>{clockText}</time>
          <small>{dateText}</small>
          {islandClassText && (
            <>
              <span className="island-separator" />
              <span className={`island-class${islandClassText === '已下课' ? ' is-dismissed' : ''}`}>
                {islandClassText}
              </span>
            </>
          )}
        </div>
        {panel === 'camera' ? (
          <CameraStage
            annotationColor={color}
            annotationWidth={width}
            onAnnotationColorChange={setColor}
            onAnnotationWidthChange={setWidth}
            onExit={() => setPanel(null)}
          />
        ) : (
          <section className="board-area">
            <div
              className="canvas-stage"
              ref={stageRef}
              onPointerMove={trackPointer}
              onPointerLeave={() => setPointerPosition(null)}
              onClick={() => {
                if (
                  panel === 'customize' ||
                  panel === 'menu' ||
                  panel === 'pen' ||
                  panel === 'advanced'
                )
                  setPanel(null);
              }}
            >
              <div className="canvas-wrap" style={{ transform: `scale(${zoom / 100})` }}>
                <div className="paper-sheet">
                  <canvas
                    ref={canvasRef}
                    className={`drawing-canvas ${laserEnabled || magnifierEnabled ? 'select-cursor' : tool === 'pen' ? 'pen-cursor' : tool === 'eraser' ? 'eraser-cursor' : 'select-cursor'}`}
                    onPointerDown={(event) => {
                      if (!laserEnabled && !magnifierEnabled) onCanvasDown(event);
                    }}
                    onPointerMove={(event) => {
                      if (!laserEnabled && !magnifierEnabled) onCanvasMove(event);
                    }}
                    onPointerUp={finishDrawing}
                    onPointerCancel={finishDrawing}
                  />
                </div>
              </div>
              {laserEnabled && pointerPosition && (
                <div
                  className="laser-pointer"
                  style={{ left: pointerPosition.x, top: pointerPosition.y }}
                  aria-hidden="true"
                />
              )}
              {magnifierEnabled && pointerPosition && (
                <canvas
                  ref={magnifierCanvasRef}
                  width="164"
                  height="164"
                  className="magnifier-lens"
                  style={{
                    left: Math.max(
                      8,
                      Math.min(
                        (stageRef.current?.clientWidth ?? 400) - 172,
                        pointerPosition.x + 22,
                      ),
                    ),
                    top: Math.max(
                      8,
                      Math.min(
                        (stageRef.current?.clientHeight ?? 300) - 172,
                        pointerPosition.y + 22,
                      ),
                    ),
                  }}
                  aria-label="白板局部放大镜"
                />
              )}
              {panel === 'pen' && (
                <div className="toolbar-popover pen-popover" onClick={(e) => e.stopPropagation()}>
                  <div className="toolbar-popover-title">
                    <div>
                      <span className="eyebrow">绘图工具</span>
                      <h3>笔设置</h3>
                    </div>
                    <button
                      className="popover-close"
                      onClick={() => setPanel(null)}
                      aria-label="关闭笔设置"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="setting-group">
                    <div className="setting-label">笔颜色</div>
                    <div className="swatches">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          className={`swatch ${color === c ? 'is-on' : ''}`}
                          style={{ background: c }}
                          onClick={() => setColor(c)}
                          aria-label={`画笔颜色 ${c}`}
                        >
                          {color === c && (
                            <Check size={13} color={c === '#FFFFFF' ? '#111827' : '#fff'} />
                          )}
                        </button>
                      ))}
                      <label className="custom-color" title="自定义颜色">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                        />
                        <Palette size={15} />
                      </label>
                    </div>
                  </div>
                  <div className="setting-group">
                    <div className="setting-row">
                      <div>
                        <div className="setting-label">笔触粗细</div>
                        <div className="setting-sub">{width}px · 支持压感</div>
                      </div>
                      <input
                        className="range-slider"
                        type="range"
                        min="2"
                        max="16"
                        value={width}
                        onChange={(e) => setWidth(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              )}
              {panel === 'customize' && (
                <div
                  className="toolbar-popover settings-popover"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="toolbar-popover-title">
                    <div>
                      <span className="eyebrow">DY BOARD</span>
                      <h3>设置</h3>
                    </div>
                    <button
                      className="popover-close"
                      onClick={() => setPanel(null)}
                      aria-label="关闭设置"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="setting-group">
                    <div className="setting-label">画布主题</div>
                    <div className="theme-switch">
                      <button
                        className={prefs.theme === 'dark' ? 'is-on' : ''}
                        onClick={() => {
                          setPrefs({ ...prefs, theme: 'dark' });
                          setColor('#FFFFFF');
                        }}
                      >
                        <span className="theme-preview dark-preview" />
                        黑色
                      </button>
                      <button
                        className={prefs.theme === 'light' ? 'is-on' : ''}
                        onClick={() => {
                          setPrefs({ ...prefs, theme: 'light' });
                          setColor('#000000');
                        }}
                      >
                        <span className="theme-preview light-preview" />
                        白色
                      </button>
                    </div>
                  </div>
                  <div className="setting-group">
                    <div className="setting-row">
                      <div>
                        <div className="setting-label">紧凑工具栏</div>
                        <div className="setting-sub">减少底部控件间距</div>
                      </div>
                      <button
                        className={`toggle ${prefs.compact ? 'on' : ''}`}
                        onClick={() => setPrefs({ ...prefs, compact: !prefs.compact })}
                        aria-label="切换紧凑工具栏"
                      >
                        <i />
                      </button>
                    </div>
                  </div>
                  <div className="setting-group">
                    <div className="setting-label">显示绘图工具</div>
                    <div className="tool-toggles">
                      {(['select', 'pen', 'eraser'] as Tool[]).map((id) => (
                        <button
                          key={id}
                          className={prefs.visibleTools.includes(id) ? 'is-on' : ''}
                          onClick={() => toggleToolVisibility(id)}
                        >
                          {prefs.visibleTools.includes(id) && <Check size={12} />}
                          {TOOL_LABEL[id]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="setting-group schedule-group">
                    <div className="setting-label">课程表</div>
                    {schedule.length === 0 ? (
                      <div className="setting-sub">还没有课程，可手动添加或导入 JSON。</div>
                    ) : (
                      schedule.map((c) => (
                        <div className="schedule-row" key={c.id}>
                          <input
                            className="schedule-name"
                            value={c.name}
                            placeholder="课程名"
                            maxLength={60}
                            onChange={(e) => updateClass(c.id, { name: e.target.value })}
                          />
                          <input
                            className="schedule-time"
                            type="time"
                            value={c.start}
                            onChange={(e) => updateClass(c.id, { start: e.target.value })}
                          />
                          <span className="schedule-dash">—</span>
                          <input
                            className="schedule-time"
                            type="time"
                            value={c.end}
                            onChange={(e) => updateClass(c.id, { end: e.target.value })}
                          />
                          <button
                            className="schedule-delete"
                            onClick={() => removeClass(c.id)}
                            aria-label="删除课程"
                          >
                            <X size={13} />
                          </button>
                          <div className="schedule-days">
                            {WEEKDAY_LABELS.map((label, dow) => (
                              <button
                                key={dow}
                                className={`schedule-day ${c.days.includes(dow) ? 'is-on' : ''}`}
                                onClick={() => toggleDay(c.id, dow)}
                                title={`周${label}`}
                                aria-pressed={c.days.includes(dow)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                    <div className="schedule-actions">
                      <button className="schedule-add" onClick={addClass}>
                        + 添加课程
                      </button>
                      <button className="schedule-import" onClick={() => scheduleFileRef.current?.click()}>
                        导入 JSON
                      </button>
                    </div>
                    <input
                      ref={scheduleFileRef}
                      className="hidden-input"
                      type="file"
                      accept=".json,application/json"
                      onChange={importScheduleFile}
                    />
                    <div className="setting-sub schedule-current">
                      {currentClass
                        ? `本节课：${currentClass.name}（${currentClass.start}–${currentClass.end}）`
                        : nextClass
                          ? `下节课：${nextClass.name}（${nextClass.start}–${nextClass.end}）`
                          : hasClassToday
                            ? '今日课程已结束'
                            : '今日无课程'}
                    </div>
                  </div>
                  <div className="popover-foot">
                    <GripVertical size={14} />
                    拖动底部工具可调整顺序
                  </div>
                </div>
              )}
              {panel === 'advanced' && (
                <div className="toolbar-menu advanced-menu" onClick={(e) => e.stopPropagation()}>
                  <div className="toolbar-popover-title">
                    <div>
                      <span className="eyebrow">DY BOARD</span>
                      <h3>高级功能</h3>
                    </div>
                    <button
                      className="popover-close"
                      onClick={() => setPanel(null)}
                      aria-label="关闭高级功能"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setAdvancedMode('clock');
                      setPanel(null);
                    }}
                  >
                    <Clock3 size={18} />
                    <span>
                      <b>全屏时钟</b>
                      <small>大字时间显示</small>
                    </span>
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      resetTimer();
                      setAdvancedMode('timer');
                      setPanel(null);
                    }}
                  >
                    <Timer size={18} />
                    <span>
                      <b>课堂倒计时</b>
                      <small>可暂停和调整时长</small>
                    </span>
                  </button>
                  <button
                    className={`menu-item ${laserEnabled ? 'menu-item-active' : ''}`}
                    aria-pressed={laserEnabled}
                    onClick={() => {
                      setLaserEnabled((value) => !value);
                      setMagnifierEnabled(false);
                      setPointerPosition(null);
                      setPanel(null);
                    }}
                  >
                    <Crosshair size={18} />
                    <span>
                      <b>{laserEnabled ? '关闭激光指示' : '激光指示器'}</b>
                      <small>指向画布重点，不写入笔迹</small>
                    </span>
                  </button>
                  <button
                    className={`menu-item ${magnifierEnabled ? 'menu-item-active' : ''}`}
                    aria-pressed={magnifierEnabled}
                    onClick={() => {
                      setMagnifierEnabled((value) => !value);
                      setLaserEnabled(false);
                      setPointerPosition(null);
                      setPanel(null);
                    }}
                  >
                    <ScanSearch size={18} />
                    <span>
                      <b>{magnifierEnabled ? '关闭屏幕放大镜' : '屏幕放大镜'}</b>
                      <small>跟随指针放大局部画面</small>
                    </span>
                  </button>
                </div>
              )}
              {panel === 'menu' && (
                <div className="toolbar-menu main-menu" onClick={(e) => e.stopPropagation()}>
                  <div className="toolbar-popover-title">
                    <div>
                      <span className="eyebrow">DY BOARD</span>
                      <h3>菜单</h3>
                    </div>
                    <button
                      className="popover-close"
                      onClick={() => setPanel(null)}
                      aria-label="关闭菜单"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <button className="menu-item" onClick={() => setPanel('customize')}>
                    <Settings size={18} />
                    <span>
                      <b>设置</b>
                      <small>画布、工具栏和界面</small>
                    </span>
                  </button>
                  <button className="menu-item" onClick={() => void checkForUpdates()}>
                    <RefreshCw size={18} />
                    <span>
                      <b>检查更新</b>
                      <small>自动检查与在线升级</small>
                    </span>
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setPanel('help');
                    }}
                  >
                    <CircleHelp size={18} />
                    <span>
                      <b>帮助</b>
                      <small>快捷操作与使用说明</small>
                    </span>
                  </button>
                  <button className="menu-item" onClick={() => setPanel('developer')}>
                    <Info size={18} />
                    <span>
                      <b>关于 DY Board</b>
                      <small>版本 {APP_VERSION} · 开发者</small>
                    </span>
                  </button>
                  <button className="menu-item" onClick={() => void toggleFullscreen()}>
                    <Maximize2 size={18} />
                    <span>
                      <b>切换全屏</b>
                      <small>适用于支持全屏 API 的宿主</small>
                    </span>
                  </button>
                  <button
                    className="menu-item menu-item-danger"
                    onClick={() => void quitApplication()}
                  >
                    <X size={18} />
                    <span>
                      <b>退出软件</b>
                      <small>
                        {window.boardDesktop ? '关闭 DY Board 桌面应用' : '查看浏览器退出说明'}
                      </small>
                    </span>
                  </button>
                </div>
              )}
            </div>
            <footer className="bottom-dock" aria-label="白板主工具栏">
              <div className="dock-group dock-tools" aria-label="绘图工具">
                {prefs.visibleTools.map((id) => {
                  const Icon = toolIcon[id];
                  return (
                    <button
                      key={id}
                      draggable
                      onDragStart={() => setDragTool(id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => moveTool(id)}
                      onDragEnd={() => setDragTool(null)}
                      className={`dock-button tool-button ${tool === id ? 'selected' : ''}`}
                      aria-pressed={tool === id}
                      onClick={() => setTool(id)}
                      title={`${TOOL_LABEL[id]}（可拖动排序）`}
                      aria-label={TOOL_LABEL[id]}
                    >
                      <Icon size={18} />
                      <span>{TOOL_LABEL[id]}</span>
                    </button>
                  );
                })}
                {selected && (
                  <button
                    className="dock-button dock-danger"
                    onClick={deleteSelected}
                    title="删除所选笔迹"
                    aria-label="删除所选笔迹"
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
              <button
                className={`dock-button ${panel === 'pen' ? 'selected' : ''}`}
                onClick={() => setPanel(panel === 'pen' ? null : 'pen')}
                title="颜色与笔触粗细"
                aria-label="笔设置"
              >
                <SlidersHorizontal size={18} />
                <span>笔设置</span>
              </button>
              <span className="dock-divider" />
              <div className="dock-group dock-pages" aria-label="页面管理">
                <select
                  className="dock-select"
                  value={activePage}
                  onChange={(e) => {
                    setActivePage(e.target.value);
                    activeRef.current = e.target.value;
                    setSelected(null);
                    setDirty(true);
                  }}
                  aria-label="当前白板页面"
                >
                  {pages.map((page, index) => (
                    <option key={page.id} value={page.id}>
                      {String(index + 1).padStart(2, '0')} · {page.title}
                    </option>
                  ))}
                </select>
                <button
                  className="dock-button"
                  onClick={addPage}
                  title="新建页面"
                  aria-label="新建页面"
                >
                  <Plus size={18} />
                </button>
                <button
                  className="dock-button dock-optional"
                  onClick={() => renamePage(activePage)}
                  title="重命名页面"
                  aria-label="重命名页面"
                >
                  <FilePenLine size={17} />
                </button>
                <button
                  className="dock-button dock-optional"
                  onClick={clearPage}
                  title="清空当前页面"
                  aria-label="清空当前页面"
                >
                  <Eraser size={17} />
                </button>
                <button
                  className="dock-button dock-optional dock-danger"
                  onClick={() => deletePage(activePage)}
                  disabled={pages.length < 2}
                  title="删除当前页面"
                  aria-label="删除当前页面"
                >
                  <Trash2 size={16} />
                </button>
                <span className="dock-page-count">
                  {activeIndex + 1}/{pages.length}
                </span>
              </div>
              <span className="dock-divider dock-page-divider" />
              <div className="dock-group dock-history" aria-label="撤销和缩放">
                <button
                  className="dock-button"
                  title="撤销（Ctrl+Z）"
                  aria-label="撤销"
                  onClick={undo}
                  disabled={!undoStack.current.length}
                >
                  <Undo2 size={17} />
                </button>
                <button
                  className="dock-button"
                  title="重做（Ctrl+Y）"
                  aria-label="重做"
                  onClick={redo}
                  disabled={!redoStack.current.length}
                >
                  <Redo2 size={17} />
                </button>
                <span className="dock-divider dock-zoom-divider" />
                <button
                  className="dock-button dock-zoom-button"
                  onClick={() => setZoom(Math.max(60, zoom - 10))}
                  title="缩小画布"
                >
                  <Minus size={15} />
                </button>
                <span className="dock-zoom-value">{zoom}%</span>
                <button
                  className="dock-button dock-zoom-button"
                  onClick={() => setZoom(Math.min(140, zoom + 10))}
                  title="放大画布"
                >
                  <Plus size={15} />
                </button>
              </div>
              <span className="dock-spacer" />
              <input
                ref={fileRef}
                className="hidden-input"
                type="file"
                accept=".json,.daiyi-board.json,application/json"
                onChange={openFile}
              />
              <div className="dock-group dock-actions" aria-label="白板操作">
                <button
                  className="dock-button"
                  onClick={() => {
                    setLaserEnabled(false);
                    setMagnifierEnabled(false);
                    setPointerPosition(null);
                    setPanel('camera');
                  }}
                  title="打开摄像展台"
                  aria-label="展台"
                >
                  <Camera size={18} />
                  <span>展台</span>
                </button>
                <button
                  className="dock-button dock-secondary"
                  onClick={() => fileRef.current?.click()}
                  title="打开白板工程"
                  aria-label="打开工程"
                >
                  <FolderOpen size={17} />
                  <span>打开</span>
                </button>
                <button
                  className={`dock-button dock-secondary dock-save-button${dirty ? ' is-dirty' : ''}`}
                  onClick={saveFile}
                  title={dirty ? '有未保存更改；点击后保存到本机并下载 JSON 备份' : savedAt}
                  aria-label={dirty ? '手动保存工程；当前有未保存更改' : '手动保存白板工程'}
                >
                  <Save size={17} />
                  <span>保存</span>
                  {dirty && <i className="dock-save-indicator" aria-hidden="true" />}
                </button>
                <span className={`dock-save-state${dirty ? ' is-dirty' : ''}`} aria-live="polite">
                  {dirty ? '有未保存更改' : savedAt}
                </span>
                <button
                  className={`dock-button ${panel === 'advanced' ? 'selected' : ''}`}
                  onClick={() => setPanel(panel === 'advanced' ? null : 'advanced')}
                  title="高级功能"
                  aria-label="高级功能"
                >
                  <Clock3 size={18} />
                  <span>高级</span>
                </button>
                <button
                  className={`dock-button ${panel === 'menu' ? 'selected' : ''}`}
                  onClick={() => setPanel(panel === 'menu' ? null : 'menu')}
                  title="主菜单"
                  aria-label="主菜单"
                >
                  <MenuIcon size={18} />
                  <span>菜单</span>
                </button>
              </div>
            </footer>
          </section>
        )}
      </section>
      {advancedMode && (
        <div className="advanced-overlay">
          <button
            className="mode-close"
            onClick={() => {
              setAdvancedMode(null);
              pauseTimer();
            }}
            aria-label="返回白板"
          >
            <X size={21} />
            <span>返回白板</span>
          </button>
          {advancedMode === 'clock' ? (
            <div className="clock-mode">
              <span className="eyebrow">DY BOARD · 全屏时钟</span>
              <div className="clock-mode-time">{clockText}</div>
              <div className="clock-mode-date">
                {now.toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long',
                })}
              </div>
            </div>
          ) : (
            <div className="timer-mode">
              <span className="eyebrow">DY BOARD · 课堂倒计时</span>
              <div className={`timer-mode-time ${timerSeconds === 0 ? 'timer-finished' : ''}`}>
                {timerText}
              </div>
              <p>{timerSeconds === 0 ? '时间到' : timerRunning ? '正在计时' : '准备就绪'}</p>
              <div className="timer-controls">
                <button
                  onClick={() => setTimerSeconds((seconds) => Math.max(60, seconds - 60))}
                  disabled={timerRunning || timerSeconds <= 60}
                >
                  − 1 分钟
                </button>
                <button
                  className="timer-primary"
                  onClick={() => {
                    if (timerSeconds === 0) resetTimer();
                    else if (timerRunning) pauseTimer();
                    else startTimer();
                  }}
                >
                  {timerRunning ? (
                    <>
                      <Pause size={17} />
                      暂停
                    </>
                  ) : (
                    <>
                      <Play size={17} />
                      {timerSeconds === 0 ? '重置' : '开始'}
                    </>
                  )}
                </button>
                <button
                  onClick={() => setTimerSeconds((seconds) => Math.min(90 * 60, seconds + 60))}
                  disabled={timerRunning}
                >
                  + 1 分钟
                </button>
              </div>
              <button className="timer-reset" onClick={() => resetTimer()}>
                重置为 10 分钟
              </button>
            </div>
          )}
        </div>
      )}
      {startupProgress < 100 && (
        <div className="startup-overlay" role="status" aria-live="polite">
          <div className="startup-card">
            <div className="startup-logo">Yi+</div>
            <div className="startup-title">DY Board 正在启动</div>
            <div className="startup-caption">正在准备白板空间</div>
            <div className="startup-progress">
              <span style={{ width: `${startupProgress}%` }} />
            </div>
            <div className="startup-countdown">
              {Math.max(0, Math.ceil((100 - startupProgress) / 20))} 秒
            </div>
            <div className="startup-class">本节课：{currentClass ? currentClass.name : '无'}</div>
          </div>
        </div>
      )}
      {panel === 'developer' && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPanel(null);
          }}
        >
          <section className="info-modal developer-modal">
            <button className="modal-close" onClick={() => setPanel(null)} aria-label="关闭">
              <X size={18} />
            </button>
            <div className="developer-mark">
              <span className="brand-glyph">Yi+</span>
            </div>
            <span className="eyebrow">DY BOARD</span>
            <h2>开发者</h2>
            <p className="developer-name">
              戴亿 <span>Developer</span>
            </p>
            <div className="contact-list">
              <a href="mailto:1703205607@qq.com">
                <span>QQ 邮箱</span>
                <b>1703205607@qq.com</b>
              </a>
              <a
                href="https://mail.google.com/mail/?view=cm&to=daiy91004@gmail.com"
                target="_blank"
                rel="noreferrer"
              >
                <span>Gmail</span>
                <b>daiy91004@gmail.com</b>
              </a>
              <a
                href="https://wpa.qq.com/msgrd?v=3&uin=1703205607&site=qq&menu=yes"
                target="_blank"
                rel="noreferrer"
              >
                <span>QQ</span>
                <b>1703205607</b>
              </a>
              <a
                href="https://www.douyin.com/user/self?modal_id=0"
                target="_blank"
                rel="noreferrer"
              >
                <span>抖音</span>
                <b>daiyi091004</b>
              </a>
            </div>
            <div className="modal-bottom">
              DY Board <span>版本 {APP_VERSION}</span>
            </div>
          </section>
        </div>
      )}
      {panel === 'help' && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPanel(null);
          }}
        >
          <section className="info-modal">
            <button className="modal-close" onClick={() => setPanel(null)} aria-label="关闭">
              <X size={18} />
            </button>
            <span className="eyebrow">DY BOARD</span>
            <h2>快速操作</h2>
            <p className="help-row">
              <b>书写</b>
              <span>底部选择画笔，点击“笔设置”调整颜色和粗细；选择工具可移动笔迹。</span>
            </p>
            <p className="help-row">
              <b>展台</b>
              <span>
                拍照后缩略图出现在右侧；在设置里切换设备、分辨率和画面适配，在底部旋转、冻结或恢复。
              </span>
            </p>
            <p className="help-row">
              <b>高级</b>
              <span>全屏时钟、课堂倒计时、激光指示器和屏幕放大镜都可从底部“高级”进入。</span>
            </p>
            <div className="modal-bottom">
              白板工程不会自动保存；点击底部“保存”可保存到本机并下载 JSON 备份。界面偏好会单独记忆；菜单中可设置、检查更新、查看关于或退出软件。
            </div>
          </section>
        </div>
      )}
      {updateNoticeVisible && updateState.status !== 'idle' && (
        <aside className="update-notice" role="status" aria-live="polite" aria-atomic="true">
          <div className="update-notice-mark">
            <RefreshCw size={18} />
          </div>
          <div className="update-notice-copy">
            <b>{updateHeading}</b>
            <span>{updateDescription}</span>
            {updateState.status === 'downloading' && (
              <div
                className="update-progress"
                role="progressbar"
                aria-label="更新下载进度"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(updateState.percent ?? 0)}
              >
                <i style={{ width: `${Math.max(0, Math.min(100, updateState.percent ?? 0))}%` }} />
              </div>
            )}
          </div>
          <div className="update-notice-actions">
            {updateState.status === 'available' &&
              updateState.source === 'desktop' &&
              updateState.action === 'download' && (
                <button className="update-action-primary" onClick={() => void downloadUpdate()}>
                  <Download size={15} /> 下载更新
                </button>
              )}
            {((updateState.status === 'available' && updateState.action === 'release') ||
              (updateState.status === 'unsupported' && updateState.action === 'release')) && (
              <button className="update-action-primary" onClick={() => void openReleasePage()}>
                <ExternalLink size={15} /> 打开 Release
              </button>
            )}
            {updateState.status === 'available' && updateState.source === 'pwa' && (
              <button className="update-action-primary" onClick={applyPwaUpdate}>
                刷新应用
              </button>
            )}
            {updateState.status === 'downloaded' && updateState.source === 'desktop' && (
              <button className="update-action-primary" onClick={() => void installUpdate()}>
                现在重启更新
              </button>
            )}
            {updateState.status === 'error' && (
              <button className="update-action-secondary" onClick={() => void checkForUpdates()}>
                重新检查
              </button>
            )}
            <button
              className="update-dismiss"
              onClick={() => setUpdateNoticeVisible(false)}
              aria-label="关闭更新提示"
              title="稍后处理"
            >
              <X size={16} />
            </button>
          </div>
        </aside>
      )}
    </main>
  );
}
