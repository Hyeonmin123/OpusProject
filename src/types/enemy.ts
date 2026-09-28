import type { Effect } from './effect';
import type { RandomSource } from './rng';
import type { StatusMap } from './status';

export type EnemyTier = 'normal' | 'elite' | 'boss';

export interface EnemyMove {
  id: string;
  name: string;
  effects: Effect[];
}

export interface EnemyAiContext {
  /** 1-based index of the enemy turn this intent is being chosen for. */
  turn: number;
  /** Move ids already executed, oldest first. */
  history: readonly string[];
  hp: number;
  maxHp: number;
  rng: RandomSource;
}

export interface EnemyDef {
  id: string;
  name: string;
  /** Placeholder glyph until real art arrives. */
  icon: string;
  tier: EnemyTier;
  /** Inclusive HP roll range. */
  hp: [number, number];
  moves: Record<string, EnemyMove>;
  /** Returns the id of the next move (its "intent"). */
  ai: (ctx: EnemyAiContext) => string;
  startStatuses?: StatusMap;
}

/** Runtime state of one enemy in combat. */
export interface EnemyState {
  uid: string;
  defId: string;
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  statuses: StatusMap;
  /** Move id the enemy will perform on its next turn (null when dead). */
  intent: string | null;
  history: string[];
}

export interface EncounterDef {
  id: string;
  tier: EnemyTier;
  enemies: string[];
}
