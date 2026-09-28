/**
 * Public surface of the game engine. Every action takes a RunState and returns
 * a new RunState (the input is never mutated), so the store stays trivial.
 */
export * from './cards';
export {
  MAX_HAND_SIZE,
  canPlayCard,
  describeIntent,
  endTurn,
  energyPerTurn,
  playCard,
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
