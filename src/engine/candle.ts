import { RELICS } from '../data/relics';
import type { PlayerState, RunState } from '../types';

// ---- Tuning ------------------------------------------------------------------------------
// The candle is a run-long second resource. Numbers were tuned with the bot
// simulation (simulation.test.ts): an unmanaged candle runs dry around the end of
// Act 1 / start of Act 2, so a run must refill it 2–4 times (rest sites, shops,
// events, act transitions, light cards) to reach Act 3 without living in blackout.

/** Wax a new run starts with (and the base maximum). */
export const MAX_CANDLE = 40;
/** Wax burned at the start of every combat turn. */
export const CANDLE_DRAIN_PER_TURN = 1;
/** Below this share of max wax the light is dim and enemy intents start to hide. */
export const DIM_THRESHOLD_PERCENT = 30;
/** Chance for each enemy intent to be hidden in dim light (at least one always is). */
export const DIM_HIDE_CHANCE = 0.5;
/** HP lost at the start of every turn spent in blackout. */
export const BLACKOUT_DAMAGE = 3;
/** Enemy attack damage bonus (percent) while the player is in blackout. */
export const BLACKOUT_ENEMY_DAMAGE_BONUS = 25;
/** Wax spent by the in-combat "raise the wick" action that reveals hidden intents. */
export const REVEAL_WAX_COST = 3;
/** Rest-site "rekindle" option: share of max wax restored. */
export const REST_REKINDLE_PERCENT = 50;
/** Share of *missing* wax restored when descending to the next act. */
export const ACT_TRANSITION_CANDLE = 0.5;
/** Wax restored by the candle sold in shops. */
export const SHOP_CANDLE_AMOUNT = 15;

export function shopCandlePrice(act: number): number {
  return 35 + 5 * (act - 1);
}

// ---- Helpers -----------------------------------------------------------------------------

export type LightLevel = 'bright' | 'dim' | 'dark';

/** Wax at or above which the light is bright (intents always visible). */
export function dimThreshold(maxCandle: number): number {
  return Math.ceil((maxCandle * DIM_THRESHOLD_PERCENT) / 100);
}

/** 'dark' = blackout (0 wax), 'dim' = below the threshold, otherwise 'bright'. */
export function lightLevel(player: Pick<PlayerState, 'candle' | 'maxCandle'>): LightLevel {
  if (player.candle <= 0) return 'dark';
  return player.candle < dimThreshold(player.maxCandle) ? 'dim' : 'bright';
}

export function isBlackout(run: RunState): boolean {
  return run.player.candle <= 0;
}

/** Wax burned at the start of each combat turn (base + relic penalties). */
export function candleDrainPerTurn(run: RunState): number {
  return (
    CANDLE_DRAIN_PER_TURN +
    run.player.relics.reduce((sum, id) => sum + (RELICS[id]?.candleDrain ?? 0), 0)
  );
}

/** Restores wax outside combat (clamped to max). Returns the amount gained. */
export function restoreCandle(player: PlayerState, amount: number): number {
  const before = player.candle;
  player.candle = Math.min(player.maxCandle, player.candle + Math.max(0, amount));
  return player.candle - before;
}

/**
 * Burns wax (never below 0). Returns how much was actually burned and the
 * shortfall that could not be paid.
 */
export function burnCandle(
  run: RunState,
  amount: number,
): { burned: number; shortfall: number } {
  const want = Math.max(0, amount);
  const burned = Math.min(run.player.candle, want);
  run.player.candle -= burned;
  run.stats.waxBurned += burned;
  return { burned, shortfall: want - burned };
}

export function restRekindleAmount(run: RunState): number {
  return Math.floor((run.player.maxCandle * REST_REKINDLE_PERCENT) / 100);
}
