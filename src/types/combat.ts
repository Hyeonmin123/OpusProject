import type { CardInstance } from './card';
import type { EnemyState, EnemyTier } from './enemy';
import type { StatusId, StatusMap } from './status';

/** Combat-only player state (HP lives on the persistent PlayerState). */
export interface CombatPlayer {
  block: number;
  statuses: StatusMap;
  /**
   * Duration debuffs applied by enemies during their turn; they skip one
   * end-of-round decay so they actually affect the player's next turn.
   */
  skipDecay: StatusId[];
}

/**
 * 'player' = waiting for the player to act. The enemy turn resolves
 * synchronously inside endTurn(), so it never persists as a phase.
 */
export type CombatPhase = 'player' | 'won' | 'lost';

export interface CombatLogEntry {
  id: number;
  turn: number;
  text: string;
  side: 'player' | 'enemy' | 'system';
}

/**
 * A presentation cue for the UI (floating numbers, hit flashes): what just happened to whom.
 * It never feeds back into the rules. `who` is 'player' or the enemy's index.
 */
export interface CombatFx {
  id: number;
  who: 'player' | number;
  kind: 'damage' | 'hpLoss' | 'block' | 'status' | 'heal';
  /** damage: the full hit, block included; hpLoss/heal: HP; block: block gained; status: stacks. */
  amount: number;
  /** damage: the part of `amount` that block absorbed. */
  blocked?: number;
  status?: StatusId;
}

export interface CombatState {
  tier: EnemyTier;
  encounterId: string;
  enemies: EnemyState[];
  player: CombatPlayer;
  hand: CardInstance[];
  drawPile: CardInstance[];
  discardPile: CardInstance[];
  exhaustPile: CardInstance[];
  energy: number;
  /** 1-based player turn counter. */
  turn: number;
  phase: CombatPhase;
  log: CombatLogEntry[];
  logCounter: number;
  /** Recent presentation cues, newest last (optional: older saves have none). */
  fx?: CombatFx[];
  fxCounter?: number;
}
