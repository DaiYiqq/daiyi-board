import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, Camera, Check, ChevronDown, CircleHelp,
  Eraser, FolderOpen, GripVertical, LayoutPanelLeft, Maximize2, Menu, Minus,
  MousePointer2, Palette, Pencil, Plus, Redo2, Save, SlidersHorizontal, Trash2,
  Undo2, X
} from 'lucide-react';

type Point = { x: number; y: number; pressure?: number };
type Mark = { id: string; kind: 'pen' | 'highlighter'; color: string; width: number; points: Point[] };
type Page = { id: string; title: string; marks: Mark[] };
type BoardData = { version: 1; pages: Page[]; activePage: string };
type Tool = 'select' | 'pen' | 'eraser';
type Preferences = { theme: 'dark' | 'light'; toolbarSide: 'left' | 'right'; compact: boolean; visibleTools: Tool[] };

const STORAGE_KEY = 'daiyi-board-v1';
const PREFS_KEY = 'daiyi-board-preferences-v1';
const COLORS = ['#1D2637', '#E95E52', '#3D77E8', '#13A879', '#F0B44D', '#A66BE8', '#0EA5A4', '#FFFFFF'];
const TOOL_LABEL: Record<Tool, string> = { select: '选择', pen: '画笔', eraser: '橡皮' };
const toolIcon = { select: MousePointer2, pen: Pencil, eraser: Eraser };
const defaultPrefs: Preferences = { theme: 'dark', toolbarSide: 'left', compact: false, visibleTools: ['select', 'pen', 'eraser'] };
const newPage = (n: number): Page => ({ id: crypto.randomUUID(), title: `白板 ${String(n).padStart(2, '0')}`, marks: [] });
const pressureWidth = (width: number, pressure = 0.5) => width * (0.45 + Math.max(0, Math.min(1, pressure)) * 0.9);
const boundsFor = (points: Point[]) => {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
};
const isValidPage = (value: unknown): value is Page => {
  if (!value || typeof value !== 'object') return false;
  const page = value as Page;
  if (typeof page.id !== 'string' || !page.id || typeof page.title !== 'string' || page.title.length > 80 || !Array.isArray(page.marks) || page.marks.length > 5000) return false;
  return page.marks.every((value: unknown) => {
    if (!value || typeof value !== 'object') return false;
    const mark = value as Mark;
    return typeof mark.id === 'string' && !!mark.id && (mark.kind === 'pen' || mark.kind === 'highlighter') && /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(mark.color) && Number.isFinite(mark.width) && mark.width > 0 && mark.width <= 64 && Array.isArray(mark.points) && mark.points.length > 0 && mark.points.length <= 10000 && mark.points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1 && (point.pressure === undefined || (Number.isFinite(point.pressure) && point.pressure >= 0 && point.pressure <= 1)));
  });
};
const isValidBoard = (value: unknown): value is BoardData => {
  if (!value || typeof value !== 'object') return false;
  const data = value as BoardData;
  return data.version === 1 && Array.isArray(data.pages) && data.pages.length > 0 && data.pages.length <= 200 && data.pages.every(isValidPage) && new Set(data.pages.map(page => page.id)).size === data.pages.length;
};

function readBoard(): BoardData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved) as unknown;
      if (isValidBoard(data)) return { ...data, activePage: data.pages.some(page => page.id === data.activePage) ? data.activePage : data.pages[0].id };
    }
  } catch { /* Ignore a corrupt autosave and start with a clean board. */ }
  const page = { id: 'welcome-board', title: '第一块白板', marks: [] };
  return { version: 1, pages: [page], activePage: page.id };
}
function readPrefs(): Preferences {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Record<string, unknown>;
    const tools = Array.isArray(raw.visibleTools) ? raw.visibleTools.filter((tool): tool is Tool => tool === 'select' || tool === 'pen' || tool === 'eraser') : defaultPrefs.visibleTools;
    return { theme: raw.theme === 'light' ? 'light' : 'dark', toolbarSide: raw.toolbarSide === 'right' ? 'right' : 'left', compact: typeof raw.compact === 'boolean' ? raw.compact : false, visibleTools: tools.length ? tools : defaultPrefs.visibleTools };
  } catch { return defaultPrefs; }
}
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
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(4);
  const [prefs, setPrefs] = useState<Preferences>(readPrefs);
  const [panel, setPanel] = useState<'customize' | 'developer' | 'help' | 'camera' | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [present, setPresent] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState('已自动保存');
  const [dragTool, setDragTool] = useState<Tool | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drawing = useRef<{ kind: 'new' | 'move' | 'resize'; mark?: Mark; id?: string; from?: Point; start?: Point; initial?: Point[]; bounds?: ReturnType<typeof boundsFor> } | null>(null);
  const [mediaDevices, setMediaDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraMarks, setCameraMarks] = useState<Mark[]>([]);
  const [cameraDraft, setCameraDraft] = useState<Point[] | null>(null);
  const active = pages.find(p => p.id === activePage) ?? pages[0];
  const activeIndex = Math.max(0, pages.findIndex(p => p.id === activePage));

  const commit = useCallback((next: Page[]) => {
    undoStack.current.push({ version: 1, pages: structuredClone(pagesRef.current), activePage: activeRef.current });
    if (undoStack.current.length > 60) undoStack.current.shift();
    redoStack.current = [];
    pagesRef.current = next;
    setPages(next);
    setDirty(true);
  }, []);
  const replaceCurrent = useCallback((marks: Mark[]) => {
    const next = pagesRef.current.map(p => p.id === activeRef.current ? { ...p, marks } : p);
    commit(next);
  }, [commit]);
  const undo = useCallback(() => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push({ version: 1, pages: structuredClone(pagesRef.current), activePage: activeRef.current });
    const restoredActive = previous.pages.some(page => page.id === previous.activePage) ? previous.activePage : previous.pages[0].id;
    pagesRef.current = previous.pages; activeRef.current = restoredActive; setPages(previous.pages); setActivePage(restoredActive); setSelected(null); setDirty(true);
  }, []);
  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push({ version: 1, pages: structuredClone(pagesRef.current), activePage: activeRef.current });
    const restoredActive = next.pages.some(page => page.id === next.activePage) ? next.activePage : next.pages[0].id;
    pagesRef.current = next.pages; activeRef.current = restoredActive; setPages(next.pages); setActivePage(restoredActive); setSelected(null); setDirty(true);
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
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const mark of active?.marks ?? []) {
      if (!mark.points.length) continue;
      if (mark.points.length === 1) {
        ctx.beginPath(); ctx.arc(mark.points[0].x * bounds.width, mark.points[0].y * bounds.height, Math.max(1, mark.width / 2), 0, Math.PI * 2);
        ctx.fillStyle = mark.color; ctx.fill(); continue;
      }
      ctx.strokeStyle = mark.kind === 'highlighter' ? `${mark.color}65` : mark.color;
      for (let i = 1; i < mark.points.length; i++) {
        const a = mark.points[i - 1], b = mark.points[i];
        ctx.beginPath(); ctx.moveTo(a.x * bounds.width, a.y * bounds.height); ctx.lineTo(b.x * bounds.width, b.y * bounds.height);
        ctx.lineWidth = pressureWidth(mark.width, b.pressure); ctx.stroke();
      }
    }
    if (selected && active?.marks.some(m => m.id === selected)) {
      const item = active.marks.find(m => m.id === selected)!;
      if (item.points.length) {
        const box = boundsFor(item.points);
        const pad = 14;
        ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = '#1eb8c7'; ctx.lineWidth = 1.5;
        ctx.strokeRect(box.minX * bounds.width - pad, box.minY * bounds.height - pad, (box.maxX - box.minX) * bounds.width + pad * 2, (box.maxY - box.minY) * bounds.height + pad * 2);
        ctx.setLineDash([]); ctx.fillStyle = '#22d3ee'; ctx.fillRect(box.maxX * bounds.width + pad - 4, box.maxY * bounds.height + pad - 4, 8, 8);
        ctx.restore();
      }
    }
  }, [active, selected, panel, zoom, pages, layoutTick]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, pages, activePage } satisfies BoardData));
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [pages, activePage, prefs]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (dirty) { setSavedAt(`刚刚保存 · ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`); setDirty(false); }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [dirty]);
  useEffect(() => {
    const resize = () => setLayoutTick(tick => tick + 1);
    window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      if (e.key === 'Escape') { setPresent(false); setPanel(null); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const pointAt = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const r = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (event.clientY - r.top) / r.height)), pressure: event.pressure || 0.5 };
  };
  const onCanvasDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (panel) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointAt(event);
    if (tool === 'eraser') {
      const remaining = active.marks.filter(mark => !mark.points.some(p => distance(p, point) < Math.max(0.025, width / 900)));
      if (remaining.length !== active.marks.length) replaceCurrent(remaining);
      return;
    }
    if (tool === 'select') {
      const selectedMark = active.marks.find(mark => mark.id === selected);
      if (selectedMark?.points.length) {
        const r = event.currentTarget.getBoundingClientRect(), box = boundsFor(selectedMark.points);
        const handle = { x: box.maxX + 14 / r.width, y: box.maxY + 14 / r.height };
        if (distance(point, handle) < Math.max(0.02, 20 / Math.min(r.width, r.height))) {
          drawing.current = { kind: 'resize', id: selectedMark.id, start: point, initial: structuredClone(selectedMark.points), bounds: box };
          return;
        }
      }
      const hit = [...active.marks].reverse().find(mark => mark.points.some(p => distance(p, point) < 0.035));
      setSelected(hit?.id ?? null);
      if (hit) drawing.current = { kind: 'move', id: hit.id, start: point, from: hit.points[0] };
      return;
    }
    setSelected(null);
    drawing.current = { kind: 'new', mark: { id: crypto.randomUUID(), kind: 'pen', color, width, points: [point] } };
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
        ctx.beginPath(); const pts = action.mark.points;
        const a = pts[Math.max(0, pts.length - 2)], b = pts[pts.length - 1];
        ctx.moveTo(a.x * r.width, a.y * r.height); ctx.lineTo(b.x * r.width, b.y * r.height);
        ctx.strokeStyle = color; ctx.lineWidth = pressureWidth(width, b.pressure); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      }
    } else if ((action.kind === 'move' || action.kind === 'resize') && action.id && action.start) {
      let next: Mark[];
      if (action.kind === 'move') {
        const dx = point.x - action.start.x, dy = point.y - action.start.y;
        next = active.marks.map(m => m.id === action.id ? { ...m, points: m.points.map(p => ({ ...p, x: Math.max(0, Math.min(1, p.x + dx)), y: Math.max(0, Math.min(1, p.y + dy)) })) } : m);
      } else if (action.initial && action.bounds) {
        const box = action.bounds, start = action.start;
        const sx = Math.max(0.12, (box.maxX - box.minX + point.x - start.x) / Math.max(0.02, box.maxX - box.minX));
        const sy = Math.max(0.12, (box.maxY - box.minY + point.y - start.y) / Math.max(0.02, box.maxY - box.minY));
        const scale = Math.max(0.12, Math.min(6, (sx + sy) / 2));
        const resized = action.initial.map(p => ({ ...p, x: Math.max(0, Math.min(1, box.minX + (p.x - box.minX) * scale)), y: Math.max(0, Math.min(1, box.minY + (p.y - box.minY) * scale)) }));
        next = active.marks.map(m => m.id === action.id ? { ...m, points: resized } : m);
      } else return;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d'), r = canvas.getBoundingClientRect();
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.scale(dpr, dpr);
          for (const mark of next) {
            if (mark.points.length === 1) { ctx.beginPath(); ctx.arc(mark.points[0].x * r.width, mark.points[0].y * r.height, Math.max(1, mark.width / 2), 0, Math.PI * 2); ctx.fillStyle = mark.color; ctx.fill(); continue; }
            ctx.strokeStyle = mark.color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            for (let i = 1; i < mark.points.length; i++) { const a = mark.points[i - 1], b = mark.points[i]; ctx.beginPath(); ctx.moveTo(a.x * r.width, a.y * r.height); ctx.lineTo(b.x * r.width, b.y * r.height); ctx.lineWidth = pressureWidth(mark.width, b.pressure); ctx.stroke(); }
          }
          ctx.restore();
        }
      }
      movingPreview.current = next;
    }
  };
  const movingPreview = useRef<Page['marks'] | null>(null);
  const finishDrawing = () => {
    const action = drawing.current; drawing.current = null;
    if (!action) return;
    if (action.kind === 'new' && action.mark) replaceCurrent([...active.marks, action.mark]);
    if ((action.kind === 'move' || action.kind === 'resize') && movingPreview.current) { replaceCurrent(movingPreview.current); movingPreview.current = null; }
  };

  const addPage = () => {
    const page = newPage(pagesRef.current.length + 1);
    commit([...pagesRef.current, page]); activeRef.current = page.id; setActivePage(page.id); setSelected(null);
  };
  const clearPage = () => { if (active.marks.length && window.confirm('清空当前白板？此操作可以撤销。')) replaceCurrent([]); };
  const deletePage = (pageId: string) => {
    if (pagesRef.current.length < 2) { window.alert('至少保留一页白板。'); return; }
    if (!window.confirm('删除此白板页面？此操作可以撤销。')) return;
    const oldIndex = pagesRef.current.findIndex(page => page.id === pageId);
    const next = pagesRef.current.filter(page => page.id !== pageId);
    const nextActive = pageId === activeRef.current ? next[Math.min(Math.max(0, oldIndex - 1), next.length - 1)] : next.find(page => page.id === activeRef.current) ?? next[0];
    commit(next); activeRef.current = nextActive.id; setActivePage(nextActive.id); setSelected(null);
  };
  const renamePage = (pageId: string) => {
    const page = pagesRef.current.find(item => item.id === pageId);
    if (!page) return;
    const title = window.prompt('为白板页面命名', page.title)?.trim();
    if (title && title !== page.title) commit(pagesRef.current.map(item => item.id === pageId ? { ...item, title } : item));
  };
  const deleteSelected = () => { if (selected) { replaceCurrent(active.marks.filter(m => m.id !== selected)); setSelected(null); } };
  const saveFile = () => {
    const file = new Blob([JSON.stringify({ version: 1, pages, activePage }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file); const a = document.createElement('a'); a.href = url; a.download = `白板工程-${new Date().toISOString().slice(0, 10)}.daiyi-board.json`; a.click(); URL.revokeObjectURL(url); setSavedAt('工程已导出'); setDirty(false);
  };
  const openFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('文件过大');
      const raw = JSON.parse(await file.text()) as unknown;
      if (!raw || typeof raw !== 'object') throw new Error('格式不正确');
      const parsed = raw as BoardData;
      if (!isValidBoard(parsed)) throw new Error('格式不正确');
      const nextActive = parsed.pages.some(page => page.id === parsed.activePage) ? parsed.activePage : parsed.pages[0].id;
      commit(parsed.pages); setActivePage(nextActive); activeRef.current = nextActive; setSavedAt('工程已打开');
    } catch { window.alert('无法打开该白板工程。请确认文件来自戴亿白板导出的 .json 文件。'); }
    event.target.value = '';
  };
  const moveTool = (target: Tool) => {
    if (!dragTool || dragTool === target) return;
    const order = [...prefs.visibleTools], from = order.indexOf(dragTool), to = order.indexOf(target);
    order.splice(from, 1); order.splice(to, 0, dragTool);
    setPrefs({ ...prefs, visibleTools: order }); setDragTool(null);
  };
  const toggleToolVisibility = (target: Tool) => {
    const visible = prefs.visibleTools.includes(target) ? prefs.visibleTools.filter(id => id !== target) : [...prefs.visibleTools, target];
    if (!visible.length) return;
    setPrefs({ ...prefs, visibleTools: visible });
  };
  const refreshCameras = async () => {
    try {
      const list = await navigator.mediaDevices?.enumerateDevices();
      const cameras = (list ?? []).filter(d => d.kind === 'videoinput');
      setMediaDevices(cameras); if (cameras.length && !cameraId) setCameraId(cameras[0].deviceId);
    } catch { setMediaDevices([]); }
  };
  const startCamera = async (deviceId = cameraId) => {
    try {
      stream?.getTracks().forEach(track => track.stop());
      const next = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : true, audio: false });
      setStream(next); setPanel('camera');
      const devices = await navigator.mediaDevices.enumerateDevices(); setMediaDevices(devices.filter(d => d.kind === 'videoinput'));
    } catch (error) { setStream(null); window.alert(`无法打开摄像头：${error instanceof Error ? error.message : '请检查系统权限或连接状态。'}`); }
  };
  useEffect(() => { if (videoRef.current && stream) videoRef.current.srcObject = stream; }, [stream, panel]);
  useEffect(() => {
    if (panel !== 'camera') return;
    void refreshCameras();
    const handler = () => void refreshCameras();
    navigator.mediaDevices?.addEventListener?.('devicechange', handler);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', handler);
  }, [panel]);
  const exitCamera = () => { stream?.getTracks().forEach(track => track.stop()); setStream(null); setPanel(null); setCameraDraft(null); };
  const cameraPoint = (e: ReactPointerEvent<SVGSVGElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }; };
  const cameraDown = (e: ReactPointerEvent<SVGSVGElement>) => { e.currentTarget.setPointerCapture(e.pointerId); setCameraDraft([cameraPoint(e)]); };
  const cameraMove = (e: ReactPointerEvent<SVGSVGElement>) => { if (cameraDraft) setCameraDraft([...cameraDraft, cameraPoint(e)]); };
  const cameraUp = () => { if (cameraDraft?.length) setCameraMarks([...cameraMarks, { id: crypto.randomUUID(), kind: 'pen', color, width, points: cameraDraft }]); setCameraDraft(null); };

  return (
    <main className={`app-shell theme-${prefs.theme} ${prefs.compact ? 'is-compact' : ''} ${present ? 'is-present' : ''}`}>
      {!present && <aside className="nav-rail">
        <button className="brand-mark" title="DaiYi Board"><span className="brand-glyph"><i /><i /><i /></span></button>
        <div className="rail-divider" />
        <button className="rail-button active" title="白板"><LayoutPanelLeft size={19} /><span>白板</span></button>
        <button className="rail-button" title="摄像展台" onClick={() => void startCamera()}><Camera size={19} /><span>展台</span></button>
        <div className="rail-spacer" />
        <button className="rail-button" title="自定义界面" onClick={() => setPanel('customize')}><SlidersHorizontal size={19} /><span>自定义</span></button>
        <button className="rail-button" title="开发者" onClick={() => setPanel('developer')}><CircleHelp size={19} /><span>关于</span></button>
        <div className="rail-profile">戴</div>
      </aside>}
      <section className="workspace">
        {!present && <header className="topbar">
          <div className="crumb"><span className="crumb-overline">DAIYI BOARD / WORKSPACE</span><div className="crumb-title">公开课演示 <ChevronDown size={14} /></div></div>
          <div className="top-meta"><span className="save-indicator"><i />{savedAt}</span><span className="meta-divider" /><span className="page-counter">第 {String(activeIndex + 1).padStart(2, '0')} 页</span></div>
          <div className="top-actions">
            <button className="icon-button" title="撤销 (Ctrl+Z)" onClick={undo} disabled={!undoStack.current.length}><Undo2 size={17} /></button>
            <button className="icon-button" title="重做 (Ctrl+Y)" onClick={redo} disabled={!redoStack.current.length}><Redo2 size={17} /></button>
            <span className="meta-divider" />
            <button className="top-button" onClick={() => fileRef.current?.click()}><FolderOpen size={15} />打开</button>
            <button className="top-button" onClick={saveFile}><Save size={15} />保存工程</button>
            <button className="present-button" onClick={() => setPresent(true)}><Maximize2 size={15} />演示模式</button>
            <button className="icon-button mobile-menu" title="菜单" onClick={() => setPanel('customize')}><Menu size={18} /></button>
          </div>
          <input ref={fileRef} className="hidden-input" type="file" accept=".json,.daiyi-board.json,application/json" onChange={openFile} />
        </header>}
        {present && <div className="presentation-head"><span className="present-dot" />演示模式 <button className="top-button" onClick={() => setPresent(false)}><X size={15} />退出演示</button></div>}

        {panel === 'camera' ? (
          <section className="camera-workspace">
            <div className="camera-toolbar"><div><span className="live-dot" />展台模式 <span className="camera-hint">画面批注仅保存在当前会话</span></div><div className="camera-actions">
              <select value={cameraId} onChange={e => { setCameraId(e.target.value); void startCamera(e.target.value); }} aria-label="选择摄像头" disabled={!mediaDevices.length}>
                {!mediaDevices.length && <option>未发现摄像设备</option>}{mediaDevices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `摄像头 ${i + 1}`}</option>)}
              </select><button className="icon-button" title="重新扫描摄像头" onClick={() => void refreshCameras()}><ArrowDownToLine size={16} /></button><button className="icon-button" title="擦除本次批注" onClick={() => setCameraMarks([])}><Eraser size={16} /></button><button className="exit-stage" onClick={exitCamera}><X size={16} />退出展台</button>
            </div></div>
            <div className="camera-stage"><video ref={videoRef} autoPlay playsInline muted />{!stream && <div className="camera-empty"><div className="camera-empty-icon"><Camera size={28} /></div><h2>摄像头已就绪</h2><p>选择设备开始实时展示，可以直接在画面上批注。</p><button className="present-button" onClick={() => void startCamera(cameraId)}><Camera size={16} />启动摄像头</button></div>}
              <svg className="annotation-layer" viewBox="0 0 1 1" preserveAspectRatio="none" onPointerDown={cameraDown} onPointerMove={cameraMove} onPointerUp={cameraUp} onPointerCancel={cameraUp}>
                {cameraMarks.map(mark => <polyline key={mark.id} points={mark.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={mark.color} strokeWidth={Math.max(0.002, mark.width / 1100)} strokeLinecap="round" strokeLinejoin="round" />)}
                {cameraDraft && <polyline points={cameraDraft.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color} strokeWidth={Math.max(0.002, width / 1100)} strokeLinecap="round" strokeLinejoin="round" />}
              </svg>
            </div>
            <div className="camera-bottom"><div className="camera-colors"><span>批注颜色</span>{COLORS.slice(0, 6).map(c => <button key={c} className={`color-dot ${color === c ? 'chosen' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`选择颜色 ${c}`} />)}</div><label className="width-control">笔触 <input type="range" min="2" max="14" value={width} onChange={e => setWidth(Number(e.target.value))} /></label><span className="camera-bottom-note">画面只在本地设备内处理，不会上传</span></div>
          </section>
        ) : (
          <section className="board-area">
            <div className="board-toolbar" style={{ [prefs.toolbarSide]: '22px' } as React.CSSProperties}>
              {prefs.visibleTools.map((id, index) => { const Icon = toolIcon[id]; return <button key={id} draggable onDragStart={() => setDragTool(id)} onDragOver={e => e.preventDefault()} onDrop={() => moveTool(id)} onDragEnd={() => setDragTool(null)} className={`tool-button ${tool === id ? 'selected' : ''}`} onClick={() => setTool(id)} title={`${TOOL_LABEL[id]} · 拖动排序`}><Icon size={19} /><span className="tool-tip">{TOOL_LABEL[id]}</span>{index === 0 && <span className="tool-grip"><GripVertical size={12} /></span>}</button>; })}
              <span className="toolbar-line" />
              <button className="tool-button" onClick={() => setPanel('customize')} title="画笔颜色"><Palette size={18} /><span className="color-chip" style={{ background: color }} /></button>
              <button className="tool-button" onClick={() => setWidth(width >= 10 ? 3 : width + 2)} title={`笔触 ${width}px`}><span className="stroke-preview" style={{ width: 6 + width, height: Math.max(2, width / 2), background: color }} /></button>
              {selected && <button className="tool-button delete-tool" onClick={deleteSelected} title="删除所选"><Trash2 size={17} /></button>}
            </div>
            <div className="canvas-stage" onClick={() => { if (panel) setPanel(null); }}>
              <div className="canvas-label"><span className="label-marker" />无标题课堂 <span className="label-slash">/</span> {active?.title}</div>
              <div className="canvas-wrap" style={{ transform: `scale(${zoom / 100})` }}>
                <div className="paper-sheet">
                  <div className="paper-grid" />
                  <div className="page-heading"><span>LESSON NOTE <span className="heading-dot">·</span> 01</span><h1>{active?.title === '第一块白板' ? '今天，一起把想法<br />画出来。' : active?.title}</h1><p>好的问题，是理解的开始。</p></div>
                  <div className="paper-watermark"><span>DAIYI</span><i /> WHITEBOARD</div>
                  <canvas ref={canvasRef} className={`drawing-canvas ${tool === 'pen' ? 'pen-cursor' : tool === 'eraser' ? 'eraser-cursor' : 'select-cursor'}`} onPointerDown={onCanvasDown} onPointerMove={onCanvasMove} onPointerUp={finishDrawing} onPointerCancel={finishDrawing} />
                  <span className="paper-footnote">{String(activeIndex + 1).padStart(2, '0')} / {String(pages.length).padStart(2, '0')}</span>
                </div>
              </div>
              <div className="canvas-hint"><span className="keycap">{tool === 'pen' ? '✦' : tool === 'select' ? '↖' : '⌫'}</span>{tool === 'pen' ? '在画布上书写或绘制' : tool === 'select' ? '点选后拖动移动，拉动右下角手柄缩放' : '点击笔迹即可擦除'}</div>
              {panel === 'customize' && <div className="customizer-popover" onClick={e => e.stopPropagation()}>
                <div className="popover-head"><div><span className="eyebrow">YOUR WORKSPACE</span><h3>调一调，顺手就好。</h3></div><button className="icon-button" onClick={() => setPanel(null)}><X size={17} /></button></div>
                <div className="setting-group"><div className="setting-label">界面主题</div><div className="theme-switch"><button className={prefs.theme === 'dark' ? 'is-on' : ''} onClick={() => setPrefs({ ...prefs, theme: 'dark' })}><span className="theme-preview dark-preview" />墨色</button><button className={prefs.theme === 'light' ? 'is-on' : ''} onClick={() => setPrefs({ ...prefs, theme: 'light' })}><span className="theme-preview light-preview" />明亮</button></div></div>
                <div className="setting-group"><div className="setting-label">画笔颜色</div><div className="swatches">{COLORS.map(c => <button key={c} className={`swatch ${color === c ? 'is-on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`画笔颜色 ${c}`}>{color === c && <Check size={13} color={c === '#FFFFFF' ? '#111827' : '#fff'} />}</button>)}<label className="custom-color"><input type="color" value={color} onChange={e => setColor(e.target.value)} /><Plus size={15} /></label></div></div>
                <div className="setting-group"><div className="setting-row"><div><div className="setting-label">笔触粗细</div><div className="setting-sub">{width}px · 压感笔兼容</div></div><input className="range-slider" type="range" min="2" max="16" value={width} onChange={e => setWidth(Number(e.target.value))} /></div></div>
                <div className="setting-group"><div className="setting-label">工具栏位置</div><div className="segmented"><button className={prefs.toolbarSide === 'left' ? 'is-on' : ''} onClick={() => setPrefs({ ...prefs, toolbarSide: 'left' })}><ArrowLeft size={14} />左侧</button><button className={prefs.toolbarSide === 'right' ? 'is-on' : ''} onClick={() => setPrefs({ ...prefs, toolbarSide: 'right' })}>右侧<ArrowRight size={14} /></button></div></div>
                <div className="setting-group"><div className="setting-row"><div><div className="setting-label">紧凑工具栏</div><div className="setting-sub">收窄控件间距</div></div><button className={`toggle ${prefs.compact ? 'on' : ''}`} onClick={() => setPrefs({ ...prefs, compact: !prefs.compact })}><i /></button></div></div>
                <div className="setting-group"><div className="setting-label">常用工具</div><div className="tool-toggles">{(['select', 'pen', 'eraser'] as Tool[]).map(id => <button key={id} className={prefs.visibleTools.includes(id) ? 'is-on' : ''} onClick={() => toggleToolVisibility(id)}>{prefs.visibleTools.includes(id) && <Check size={12} />}{TOOL_LABEL[id]}</button>)}</div></div>
                <div className="popover-foot"><GripVertical size={14} />拖动工具栏图标即可重新排序</div>
              </div>}
            </div>
            {!present && <footer className="page-strip"><div className="page-strip-left"><span className="strip-label">页面</span><button className="strip-add" onClick={addPage}><Plus size={14} />新建页面</button><button className="strip-action" onClick={clearPage} title="清空当前页面"><Trash2 size={15} /></button></div><div className="page-thumbnails">
              {pages.map((page, index) => <div key={page.id} className={`page-thumb ${page.id === activePage ? 'active' : ''}`} role="button" tabIndex={0} title="单击切换 · 双击重命名" onClick={() => { setActivePage(page.id); activeRef.current = page.id; setSelected(null); }} onDoubleClick={() => renamePage(page.id)} onKeyDown={e => { if (e.key === 'Enter') { setActivePage(page.id); activeRef.current = page.id; } }}><span className="thumb-number">{String(index + 1).padStart(2, '0')}</span><span className="thumb-scribble">{page.marks.length ? '✳' : '—'}</span><span className="thumb-title">{page.title}</span>{pages.length > 1 && page.id === activePage && <button className="thumb-delete" title="删除当前页" onClick={e => { e.stopPropagation(); deletePage(page.id); }}><X size={11} /></button>}</div>)}
              <button className="page-add-card" onClick={addPage}><Plus size={17} /></button>
            </div><div className="zoom-control"><button onClick={() => setZoom(Math.max(60, zoom - 10))}><Minus size={14} /></button><span>{zoom}%</span><button onClick={() => setZoom(Math.min(140, zoom + 10))}><Plus size={14} /></button></div></footer>}
          </section>
        )}
      </section>

      {panel === 'developer' && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setPanel(null); }}><section className="info-modal developer-modal"><button className="modal-close" onClick={() => setPanel(null)}><X size={18} /></button><div className="developer-mark"><span className="brand-glyph"><i /><i /><i /></span></div><span className="eyebrow">MADE FOR IDEAS · MADE BY A PERSON</span><h2>开发者</h2><p className="developer-name">戴亿 <span>Creator & Developer</span></p><div className="contact-list"><a href="mailto:1703205607@qq.com"><span>QQ 邮箱</span><b>1703205607@qq.com</b><ArrowRight size={15} /></a><a href="https://mail.google.com/mail/?view=cm&to=daiy91004@gmail.com" target="_blank" rel="noreferrer"><span>Gmail</span><b>daiy91004@gmail.com</b><ArrowRight size={15} /></a><a href="https://wpa.qq.com/msgrd?v=3&uin=1703205607&site=qq&menu=yes" target="_blank" rel="noreferrer"><span>QQ</span><b>1703205607</b><ArrowRight size={15} /></a><a href="https://www.douyin.com/user/self?modal_id=0" target="_blank" rel="noreferrer"><span>抖音</span><b>daiyi091004</b><ArrowRight size={15} /></a></div><div className="modal-bottom">白板 · DaiYi Board <span>版本 0.1.0</span></div></section></div>}
      {panel === 'help' && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setPanel(null); }}><section className="info-modal"><button className="modal-close" onClick={() => setPanel(null)}><X size={18} /></button><span className="eyebrow">QUICK GUIDE</span><h2>几笔之间，思路就清楚了。</h2><p className="help-row"><b>绘制</b><span>选择画笔，在画布上拖动即可书写。触控笔压力由浏览器/设备驱动支持。</span></p><p className="help-row"><b>整理</b><span>选择工具点击笔迹并拖动；按 Ctrl/⌘ + Z 撤销，Ctrl/⌘ + Y 重做。</span></p><p className="help-row"><b>展台</b><span>选择摄像设备，允许系统访问摄像头后即可边展示边批注。</span></p><div className="modal-bottom">工程保存在此设备浏览器的本地存储中。</div></section></div>}
      {!present && panel !== 'camera' && <button className="help-button" title="使用帮助" onClick={() => setPanel('help')}><CircleHelp size={17} /></button>}
      {present && <button className="present-exit" onClick={() => setPresent(false)}><X size={16} />退出演示</button>}
    </main>
  );
}
