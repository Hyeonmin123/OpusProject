import type { NodeType } from '../types';

/** Placeholder icon/label/color per map node type. */
export const NODE_INFO: Record<NodeType, { icon: string; label: string; color: string }> = {
  combat: { icon: '⚔️', label: '전투', color: 'var(--node-combat)' },
  elite: { icon: '😈', label: '정예 (중간 보스)', color: 'var(--node-elite)' },
  event: { icon: '❓', label: '이벤트', color: 'var(--node-event)' },
  shop: { icon: '💰', label: '상점', color: 'var(--node-shop)' },
  rest: { icon: '🔥', label: '휴식처', color: 'var(--node-rest)' },
  boss: { icon: '💀', label: '보스', color: 'var(--node-boss)' },
};
