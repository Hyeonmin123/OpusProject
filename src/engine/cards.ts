import { CARDS } from '../data/cards';
import { STATUSES } from '../data/statuses';
import type {
  CardDef,
  CardInstance,
  CardResonance,
  CardStats,
  Effect,
  RunState,
  StatusMap,
} from '../types';
import { nextUid } from './context';
import { calcAttackDamage, calcBlockGain } from './math';

export function getCardDef(defId: string): CardDef {
  const def = CARDS[defId];
  if (!def) throw new Error(`Unknown card: ${defId}`);
  return def;
}

/** Effective stats of a card instance (applies the upgrade if present). */
export function getCardStats(card: CardInstance): CardStats {
  const def = getCardDef(card.defId);
  const base: CardStats = {
    cost: def.cost,
    effects: def.effects,
    exhaust: def.exhaust,
    unplayable: def.unplayable,
    description: def.description,
    candle: def.candle,
  };
  return card.upgraded && def.upgrade ? { ...base, ...def.upgrade } : base;
}

export function cardResonance(card: CardInstance): CardResonance {
  return getCardDef(card.defId).resonance ?? 'neutral';
}

export function cardName(card: CardInstance): string {
  return getCardDef(card.defId).name + (card.upgraded ? '+' : '');
}

export function canUpgrade(card: CardInstance): boolean {
  return !card.upgraded && getCardDef(card.defId).upgrade !== undefined;
}

export function makeCard(run: RunState, defId: string, upgraded = false): CardInstance {
  getCardDef(defId); // validate
  return { uid: nextUid(run, 'c'), defId, upgraded };
}

function effectNeedsTarget(e: Effect): boolean {
  return (
    (e.type === 'damage' && (e.target ?? 'target') === 'target') ||
    e.type === 'damageEqualBlock' ||
    (e.type === 'applyStatus' && e.target === 'target') ||
    (e.type === 'ifDark' && e.effects.some(effectNeedsTarget))
  );
}

/** Whether playing the card requires choosing a single enemy. */
export function cardNeedsTarget(card: CardInstance): boolean {
  return getCardStats(card).effects.some(effectNeedsTarget);
}

/** Rules text for a wax change ("촛농 2 소모." / "촛농 1 회복."). */
export function describeCandle(amount: number): string {
  return amount < 0 ? `촛농 ${-amount} 소모.` : `촛농 ${amount} 회복.`;
}

/** Optional live combat numbers so card text shows modified damage/block. */
export interface DescribeView {
  playerStatuses: StatusMap;
  playerBlock: number;
  targetStatuses?: StatusMap;
}

function describeEffect(effect: Effect, view?: DescribeView): string {
  switch (effect.type) {
    case 'damage': {
      const dmg = view
        ? calcAttackDamage(effect.amount, view.playerStatuses, view.targetStatuses)
        : effect.amount;
      const times = effect.times && effect.times > 1 ? ` ×${effect.times}` : '';
      const who =
        effect.target === 'allEnemies'
          ? '모든 적에게 '
          : effect.target === 'random'
            ? '무작위 적에게 '
            : '';
      return `${who}피해 ${dmg}${times}.`;
    }
    case 'damageEqualBlock': {
      const extra = view
        ? ` (${calcAttackDamage(view.playerBlock, view.playerStatuses, view.targetStatuses)})`
        : '';
      return `현재 방어도만큼 피해${extra}.`;
    }
    case 'block': {
      const block = view ? calcBlockGain(effect.amount, view.playerStatuses) : effect.amount;
      return `방어도 ${block}.`;
    }
    case 'doubleBlock':
      return '현재 방어도를 2배로.';
    case 'applyStatus': {
      const s = STATUSES[effect.status];
      if (effect.target === 'self') return `${s.name} ${effect.amount} 획득.`;
      if (effect.target === 'allEnemies') return `모든 적에게 ${s.name} ${effect.amount}.`;
      return `${s.name} ${effect.amount} 부여.`;
    }
    case 'draw':
      return `카드 ${effect.amount}장 뽑기.`;
    case 'gainEnergy':
      return `에너지 ${effect.amount} 획득.`;
    case 'loseHp':
      return `체력 ${effect.amount} 잃음.`;
    case 'heal':
      return `체력 ${effect.amount} 회복.`;
    case 'addCard': {
      const pile = { draw: '뽑을 카드 더미', discard: '버린 카드 더미', hand: '손' }[effect.pile];
      return `${getCardDef(effect.cardId).name} ${effect.count}장을 ${pile}에 추가.`;
    }
    case 'candle':
      return describeCandle(effect.amount);
    case 'reveal':
      return '가려진 적의 의도를 모두 드러냄.';
    case 'ifDark':
      return `어둠 속이면: ${effect.effects.map((e) => describeEffect(e, view)).join(' ')}`;
  }
}

export function describeCard(card: CardInstance, view?: DescribeView): string {
  const stats = getCardStats(card);
  const def = getCardDef(card.defId);
  const parts: string[] = [];
  if (stats.description) parts.push(stats.description);
  else parts.push(...stats.effects.map((e) => describeEffect(e, view)));
  if (def.type === 'power' && !stats.description) {
    // Powers persist: phrase them as a lasting effect.
    parts[parts.length - 1] = parts[parts.length - 1].replace(/\.$/, ' (지속).');
  }
  // Wax is paid on play, before the effects.
  if (stats.candle) parts.unshift(describeCandle(stats.candle));
  if (stats.exhaust) parts.push('소멸.');
  return parts.join(' ');
}

/** Human-readable effect list for enemy intents / relic tooltips. */
export function describeEffects(effects: Effect[]): string {
  return effects.map((e) => describeEffect(e)).join(' ');
}
