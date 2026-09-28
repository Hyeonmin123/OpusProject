/**
 * Status effects (buffs/debuffs) that can sit on any combatant.
 *
 * - "duration" statuses count down by 1 at the end of each round and vanish at 0
 *   (Vulnerable, Weak, Frail).
 * - "intensity" statuses never decay on their own; the number is their strength
 *   (Strength, Dexterity, Ritual, Metallicize, Thorns, Kindle).
 */
export type StatusId =
  | 'strength'
  | 'dexterity'
  | 'vulnerable'
  | 'weak'
  | 'frail'
  | 'ritual'
  | 'metallicize'
  | 'thorns'
  | 'kindle';

/** Sparse map of active statuses on a combatant: id -> stacks. */
export type StatusMap = Partial<Record<StatusId, number>>;

export type StatusKind = 'buff' | 'debuff';
export type StatusDecay = 'duration' | 'intensity';

export interface StatusEffectDef {
  id: StatusId;
  name: string;
  /** Placeholder glyph until real art arrives. */
  icon: string;
  kind: StatusKind;
  decay: StatusDecay;
  describe: (amount: number) => string;
}

/** A single status as displayed / passed around (id + stacks). */
export interface StatusEffect {
  id: StatusId;
  amount: number;
}
