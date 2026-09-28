import type { CardInstance } from './card';
import type { CombatState } from './combat';
import type { EnemyTier } from './enemy';
import type { ActMap } from './map';

export type Screen = 'map' | 'combat' | 'reward' | 'event' | 'shop' | 'rest' | 'summary';

export interface PlayerState {
  className: string;
  hp: number;
  maxHp: number;
  gold: number;
  deck: CardInstance[];
  relics: string[];
  baseEnergy: number;
  handSize: number;
  /**
   * Candle wax: a second resource that persists for the whole run. It burns
   * down every combat turn; at 0 the player is in blackout (암전).
   */
  candle: number;
  maxCandle: number;
}

export interface RewardState {
  tier: EnemyTier;
  gold: number;
  goldClaimed: boolean;
  cardChoices: CardInstance[];
  /** True once a card was picked or the choice skipped. */
  cardResolved: boolean;
  relicId: string | null;
  relicClaimed: boolean;
}

export interface ShopCardSlot {
  card: CardInstance;
  price: number;
  sold: boolean;
}

export interface ShopRelicSlot {
  relicId: string;
  price: number;
  sold: boolean;
}

export interface ShopState {
  cards: ShopCardSlot[];
  relics: ShopRelicSlot[];
  removePrice: number;
  removeUsed: boolean;
  /** One candle (wax refill) can be bought per shop visit. */
  candlePrice: number;
  candleUsed: boolean;
}

export type DeckPickPurpose = 'remove' | 'upgrade';

export interface EventState {
  eventId: string;
  chosenOption: number | null;
  /** Set while the chosen option still needs the player to pick a card. */
  pendingPick: DeckPickPurpose | null;
  /** Extra lines describing what happened (rolled relic/card names, etc.). */
  notes: string[];
}

export interface RestState {
  done: boolean;
  note: string | null;
}

export interface RunStats {
  floorsClimbed: number;
  enemiesKilled: number;
  elitesKilled: number;
  bossesKilled: number;
  damageDealt: number;
  damageTaken: number;
  cardsPlayed: number;
  goldEarned: number;
  turnsTaken: number;
  /** Total candle wax burned (passive drain, shadow cards, enemies, reveals). */
  waxBurned: number;
  /** Combat turns started in blackout. */
  blackoutTurns: number;
}

export type RunResult = 'victory' | 'defeat' | null;

export interface RunState {
  /** Save-format version; bump when the shape changes incompatibly. */
  version: number;
  seed: number;
  /** Current state of the seeded RNG (persisted so reloads stay deterministic). */
  rngState: number;
  uidCounter: number;
  act: number;
  /** Total floors entered across all acts. */
  floor: number;
  map: ActMap;
  currentNodeId: string | null;
  visitedNodeIds: string[];
  /** Combats fought this act (first few draw from the easier pool). */
  actCombats: number;
  /** Avoids serving the same encounter twice in a row. */
  lastEncounterId: string | null;
  seenEvents: string[];
  cardRemovals: number;
  screen: Screen;
  player: PlayerState;
  combat: CombatState | null;
  reward: RewardState | null;
  shop: ShopState | null;
  event: EventState | null;
  rest: RestState | null;
  stats: RunStats;
  result: RunResult;
  /** How the run ended, for the summary screen. */
  deathCause: string | null;
}
