import type { StatusId } from './status';

/**
 * Who an effect is aimed at, *relative to the actor* performing it.
 *  - 'self'       : the actor itself
 *  - 'target'     : the chosen target (player's selected enemy / the player for enemies)
 *  - 'allEnemies' : every living opponent of the actor
 *  - 'random'     : a random living opponent (re-rolled per hit)
 */
export type EffectTarget = 'self' | 'target' | 'allEnemies' | 'random';

export type CardPile = 'draw' | 'discard' | 'hand';

/**
 * Declarative effect shared by cards, enemy moves and relic triggers.
 * The combat engine interprets these; content files only describe them.
 */
export type Effect =
  /** Attack damage (modified by Strength / Weak / Vulnerable), optionally multi-hit. */
  | { type: 'damage'; amount: number; times?: number; target?: Exclude<EffectTarget, 'self'> }
  /** Attack whose base damage equals the actor's current Block. */
  | { type: 'damageEqualBlock'; target?: 'target' }
  /** Actor gains Block (modified by Dexterity / Frail). */
  | { type: 'block'; amount: number }
  /** Actor's current Block is doubled. */
  | { type: 'doubleBlock' }
  | { type: 'applyStatus'; status: StatusId; amount: number; target: EffectTarget }
  /** Player draws cards (ignored when an enemy is the actor). */
  | { type: 'draw'; amount: number }
  /** Player gains energy this turn (ignored for enemies). */
  | { type: 'gainEnergy'; amount: number }
  /** Actor loses HP directly, bypassing Block. */
  | { type: 'loseHp'; amount: number }
  | { type: 'heal'; amount: number }
  /** Creates temporary card copies in the player's combat piles. */
  | { type: 'addCard'; cardId: string; count: number; pile: CardPile };
