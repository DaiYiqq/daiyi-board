import { useEffect, useRef, useState } from 'react';
import './MapStage.css';

// 高德地图 JS API Key 与安全密钥
const AMAP_KEY = '4bf8ad81001dbcaaf1d623e12a35b7c0';
const AMAP_SECURITY = '3fa94dace23e5db1f941e92fbd25cd2c';

declare global {
  interface Window {
    AMap?: {
      Map: new (el: HTMLElement, opts?: Record<string, unknown>) => AMapMap;
    };
    _AMapSecurityConfig?: { securityJsCode?: string };
  }
}
interface AMapMap {
  resize?: () => void;
  destroy?: () => void;
}

type Status = 'loading' | 'ready' | 'error';

export default function MapStage({ onExit }: { onExit: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<AMapMap | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    const onResize = () => mapRef.current?.resize?.();

    const initMap = () => {
      const el = containerRef.current;
      if (cancelled || !el) return;
      if (!window.AMap?.Map) {
        setStatus('error');
        setError('高德地图 API 未加载成功，请检查 Key 或网络。');
        return;
      }
      if (el.clientWidth === 0 || el.clientHeight === 0) {
        setStatus('error');
        setError('地图容器尺寸为 0，无法初始化。');
        return;
      }
      try {
        const map = new window.AMap.Map(el, {
          zoom: 11,
          center: [116.397428, 39.90923], // 默认北京
          viewMode: '2D',
        });
        mapRef.current = map;
        setStatus('ready');
        // 容器尺寸变化时同步地图尺寸，避免空白
        if (typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(onResize);
          observer.observe(el);
        }
        window.addEventListener('resize', onResize);
      } catch (e) {
        setStatus('error');
        setError(e instanceof Error ? e.message : '地图初始化失败。');
      }
    };

    const cleanup = () => {
      cancelled = true;
      observer?.disconnect();
      window.removeEventListener('resize', onResize);
      mapRef.current?.destroy?.();
      mapRef.current = null;
    };

    if (!AMAP_KEY || AMAP_KEY.startsWith('YOUR_')) {
      setStatus('error');
      setError('尚未配置高德地图 API Key。');
      return cleanup;
    }

    // 安全密钥须在加载 JS API 之前注入
    if (AMAP_SECURITY) window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY };

    if (window.AMap?.Map) {
      // 已加载：等一帧确保布局完成后再初始化
      const raf = requestAnimationFrame(initMap);
      return () => {
        cancelAnimationFrame(raf);
        cleanup();
      };
    }

    const s = document.createElement('script');
    s.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(AMAP_KEY)}`;
    s.async = true;
    s.onload = () => requestAnimationFrame(initMap);
    s.onerror = () => {
      if (!cancelled) {
        setStatus('error');
        setError('高德地图脚本加载失败，请检查网络或 Key。');
      }
    };
    document.head.appendChild(s);

    return cleanup;
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
      {status === 'error' && <div className="map-stage-status map-stage-error">{error}</div>}
    </div>
  );
}
