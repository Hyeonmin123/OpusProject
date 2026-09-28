import type { Effect } from './effect';

export type RelicRarity = 'starter' | 'common' | 'boss';

/** Declarative hooks a relic can respond to. Effects run with the player as actor. */
export type RelicTrigger =
  | { when: 'combatStart'; effects: Effect[] }
  | { when: 'turnStart'; effects: Effect[]; onlyTurn?: number }
  | { when: 'combatWin'; heal?: number; gold?: number }
  | { when: 'pickup'; maxHp?: number; heal?: number; gold?: number };

export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  rarity: RelicRarity;
  triggers: RelicTrigger[];
  /** Permanent bonus to energy gained each turn. */
  energyPerTurn?: number;
}
