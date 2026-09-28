import type { Effect } from './effect';

export type CardType = 'attack' | 'skill' | 'power' | 'status';
export type CardRarity = 'starter' | 'common' | 'uncommon' | 'rare' | 'special';

/**
 * Candle resonance. Light cards feed the candle (restore wax) but are weaker per
 * energy; shadow cards are stronger but burn extra wax. Omitted = neutral.
 */
export type CardResonance = 'light' | 'shadow' | 'neutral';

/** The mechanical part of a card that an upgrade can override. */
export interface CardStats {
  cost: number;
  effects: Effect[];
  /** Removed for the rest of combat after being played. */
  exhaust?: boolean;
  /** Cannot be played at all (e.g. Wound). */
  unplayable?: boolean;
  /** Hand-written rules text; if omitted, text is generated from `effects`. */
  description?: string;
  /**
   * Candle wax change paid when the card is played, before its effects:
   * positive restores wax (light), negative burns it (shadow). Burning more wax
   * than is left costs the missing amount in HP instead.
   */
  candle?: number;
}

export interface CardDef extends CardStats {
  id: string;
  name: string;
  type: CardType;
  rarity: CardRarity;
  resonance?: CardResonance;
  /** Fields replaced when the card is upgraded (effects are replaced wholesale). */
  upgrade?: Partial<CardStats>;
  flavor?: string;
}

/** A concrete card in a deck or combat pile. */
export interface CardInstance {
  /** Unique per run so React keys and pile moves are stable. */
  uid: string;
  defId: string;
  upgraded: boolean;
}
