import type { Effect } from './effect';

export type RelicRarity = 'starter' | 'common' | 'boss';

/** Declarative hooks a relic can respond to. Effects run with the player as actor. */
export type RelicTrigger =
  | { when: 'combatStart'; effects: Effect[] }
  | { when: 'turnStart'; effects: Effect[]; onlyTurn?: number }
  | { when: 'combatWin'; heal?: number; gold?: number; candle?: number }
  | {
      when: 'pickup';
      maxHp?: number;
      heal?: number;
      gold?: number;
      maxCandle?: number;
      candle?: number;
    };

export interface RelicDef {
  id: string;
  name: string;
  description: string;
  rarity: RelicRarity;
  triggers: RelicTrigger[];
  /** Permanent bonus to energy gained each turn. */
  energyPerTurn?: number;
  /** Extra candle wax burned at the start of every combat turn. */
  candleDrain?: number;
}
