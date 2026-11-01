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
};

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
}: Props) {
  const tool: TeachingTool | undefined = getTool(element.toolId);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

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

  // 参数变化 → 下发 set-params（在 ready 之后才有效，但重复下发无害）
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'whiteboard:set-params', params: element.params },
      '*',
    );
  }, [element.params]);

  // 监听工具回传（ready / snapshot）
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data || {};
      if (d.type === 'tool:ready') setReady(true);
      else if (d.type === 'tool:snapshot') {
        if (typeof d.dataUrl === 'string' && d.dataUrl) onSnapshot(element.id, d.dataUrl);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [element.id, onSnapshot]);

  // 加载超时 → 错误卡（仅本地 iframe；远程用 link 不走这里）
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
    iframeRef.current?.contentWindow?.postMessage({ type: 'whiteboard:request-snapshot' }, '*');
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
    >
      {tool?.loadMode === 'local-iframe' ? (
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
          {!ready && !failed && !element.snapshot && <div className="tool-loading">加载中…</div>}
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

      {selected && !focused && (
        <>
          <div className="tool-element-bar" onPointerDown={startMove}>
            <span>{tool?.name ?? '工具'}</span>
            <span className="tool-bar-actions">
              <button
                title="截图"
                onClick={(e) => {
                  e.stopPropagation();
                  requestSnapshot();
                }}
              >
                截图
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
