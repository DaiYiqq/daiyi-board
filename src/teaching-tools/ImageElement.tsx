import type { CSSProperties } from 'react';

export type ImageElement = {
  id: string;
  src: string;
  x: number; // 0..1
  y: number; // 0..1
  w: number; // 0..1
  h: number; // 0..1
};

type Props = {
  image: ImageElement;
  stageW: number;
  stageH: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onBeforeChange: () => void;
  onUpdate: (id: string, patch: Partial<ImageElement>) => void;
  onDelete: (id: string) => void;
};

export default function ImageElement({
  image,
  stageW,
  stageH,
  selected,
  onSelect,
  onBeforeChange,
  onUpdate,
  onDelete,
}: Props) {
  const startMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onBeforeChange();
    const sx = e.clientX;
    const sy = e.clientY;
    const bx = image.x;
    const by = image.y;
    const move = (ev: PointerEvent) => {
      onUpdate(image.id, {
        x: Math.max(0, Math.min(1 - image.w, bx + (ev.clientX - sx) / stageW)),
        y: Math.max(0, Math.min(1 - image.h, by + (ev.clientY - sy) / stageH)),
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onBeforeChange();
    const sx = e.clientX;
    const sy = e.clientY;
    const bw = image.w;
    const bh = image.h;
    const move = (ev: PointerEvent) => {
      onUpdate(image.id, {
        w: Math.max(0.08, Math.min(1 - image.x, bw + (ev.clientX - sx) / stageW)),
        h: Math.max(0.06, Math.min(1 - image.y, bh + (ev.clientY - sy) / stageH)),
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const style: CSSProperties = {
    left: image.x * stageW,
    top: image.y * stageH,
    width: image.w * stageW,
    height: image.h * stageH,
  };

  return (
    <div
      className={`image-element${selected ? ' is-selected' : ''}`}
      style={style}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(image.id);
      }}
    >
      <img src={image.src} alt="白板截图" draggable={false} />
      {selected && (
        <>
          <div className="image-element-bar" onPointerDown={startMove}>
            <span>截图</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(image.id);
              }}
            >
              删除
            </button>
          </div>
          <div className="image-resize-handle" onPointerDown={startResize} />
        </>
      )}
    </div>
  );
}
