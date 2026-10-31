import { useEffect, useRef, useState } from 'react';
import './MapStage.css';

// 高德地图 JS API Key 与安全密钥
const AMAP_KEY = '4bf8ad81001dbcaaf1d623e12a35b7c0';
const AMAP_SECURITY = '3fa94dace23e5db1f941e92fbd25cd2c';

declare global {
  interface Window {
    AMap?: {
      Map: new (el: HTMLElement, opts?: Record<string, unknown>) => {
        destroy?: () => void;
      };
      [key: string]: unknown;
    };
    _AMapSecurityConfig?: { securityJsCode?: string };
  }
}

type Status = 'loading' | 'ready' | 'error';

export default function MapStage({ onExit }: { onExit: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let map: { destroy?: () => void } | null = null;
    let cancelled = false;

    if (!AMAP_KEY || AMAP_KEY.startsWith('YOUR_')) {
      setStatus('error');
      setError('尚未配置高德地图 API Key。请在 src/components/MapStage.tsx 中填写 AMAP_KEY（以及可选的 AMAP_SECURITY）。');
      return;
    }

    const loadScript = (): Promise<void> =>
      new Promise((resolve, reject) => {
        if (window.AMap?.Map) return resolve();
        const s = document.createElement('script');
        s.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(AMAP_KEY)}`;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('高德地图脚本加载失败，请检查网络或 Key。'));
        document.head.appendChild(s);
      });

    // 安全密钥须在加载 JS API 之前注入
    if (AMAP_SECURITY) window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY };

    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.AMap?.Map) return;
        map = new window.AMap.Map(containerRef.current, {
          zoom: 11,
          center: [116.397428, 39.90923], // 默认北京
          viewMode: '2D',
        });
        setStatus('ready');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setError(e instanceof Error ? e.message : '地图加载失败。');
      });

    return () => {
      cancelled = true;
      map?.destroy?.();
    };
  }, []);

  return (
    <div className="map-stage" role="region" aria-label="地理地图">
      <div className="map-stage-toolbar">
        <span className="map-stage-title">地理地图 · 高德</span>
        <button className="map-stage-exit" onClick={onExit}>
          返回白板
        </button>
      </div>
      <div ref={containerRef} className="map-stage-container" />
      {status === 'loading' && <div className="map-stage-status">地图加载中…</div>}
      {status === 'error' && (
        <div className="map-stage-status map-stage-error">{error}</div>
      )}
    </div>
  );
}
