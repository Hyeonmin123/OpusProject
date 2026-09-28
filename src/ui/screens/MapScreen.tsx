import { type CSSProperties, useEffect } from 'react';
import { getAct } from '../../data/acts';
import { reachableNodeIds } from '../../engine';
import { useGame } from '../../store/gameStore';
import type { MapNode, NodeType, RunState } from '../../types';
import { MAP_CHART } from '../art';
import { NODE_INFO } from '../nodeInfo';
import styles from './MapScreen.module.css';

const COL_W = 86;
const ROW_H = 74;
const PAD_X = 50;
const PAD_TOP = 70;
const PAD_BOTTOM = 40;

/** Small deterministic offset so the grid looks hand-drawn rather than rigid. */
function jitter(id: string, axis: number): number {
  let h = axis * 7919;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 100) / 100 - 0.5) * 22;
}

function layout(run: RunState) {
  const { map } = run;
  const width = PAD_X * 2 + (map.cols - 1) * COL_W;
  const height = PAD_TOP + PAD_BOTTOM + (map.rows - 1) * ROW_H;
  const pos = (n: MapNode) => {
    if (n.type === 'boss') return { x: width / 2, y: PAD_TOP - 10 };
    return {
      x: PAD_X + n.col * COL_W + jitter(n.id, 1),
      y: PAD_TOP + (map.rows - 1 - n.row) * ROW_H + jitter(n.id, 2) * 0.6,
    };
  };
  return { width, height, pos };
}

export function MapScreen({ run }: { run: RunState }) {
  const selectNode = useGame((s) => s.selectNode);
  const { map } = run;
  const reachable = new Set(reachableNodeIds(map, run.currentNodeId));
  const visited = new Set(run.visitedNodeIds);
  const { width, height, pos } = layout(run);
  const nodes = Object.values(map.nodes);

  // Scroll so the player's current position is in view.
  useEffect(() => {
    const target = document.querySelector<HTMLElement>(`[data-node-reachable="true"]`);
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [run.currentNodeId]);

  const edgeClass = (from: string, to: string) => {
    if (visited.has(from) && visited.has(to)) return `${styles.edge} ${styles.edgeTaken}`;
    if (from === run.currentNodeId && reachable.has(to)) return `${styles.edge} ${styles.edgeOpen}`;
    return styles.edge;
  };

  return (
    <div className={`${styles.screen} fade-in`}>
      <div className={styles.mapWrap}>
        <div className={styles.header}>
          <h2>
            {run.act}막 — {getAct(run.act).name}
          </h2>
          <div className={styles.hint}>
            {run.currentNodeId === null
              ? '시작 지점을 선택하세요.'
              : '빛나는 방으로 이동할 수 있습니다.'}
          </div>
        </div>
        <div
          className={styles.map}
          style={{ width, height, backgroundImage: `url("${MAP_CHART}")` }}
        >
          <svg className={styles.edges} width={width} height={height}>
            {nodes.flatMap((n) =>
              n.next.map((nextId) => {
                const a = pos(n);
                const b = pos(map.nodes[nextId]);
                return (
                  <line
                    key={`${n.id}-${nextId}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className={edgeClass(n.id, nextId)}
                  />
                );
              }),
            )}
          </svg>
          {nodes.map((n) => {
            const info = NODE_INFO[n.type];
            const { x, y } = pos(n);
            const canGo = reachable.has(n.id);
            const classes = [
              styles.node,
              n.type === 'boss' && styles.boss,
              canGo && styles.reachable,
              visited.has(n.id) && styles.visited,
              n.id === run.currentNodeId && styles.current,
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={n.id}
                className={classes}
                style={{ left: x, top: y, '--node-color': info.color } as CSSProperties}
                disabled={!canGo}
                onClick={() => selectNode(n.id)}
                title={info.label}
                aria-label={`${info.label}${canGo ? ' (이동 가능)' : ''}`}
                data-node-reachable={canGo}
              >
                {info.icon}
              </button>
            );
          })}
        </div>
      </div>
      <aside className={`${styles.legend} panel`}>
        <h3>범례</h3>
        {(Object.keys(NODE_INFO) as NodeType[]).map((t) => (
          <div key={t} className={styles.legendRow}>
            <span
              className={styles.legendDot}
              style={{ '--node-color': NODE_INFO[t].color } as CSSProperties}
            >
              {NODE_INFO[t].icon}
            </span>
            {NODE_INFO[t].label}
          </div>
        ))}
      </aside>
    </div>
  );
}
