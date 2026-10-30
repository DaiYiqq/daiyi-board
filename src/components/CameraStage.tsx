import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  RotateCcw,
  RotateCw,
  Pause,
  Play,
  FlipHorizontal,
  Trash2,
  Settings,
  X,
  RefreshCw,
  Download,
  Scan,
  Maximize2,
  Image as ImageIcon,
} from 'lucide-react';
import './CameraStage.css';

export type CameraStageProps = {
  annotationColor: string;
  annotationWidth: number;
  onAnnotationColorChange?: (color: string) => void;
  onAnnotationWidthChange?: (width: number) => void;
  onExit: () => void;
};
type Shot = { id: string; url: string; name: string; created: number };
type FitMode = 'contain' | 'cover';
const RESOLUTIONS: Record<'720p' | '1080p' | '4k', { width: number; height: number }> = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
};
const ANNOTATION_COLORS = [
  '#FFFFFF',
  '#000000',
  '#E5484D',
  '#2878D0',
  '#15803D',
  '#F1A61A',
  '#8B5CF6',
];

/** Display geometry in stage-local CSS pixels. Image bounds exclude letterbox/pillarbox bars. */
function imageGeometry(
  stageW: number,
  stageH: number,
  sourceW: number,
  sourceH: number,
  rotation: number,
  fit: FitMode,
) {
  if (!stageW || !stageH || !sourceW || !sourceH)
    return { left: 0, top: 0, width: stageW, height: stageH, boxWidth: stageW, boxHeight: stageH };
  const swapped = rotation % 180 !== 0;
  const visualW = swapped ? sourceH : sourceW,
    visualH = swapped ? sourceW : sourceH;
  const scale =
    fit === 'cover'
      ? Math.max(stageW / visualW, stageH / visualH)
      : Math.min(stageW / visualW, stageH / visualH);
  const boxWidth = visualW * scale,
    boxHeight = visualH * scale;
  return {
    left: (stageW - boxWidth) / 2,
    top: (stageH - boxHeight) / 2,
    width: boxWidth,
    height: boxHeight,
    boxWidth: sourceW * scale,
    boxHeight: sourceH * scale,
  };
}
const errorMessage = (e: unknown) => {
  const err = e as { name?: string; message?: string };
  if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError')
    return '摄像头权限未授予。请在浏览器/系统设置中允许访问摄像头后重试。';
  if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError')
    return '找不到符合条件的摄像头或分辨率。旧画面保持不变，请选择其他设备或分辨率。';
  if (err?.name === 'NotReadableError' || err?.name === 'AbortError')
    return '摄像头无法启动，可能正被其他应用占用。请关闭其他应用后重试。';
  return `摄像头操作失败：${err?.message || '未知错误'}。旧画面保持不变。`;
};

export default function CameraStage({
  annotationColor,
  annotationWidth,
  onAnnotationColorChange,
  onAnnotationWidthChange,
  onExit,
}: CameraStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null),
    stageRef = useRef<HTMLDivElement>(null),
    streamRef = useRef<MediaStream | null>(null),
    shotsRef = useRef<Shot[]>([]);
  const mountedRef = useRef(false),
    streamRequestRef = useRef(0),
    deviceScanRef = useRef(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [deviceId, setDeviceId] = useState(''),
    [streamVersion, setStreamVersion] = useState(0);
  const [error, setError] = useState(''),
    [rotation, setRotation] = useState(0),
    [frozen, setFrozen] = useState(false),
    [mirror, setMirror] = useState(false);
  const [fit, setFit] = useState<FitMode>('contain'),
    [resolution, setResolution] = useState('auto'),
    [clarity, setClarity] = useState(100),
    [settings, setSettings] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]),
    [videoSize, setVideoSize] = useState({ width: 0, height: 0 }),
    [fps, setFps] = useState(0);
  const [geometry, setGeometry] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    boxWidth: 0,
    boxHeight: 0,
  });
  const [marks, setMarks] = useState<{ x: number; y: number }[][]>([]),
    drawing = useRef(false);
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const refreshDevices = useCallback(async () => {
    const scan = ++deviceScanRef.current;
    if (!mountedRef.current) return;
    if (!navigator.mediaDevices?.enumerateDevices) {
      setError('当前环境不支持摄像头枚举。请使用 HTTPS 或 localhost，并使用支持摄像头的浏览器。');
      return;
    }
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      if (!mountedRef.current || scan !== deviceScanRef.current) return;
      const cams = all.filter((d) => d.kind === 'videoinput');
      setDevices(cams);
      if (!cams.length) setError('没有检测到摄像头。请连接设备后重新扫描。');
      else setError('');
    } catch (e) {
      if (mountedRef.current && scan === deviceScanRef.current) setError(errorMessage(e));
    }
  }, []);
  const startStream = useCallback(
    async (requestedDevice: string, requestedResolution: string) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('当前环境无法访问摄像头。请使用 HTTPS 或 localhost，并检查浏览器支持。');
        return false;
      }
      const request = ++streamRequestRef.current;
      const size =
        requestedResolution === 'auto'
          ? null
          : (RESOLUTIONS[requestedResolution as keyof typeof RESOLUTIONS] ?? RESOLUTIONS['1080p']);
      try {
        const next = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            ...(requestedDevice ? { deviceId: { exact: requestedDevice } } : {}),
            ...(size ? { width: { ideal: size.width }, height: { ideal: size.height } } : {}),
            frameRate: { ideal: 30 },
          },
        });
        if (!mountedRef.current || request !== streamRequestRef.current) {
          next.getTracks().forEach((track) => track.stop());
          return false;
        }
        const old = streamRef.current;
        streamRef.current = next;
        if (videoRef.current) {
          videoRef.current.srcObject = next;
          void videoRef.current.play().catch(() => {
            if (mountedRef.current && request === streamRequestRef.current)
              setError('摄像头已连接，但视频无法播放。请检查浏览器或系统媒体权限。');
          });
        }
        old?.getTracks().forEach((t) => t.stop());
        setDeviceId(next.getVideoTracks()[0]?.getSettings().deviceId || requestedDevice);
        setFrozen(false);
        setError('');
        setStreamVersion((v) => v + 1);
        void refreshDevices();
        return true;
      } catch (e) {
        if (mountedRef.current && request === streamRequestRef.current) setError(errorMessage(e));
        return false;
      }
    },
    [refreshDevices],
  );
  useEffect(() => {
    mountedRef.current = true;
    void refreshDevices();
    void startStream('', 'auto');
    const changed = () => {
      void refreshDevices();
      if (streamRef.current?.getVideoTracks().every((t) => t.readyState === 'ended')) {
        setError('当前摄像头已断开，请选择其他设备或重新扫描。');
      }
    };
    navigator.mediaDevices?.addEventListener?.('devicechange', changed);
    return () => {
      mountedRef.current = false;
      streamRequestRef.current += 1;
      deviceScanRef.current += 1;
      navigator.mediaDevices?.removeEventListener?.('devicechange', changed);
      const activeStream = streamRef.current;
      streamRef.current = null;
      activeStream?.getTracks().forEach((t) => t.stop());
      shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url));
    };
  }, [refreshDevices, startStream]);
  useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);
  const updateGeometry = useCallback(() => {
    const stage = stageRef.current,
      video = videoRef.current;
    if (!stage || !video) return;
    const r = stage.getBoundingClientRect();
    setGeometry(
      imageGeometry(
        r.width,
        r.height,
        video.videoWidth || 16,
        video.videoHeight || 9,
        rotation,
        fit,
      ),
    );
  }, [rotation, fit, streamVersion]);
  useEffect(() => {
    updateGeometry();
    const ro = new ResizeObserver(updateGeometry);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [updateGeometry]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const update = () => {
      setVideoSize({ width: video.videoWidth, height: video.videoHeight });
      updateGeometry();
    };
    video.addEventListener('loadedmetadata', update);
    video.addEventListener('resize', update);
    return () => {
      video.removeEventListener('loadedmetadata', update);
      video.removeEventListener('resize', update);
    };
  }, [updateGeometry, streamVersion]);
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !('requestVideoFrameCallback' in HTMLVideoElement.prototype)) {
      const id = window.setInterval(() => {
        const s = streamRef.current?.getVideoTracks()[0]?.getSettings();
        setFps(s?.frameRate ? Math.round(s.frameRate) : 0);
      }, 1000);
      return () => clearInterval(id);
    }
    let active = true;
    const tick = (_: number, metadata: VideoFrameCallbackMetadata) => {
      if (!active) return;
      setFps(Math.round(metadata.presentedFrames / Math.max(1, metadata.mediaTime)));
      videoRef.current?.requestVideoFrameCallback(tick);
    };
    videoRef.current?.requestVideoFrameCallback(tick);
    return () => {
      active = false;
    };
  }, [streamVersion]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (settings) setSettings(false);
        else onExit();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void takePhoto();
      }
      if (
        e.key === ' ' &&
        !(e.target instanceof HTMLButtonElement) &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLSelectElement)
      ) {
        e.preventDefault();
        toggleFreeze();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const actualWidth = videoSize.width || 0,
    actualHeight = videoSize.height || 0;
  const toggleFreeze = () => {
    const v = videoRef.current;
    if (!v) return;
    if (frozen) {
      void v
        .play()
        .then(() => {
          if (mountedRef.current) setFrozen(false);
        })
        .catch(() => {
          if (mountedRef.current) setError('无法继续播放当前摄像头画面。');
        });
    } else {
      v.pause();
      setFrozen(true);
    }
  };
  function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError('摄像头画面尚未就绪，暂时无法拍照。');
      return;
    }
    const canvas = document.createElement('canvas'),
      swap = rotation % 180 !== 0;
    canvas.width = swap ? video.videoHeight : video.videoWidth;
    canvas.height = swap ? video.videoWidth : video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('无法创建截图画布，请重试。');
      return;
    }
    ctx.save();
    ctx.filter = `contrast(${clarity}%)`;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(mirror ? -1 : 1, 1);
    ctx.drawImage(video, -video.videoWidth / 2, -video.videoHeight / 2);
    ctx.restore();
    ctx.save();
    marks.forEach((path) => {
      if (path.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = annotationColor;
      ctx.lineWidth =
        annotationWidth * (canvas.width / Math.max(geometry.width, geometry.height, 1));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      path.forEach((p, i) => {
        const x = (p.x - 0.5) * canvas.width,
          y = (p.y - 0.5) * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
    ctx.restore();
    canvas.toBlob((blob) => {
      if (!mountedRef.current) return;
      if (!blob) {
        setError('PNG 图片生成失败，请重试。');
        return;
      }
      const now = new Date(),
        stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`,
        shot = {
          id: crypto.randomUUID(),
          url: URL.createObjectURL(blob),
          name: `DY-Board-camera-${stamp}.png`,
          created: now.getTime(),
        };
      setShots((prev) => {
        const next = [shot, ...prev];
        next.slice(12).forEach((s) => URL.revokeObjectURL(s.url));
        return next.slice(0, 12);
      });
      setError('');
    }, 'image/png');
  }
  const pointsFor = (e: React.PointerEvent) => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r || !geometry.width || !geometry.height) return null;
    const x = (e.clientX - r.left - geometry.left) / geometry.width,
      y = (e.clientY - r.top - geometry.top) / geometry.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x, y };
  };
  const startMark = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = pointsFor(e);
    if (!p) return;
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setMarks((m) => [...m, [p]]);
  };
  const moveMark = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const p = pointsFor(e);
    if (!p) return;
    setMarks((m) => {
      const next = [...m],
        last = [...next[next.length - 1], p];
      next[next.length - 1] = last;
      return next;
    });
  };
  const markSvg = useMemo(
    () => marks.map((p) => p.map((q) => `${q.x * 1000},${q.y * 1000}`).join(' ')),
    [marks],
  );
  const rotate = (delta: number) => setRotation((r) => (r + delta + 360) % 360);
  const removeShot = (id: string) =>
    setShots((prev) => {
      const item = prev.find((s) => s.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((s) => s.id !== id);
    });
  const chooseDevice = async (id: string) => {
    const ok = await startStream(id, resolution);
    if (ok && mountedRef.current) setDeviceId(id);
  };
  const chooseResolution = async (v: string) => {
    const ok = await startStream(deviceId, v);
    if (ok && mountedRef.current) setResolution(v);
  };

  return (
    <div className="camera-stage" role="region" aria-label="摄像展台">
      <div className="camera-stage-main">
        <div
          className="camera-stage-viewport"
          ref={stageRef}
          onPointerDown={startMark}
          onPointerMove={moveMark}
          onPointerUp={() => {
            drawing.current = false;
          }}
          onPointerCancel={() => {
            drawing.current = false;
          }}
        >
          <video
            ref={videoRef}
            className="camera-stage-video"
            autoPlay
            muted
            playsInline
            style={{
              width: geometry.boxWidth,
              height: geometry.boxHeight,
              transform: `translate(-50%, -50%) rotate(${rotation}deg) scaleX(${mirror ? -1 : 1})`,
              left: '50%',
              top: '50%',
              filter: `contrast(${clarity}%)`,
              objectFit: 'fill',
            }}
          />
          <svg
            className="camera-stage-ink"
            style={{
              left: geometry.left,
              top: geometry.top,
              width: geometry.width,
              height: geometry.height,
            }}
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            aria-label="实时批注画布"
          >
            {markSvg.map((pts, i) => (
              <polyline
                key={i}
                points={pts}
                fill="none"
                stroke={annotationColor}
                strokeWidth={Math.max(2, annotationWidth * 2.5)}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
          {!actualWidth && (
            <div className="camera-stage-empty">
              <Camera size={42} />
              <strong>{supported ? '正在连接摄像头…' : '摄像头不可用'}</strong>
              <span>进入展台后会自动请求摄像头权限</span>
            </div>
          )}
          <div className="camera-stage-hud">
            <span className={frozen ? 'camera-stage-live frozen' : 'camera-stage-live'}>
              {frozen ? '已冻结' : '实时画面'}
            </span>
            {actualWidth > 0 && (
              <span>
                {actualWidth} × {actualHeight} · {fps ? `${fps} fps` : '帧率读取中'}
              </span>
            )}
          </div>
        </div>
        <aside className="camera-stage-photos">
          <div className="camera-stage-photos-head">
            <strong>
              <ImageIcon size={16} /> 已拍照片
            </strong>
            <span>{shots.length}/12</span>
          </div>
          {shots.length ? (
            <div className="camera-stage-photo-list">
              {shots.map((shot, i) => (
                <article className="camera-stage-photo" key={shot.id}>
                  <img src={shot.url} alt={`展台照片 ${i + 1}`} />
                  <div className="camera-stage-photo-meta">
                    <span>{new Date(shot.created).toLocaleTimeString()}</span>
                    <div>
                      <a href={shot.url} download={shot.name} aria-label="保存照片" title="保存">
                        <Download size={15} />
                      </a>
                      <button
                        onClick={() => removeShot(shot.id)}
                        aria-label="删除照片"
                        title="删除"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="camera-stage-no-photos">拍下的照片会显示在这里</div>
          )}
        </aside>
      </div>
      {error && (
        <div className="camera-stage-error" role="alert">
          <span>{error}</span>
          <button onClick={() => setError('')} aria-label="关闭提示">
            <X size={15} />
          </button>
        </div>
      )}
      <footer className="camera-stage-toolbar">
        <button className="camera-stage-shutter" onClick={takePhoto} title="拍照（Ctrl/⌘+S）">
          <Camera size={18} />
          拍照
        </button>
        <span className="camera-stage-divider" />
        <button onClick={() => rotate(-90)} title="向左旋转90°">
          <RotateCcw size={18} />
          <span>左转</span>
        </button>
        <button onClick={() => rotate(90)} title="向右旋转90°">
          <RotateCw size={18} />
          <span>右转</span>
        </button>
        <button
          onClick={toggleFreeze}
          aria-pressed={frozen}
          title={frozen ? '继续（空格）' : '冻结（空格）'}
        >
          {frozen ? <Play size={18} /> : <Pause size={18} />}
          <span>{frozen ? '继续' : '冻结'}</span>
        </button>
        <button
          className={mirror ? 'active' : ''}
          aria-pressed={mirror}
          onClick={() => setMirror((m) => !m)}
          title="镜像"
        >
          <FlipHorizontal size={18} />
          <span>镜像</span>
        </button>
        <button onClick={() => setMarks([])} title="清除批注">
          <Scan size={18} />
          <span>清批注</span>
        </button>
        <button
          onClick={() => setSettings((s) => !s)}
          className={settings ? 'active' : ''}
          aria-pressed={settings}
          title="展台设置"
        >
          <Settings size={18} />
          <span>设置</span>
        </button>
        <button className="camera-stage-exit" onClick={onExit} title="退出展台（Esc）">
          <X size={18} />
          <span>退出</span>
        </button>
      </footer>
      {settings && (
        <section className="camera-stage-settings" aria-label="展台设置">
          <header>
            <strong>画面设置</strong>
            <button onClick={() => setSettings(false)} aria-label="关闭设置">
              <X size={17} />
            </button>
          </header>
          <label>
            摄像信号源
            <select value={deviceId} onChange={(e) => void chooseDevice(e.target.value)}>
              {devices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `摄像头 ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
          <button className="camera-stage-rescan" onClick={() => void refreshDevices()}>
            <RefreshCw size={15} />
            重新扫描设备
          </button>
          <label className="camera-stage-annotation-label">批注笔色</label>
          <div className="camera-stage-annotation-colors">
            {ANNOTATION_COLORS.map((c) => (
              <button
                key={c}
                className={annotationColor.toLowerCase() === c.toLowerCase() ? 'active' : ''}
                style={{ background: c }}
                onClick={() => onAnnotationColorChange?.(c)}
                aria-label={`批注颜色 ${c}`}
                title={c}
              />
            ))}
          </div>
          <label className="camera-stage-range-label">
            批注粗细<span>{annotationWidth}px</span>
            <input
              type="range"
              min="2"
              max="16"
              value={annotationWidth}
              onChange={(e) => onAnnotationWidthChange?.(Number(e.target.value))}
            />
          </label>
          <label>
            输入分辨率
            <select value={resolution} onChange={(e) => void chooseResolution(e.target.value)}>
              <option value="auto">自动（推荐）</option>
              <option value="720p">720p（1280×720）</option>
              <option value="1080p">1080p（1920×1080）</option>
              <option value="4k">4K（3840×2160）</option>
            </select>
          </label>
          <label className="camera-stage-range-label">
            清晰度（本地显示对比度）<span>{clarity}%</span>
            <input
              type="range"
              min="60"
              max="160"
              value={clarity}
              onChange={(e) => setClarity(Number(e.target.value))}
            />
            <small>仅调整画面对比度，不会提升摄像头光学清晰度</small>
          </label>
          <label>
            画面适配
            <select value={fit} onChange={(e) => setFit(e.target.value as FitMode)}>
              <option value="contain">完整显示（推荐）</option>
              <option value="cover">铺满（裁切边缘）</option>
            </select>
          </label>
          <div className="camera-stage-settings-foot">
            <span>实际输出</span>
            <b>
              {actualWidth ? `${actualWidth} × ${actualHeight}` : '等待信号'}
              {fps ? ` · ${fps} fps` : ''}
            </b>
          </div>
          <div className="camera-stage-settings-note">
            <Maximize2 size={14} />
            旋转后自动适配画面区域
          </div>
        </section>
      )}
    </div>
  );
}
