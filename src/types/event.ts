/** Outcomes an event option can produce (applied in order). */
export type EventOutcome =
  | { type: 'gold'; amount: number }
  /** Positive heals, negative damages (never below 1 HP). */
  | { type: 'hp'; amount: number }
  | { type: 'healPercent'; percent: number }
  | { type: 'maxHp'; amount: number }
  | { type: 'randomRelic' }
  /** Random reward card, optionally limited to one candle resonance. */
  | { type: 'randomCard'; resonance?: 'light' | 'shadow' }
  /** Positive restores candle wax, negative burns it (never below 0). */
  | { type: 'candle'; amount: number }
  | { type: 'addCard'; cardId: string }
  | { type: 'upgradeRandom'; count: number }
  /** Opens a deck picker; resolved via a follow-up action. */
  | { type: 'chooseRemove' }
  | { type: 'chooseUpgrade' };

export interface EventOption {
  label: string;
  /** Short mechanical summary shown on the button. */
  detail: string;
  outcomes: EventOutcome[];
  /** Flavor text shown after choosing. */
  result: string;
  requiresGold?: number;
}

export interface EventDef {
  id: string;
  title: string;
  icon: string;
  text: string;
  options: EventOption[];
}
