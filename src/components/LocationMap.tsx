import { ExternalLink, LocateFixed, MapPin, RefreshCw } from 'lucide-react';

export type LocationCoordinates = {
  latitude: number;
  longitude: number;
  accuracy: number;
};
export type LocationStatus = 'idle' | 'locating' | 'ready' | 'error';

type LocationMapProps = {
  status: LocationStatus;
  position: LocationCoordinates | null;
  error: string;
  onRetry: () => void;
};

function buildMapUrl(position: LocationCoordinates): string {
  const latitude = position.latitude;
  const longitude = position.longitude;
  const latitudeDelta = 0.006;
  const longitudeDelta = latitudeDelta / Math.max(Math.cos((latitude * Math.PI) / 180), 0.15);
  const bbox = [
    longitude - longitudeDelta,
    latitude - latitudeDelta,
    longitude + longitudeDelta,
    latitude + latitudeDelta,
  ]
    .map((value) => value.toFixed(5))
    .join(',');
  const query = new URLSearchParams({
    bbox,
    layer: 'mapnik',
    marker: `${latitude.toFixed(5)},${longitude.toFixed(5)}`,
  });
  return `https://www.openstreetmap.org/export/embed.html?${query.toString()}`;
}

function buildMapPageUrl(position: LocationCoordinates): string {
  const latitude = position.latitude.toFixed(6);
  const longitude = position.longitude.toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
}

export default function LocationMap({ status, position, error, onRetry }: LocationMapProps) {
  const mapUrl = status === 'ready' && position ? buildMapUrl(position) : undefined;
  const mapPageUrl = status === 'ready' && position ? buildMapPageUrl(position) : undefined;

  return (
    <section className="location-map-mode" aria-label="当前位置地图">
      <header className="location-map-head">
        <div className="location-map-copy">
          <span className="eyebrow">DY BOARD · LOCATION</span>
          <h2>地图</h2>
          <p>打开时自动定位当前位置，并在地图上标记。</p>
        </div>
        <div className={`location-map-status is-${status}`} role="status" aria-live="polite">
          {status === 'locating' ? (
            <>
              <span className="location-map-spinner" aria-hidden="true" />
              正在定位当前位置…
            </>
          ) : status === 'ready' && position ? (
            <>
              <LocateFixed size={16} />
              已定位 · 精度约 {Math.max(1, Math.round(position.accuracy))} 米
            </>
          ) : status === 'error' ? (
            <>
              <MapPin size={16} />
              暂时无法定位
            </>
          ) : (
            <>
              <MapPin size={16} />
              等待定位
            </>
          )}
        </div>
      </header>

      {mapUrl && position ? (
        <div className="location-map-frame">
          <iframe
            src={mapUrl}
            title="OpenStreetMap 当前定位地图"
            loading="lazy"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="location-map-placeholder">
          {status === 'error' ? (
            <div className="location-map-error" role="alert">
              <MapPin size={30} />
              <strong>无法获取当前位置</strong>
              <p>{error || '请检查定位权限与系统定位服务后重试。'}</p>
              <button type="button" className="location-map-retry" onClick={onRetry}>
                <RefreshCw size={16} />
                重试定位
              </button>
            </div>
          ) : (
            <div className="location-map-loading" aria-hidden="true">
              <span className="location-map-spinner location-map-spinner-large" />
              <strong>正在查找你的位置</strong>
              <span>请在浏览器或系统提示中允许定位</span>
            </div>
          )}
        </div>
      )}

      <footer className="location-map-footer">
        <a
          className="location-map-attribution"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap contributors
        </a>
        {mapPageUrl && (
          <a className="location-map-open" href={mapPageUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={15} />
            在新窗口打开地图
          </a>
        )}
      </footer>
      <p className="location-map-privacy">
        仅在你打开地图时请求定位。坐标只用于在 OpenStreetMap 上居中显示，不写入白板工程或本机存储；加载地图时，坐标会随地图请求发送给 OpenStreetMap。
      </p>
    </section>
  );
}
