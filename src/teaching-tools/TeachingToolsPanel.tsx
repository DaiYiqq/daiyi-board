import { useMemo, useState } from 'react';
import {
  TEACHING_TOOLS,
  SUBJECTS,
  readFavorites,
  toggleFavorite,
  readRecent,
  pushRecent,
  type TeachingTool,
  type TeachingSubject,
} from './registry';

type Props = {
  onClose: () => void;
  onInsert: (tool: TeachingTool) => void;
};

type Tab = 'all' | TeachingSubject | 'fav' | 'recent';

export default function TeachingToolsPanel({ onClose, onInsert }: Props) {
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>(readFavorites);
  const [recent, setRecent] = useState<string[]>(readRecent);

  const tools = useMemo(() => {
    let list = TEACHING_TOOLS;
    if (tab !== 'all' && tab !== 'fav' && tab !== 'recent') {
      list = list.filter((t) => t.subject === tab);
    } else if (tab === 'fav') {
      list = list.filter((t) => favorites.includes(t.id));
    } else if (tab === 'recent') {
      list = list.filter((t) => recent.includes(t.id));
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.subject.includes(q) ||
          t.description.toLowerCase().includes(q),
      );
    }
    return list;
  }, [tab, query, favorites, recent]);

  const onFav = (id: string) => setFavorites(toggleFavorite(id));
  const insert = (t: TeachingTool) => {
    setRecent(pushRecent(t.id));
    onInsert(t);
  };

  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('application/x-teaching-tool', id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="teaching-panel">
        <div className="teaching-panel-head">
          <div>
            <span className="eyebrow">DY BOARD</span>
            <h2>教学工具</h2>
          </div>
          <button className="popover-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="teaching-tabs">
          <button className={tab === 'all' ? 'is-on' : ''} onClick={() => setTab('all')}>
            全部
          </button>
          {SUBJECTS.map((s) => (
            <button key={s} className={tab === s ? 'is-on' : ''} onClick={() => setTab(s)}>
              {s}
            </button>
          ))}
          <button className={tab === 'fav' ? 'is-on' : ''} onClick={() => setTab('fav')}>
            收藏
          </button>
          <button className={tab === 'recent' ? 'is-on' : ''} onClick={() => setTab('recent')}>
            最近
          </button>
        </div>

        <input
          className="teaching-search"
          placeholder="搜索工具…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="teaching-grid">
          {tools.map((t) => (
            <div
              key={t.id}
              className="teaching-card"
              draggable
              onDragStart={(e) => onDragStart(e, t.id)}
            >
              <div className="teaching-card-thumb">
                {t.offline ? <span className="badge-offline">离线</span> : <span className="badge-online">在线</span>}
                <span className="teaching-card-subject">{t.subject}</span>
              </div>
              <div className="teaching-card-body" title={t.note}>
                <b>{t.name}</b>
                <p>{t.description}</p>
                <div className="teaching-card-meta">
                  <span>{t.sourceName}</span>
                  <span>{t.license}</span>
                </div>
              </div>
              <div className="teaching-card-actions">
                <button onClick={() => insert(t)}>插入</button>
                <button className={favorites.includes(t.id) ? 'is-fav' : ''} onClick={() => onFav(t.id)}>
                  {favorites.includes(t.id) ? '★ 已收藏' : '☆ 收藏'}
                </button>
                {t.entryUrl && (
                  <a
                    className="teaching-card-link"
                    href={t.entryUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="打开来源"
                  >
                    来源
                  </a>
                )}
              </div>
            </div>
          ))}
          {tools.length === 0 && <div className="teaching-empty">没有匹配的工具</div>}
        </div>

        <div className="teaching-panel-foot">
          拖拽卡片到白板即可插入；也可点击「插入」。远程工具默认在新窗口打开。
        </div>
      </section>
    </div>
  );
}
