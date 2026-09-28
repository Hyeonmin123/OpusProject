/**
 * Public surface of the game engine. Every action takes a RunState and returns
 * a new RunState (the input is never mutated), so the store stays trivial.
 */
export * from './cards';
export {
  MAX_HAND_SIZE,
  canPlayCard,
  canRevealIntents,
  describeIntent,
  endTurn,
  energyPerTurn,
  playCard,
  revealIntents,
  startCombat,
  type IntentKind,
  type IntentPart,
  type IntentView,
  type PlayCheck,
} from './combat';
export { calcAttackDamage, calcBlockGain } from './math';
export { MAP_COLS, MAP_REGULAR_ROWS, generateMap, reachableNodeIds } from './map';
export * from './run';
export { Rng, randomSeed } from './rng';
export { getStatus, listStatuses } from './statuses';
export {
  ACT_TRANSITION_CANDLE,
  BLACKOUT_DAMAGE,
  BLACKOUT_ENEMY_DAMAGE_BONUS,
  CANDLE_DRAIN_PER_TURN,
  DIM_THRESHOLD_PERCENT,
  MAX_CANDLE,
  REVEAL_WAX_COST,
  SHOP_CANDLE_AMOUNT,
  candleDrainPerTurn,
  dimThreshold,
  isBlackout,
  lightLevel,
  restRekindleAmount,
  type LightLevel,
} from './candle';
