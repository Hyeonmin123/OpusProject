import type { NodeType } from '../types';

/** Label and colour per map node type (the icons are `NODE_ICONS` in `ui/art.ts`). */
export const NODE_INFO: Record<NodeType, { label: string; color: string }> = {
  combat: { label: '전투', color: 'var(--node-combat)' },
  elite: { label: '정예 (중간 보스)', color: 'var(--node-elite)' },
  event: { label: '이벤트', color: 'var(--node-event)' },
  shop: { label: '상점', color: 'var(--node-shop)' },
  rest: { label: '휴식처', color: 'var(--node-rest)' },
  boss: { label: '보스', color: 'var(--node-boss)' },
};
