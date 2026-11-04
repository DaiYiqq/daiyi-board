import { useEffect, useRef, useState } from 'react';
import type { TeachingTool } from './registry';
import { getTool } from './registry';

export type ToolElement = {
  id: string;
  toolId: string;
  toolVersion: string;
  params: Record<string, unknown>;
  x: number; // 0..1
  y: number; // 0..1
  w: number; // 0..1
  h: number; // 0..1
  snapshot?: string; // dataURL，快照/恢复兜底
};

type Props = {
  element: ToolElement;
  stageW: number;
  stageH: number;
  selected: boolean;
  focused: boolean;
  onSelect: (id: string) => void;
  onBeforeChange: () => void;
  onUpdate: (id: string, patch: Partial<ToolElement>) => void;
  onDelete: (id: string) => void;
  onSnapshot: (id: string, dataUrl: string) => void;
  onFocus: (id: string) => void;
  onExitFocus: () => void;
  onBringToFront: (id: string) => void;
  onResetParams: (id: string) => void;
};

const ALLOWED_TOOL_MESSAGES = new Set(['tool:ready', 'tool:snapshot', 'tool:state-changed']);
function isValidToolMessage(value: unknown): value is { type: string; dataUrl?: unknown; state?: unknown } {
  if (!value || typeof value !== 'object') return false;
  const type = (value as { type?: unknown }).type;
  return typeof type === 'string' && ALLOWED_TOOL_MESSAGES.has(type);
}

export default function ToolElement({
  element,
  stageW,
  stageH,
  selected,
  focused,
  onSelect,
  onBeforeChange,
  onUpdate,
  onDelete,
  onSnapshot,
  onFocus,
  onExitFocus,
  onBringToFront,
  onResetParams,
}: Props) {
  const tool: TeachingTool | undefined = getTool(element.toolId);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const missing = !tool;
  const versionMismatch = !!tool && tool.version !== '-' && tool.version !== element.toolVersion;

  const src =
    tool?.loadMode === 'local-iframe'
      ? `${import.meta.env.BASE_URL}${tool.localPath ?? ''}`
      : tool?.entryUrl ?? '';

  // 初始化消息：iframe 加载后下发参数与主题
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const onLoad = () => {
      iframe.contentWindow?.postMessage(
        { type: 'whiteboard:init', params: element.params, theme: 'dark' },
        '*',
      );
    };
    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [src, element.id]);

  // 参数变化 → 下发 set-params（对实现了协议的工具有效）
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'whiteboard:set-params', params: element.params },
      '*',
    );
  }, [element.params]);

  // 监听工具回传（带 origin/schema 校验）
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (!isValidToolMessage(e.data)) return;
      const d = e.data;
      if (d.type === 'tool:ready') setReady(true);
      else if (d.type === 'tool:snapshot') {
        if (typeof d.dataUrl === 'string' && d.dataUrl) onSnapshot(element.id, d.dataUrl);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [element.id, onSnapshot]);

  // 加载超时 → 错误卡
  useEffect(() => {
    setReady(false);
    setFailed(false);
    if (tool?.loadMode !== 'local-iframe') return;
    const t = window.setTimeout(() => {
      setReady((r) => {
        if (!r) setFailed(true);
        return r;
      });
    }, 8000);
    return () => window.clearTimeout(t);
  }, [src, tool?.loadMode]);

  const requestSnapshot = () => {
    // 协议工具：请求快照
    iframeRef.current?.contentWindow?.postMessage({ type: 'whiteboard:request-snapshot' }, '*');
    // 回退：同源本地 iframe 的 canvas 直接截图
    try {
      const doc = iframeRef.current?.contentDocument;
      const canvas = doc?.querySelector('canvas') as HTMLCanvasElement | null;
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        if (dataUrl && dataUrl !== 'data:,') onSnapshot(element.id, dataUrl);
      }
    } catch {
      /* 跨域或 sandbox 限制，忽略 */
    }
  };
  const refresh = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    setReady(false);
    setFailed(false);
    iframe.src = iframe.src; // 触发重新加载
  };

  // 拖动移动（顶栏）
  const startMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onBeforeChange();
    const startX = e.clientX;
    const startY = e.clientY;
    const baseX = element.x;
    const baseY = element.y;
    const move = (ev: PointerEvent) => {
      onUpdate(element.id, {
        x: Math.max(0, Math.min(1 - element.w, baseX + (ev.clientX - startX) / stageW)),
        y: Math.max(0, Math.min(1 - element.h, baseY + (ev.clientY - startY) / stageH)),
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // 缩放（右下角）
  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onBeforeChange();
    const startX = e.clientX;
    const startY = e.clientY;
    const baseW = element.w;
    const baseH = element.h;
    const move = (ev: PointerEvent) => {
      onUpdate(element.id, {
        w: Math.max(0.08, Math.min(1 - element.x, baseW + (ev.clientX - startX) / stageW)),
        h: Math.max(0.06, Math.min(1 - element.y, baseH + (ev.clientY - startY) / stageH)),
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const style: React.CSSProperties = {
    left: element.x * stageW,
    top: element.y * stageH,
    width: element.w * stageW,
    height: element.h * stageH,
  };

  return (
    <div
      className={`tool-element${selected ? ' is-selected' : ''}${focused ? ' is-focused' : ''}`}
      style={style}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(element.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onFocus(element.id);
      }}
    >
      {tool?.loadMode === 'local-iframe' || tool?.loadMode === 'remote-iframe' ? (
        <>
          <iframe
            ref={iframeRef}
            src={src}
            className="tool-iframe"
            title={tool?.name ?? '教学工具'}
            sandbox="allow-scripts allow-same-origin"
            referrerPolicy="no-referrer"
          />
          {failed && element.snapshot && (
            <img className="tool-fallback" src={element.snapshot} alt={tool?.name} />
          )}
          {!ready && !failed && !element.snapshot && (
            <div className="tool-loading">
              <div className="tool-skeleton" />
              <span>加载中…</span>
            </div>
          )}
          {failed && !element.snapshot && (
            <div className="tool-error">
              <span>加载失败</span>
              <button onClick={refresh}>重试</button>
            </div>
          )}
        </>
      ) : (
        <div className="tool-error">
          <span>{tool?.name ?? '未知工具'}</span>
          <a href={tool?.entryUrl ?? '#'} target="_blank" rel="noreferrer">
            在新窗口打开
          </a>
        </div>
      )}

      {(missing || versionMismatch) && (
        <div className="tool-banner">
          {missing
            ? '工具已下架或不可用'
            : `版本不兼容（保存 ${element.toolVersion}，当前 ${tool?.version}）`}
        </div>
      )}

      {selected && !focused && (
        <>
          <div className="tool-element-bar" onPointerDown={startMove}>
            <span>{tool?.name ?? '工具'}</span>
            <span className="tool-bar-actions">
              <button
                title="截图插入白板"
                onClick={(e) => {
                  e.stopPropagation();
                  requestSnapshot();
                }}
              >
                截图
              </button>
              <button
                title="重置参数"
                onClick={(e) => {
                  e.stopPropagation();
                  onResetParams(element.id);
                }}
              >
                重置
              </button>
              <button
                title="刷新"
                onClick={(e) => {
                  e.stopPropagation();
                  refresh();
                }}
              >
                刷新
              </button>
              <button
                title="置顶"
                onClick={(e) => {
                  e.stopPropagation();
                  onBringToFront(element.id);
                }}
              >
                置顶
              </button>
              <button
                title="全屏"
                onClick={(e) => {
                  e.stopPropagation();
                  onFocus(element.id);
                }}
              >
                全屏
              </button>
              <button
                title="删除"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(element.id);
                }}
              >
                删除
              </button>
            </span>
          </div>
          <div className="tool-resize-handle" onPointerDown={startResize} />
        </>
      )}

      {focused && (
        <div className="tool-focus-bar">
          <span>{tool?.name ?? '工具'}</span>
          <button onClick={onExitFocus}>退出全屏</button>
        </div>
      )}
    </div>
  );
}
