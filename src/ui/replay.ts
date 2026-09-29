import { ENEMIES } from '../data/enemies';
import type { Replay } from '../store/gameStore';
import type { RunState } from '../types';
import type { CreatureMotion } from './components/Creature';

/**
 * Enemy-turn playback. The engine resolves the whole enemy turn at once; the store keeps the
 * snapshots it took (`EnemyTurnFrame`s) and the combat screen steps through them in beats:
 *
 *   beat 0            the player's turn ends (hand discarded)            END_MS
 *   beat 2k - 1       enemy k winds up and lunges (still frame k - 1)     WINDUP_MS
 *   beat 2k           its action lands: frame k is shown, so its hit       IMPACT_MS
 *                     numbers and flashes fire on the lunge's peak
 *
 * WINDUP_MS + IMPACT_MS is the length of the lunge / hop animation in Creature.module.css,
 * and WINDUP_MS is where it peaks (34%).
 */
export const END_MS = 200;
export const WINDUP_MS = 170;
export const IMPACT_MS = 330;

export interface ReplayView {
  /** The snapshot to draw. */
  run: RunState;
  /** Enemy index acting this beat, and how it moves. */
  actor: number | null;
  motion: CreatureMotion | null;
  /** How long this beat lasts. */
  ms: number;
}

export function replayView(replay: Replay): ReplayView {
  const { frames, beat } = replay;
  if (beat === 0) return { run: frames[0].run, actor: null, motion: null, ms: END_MS };
  const k = Math.ceil(beat / 2);
  const frame = frames[k];
  const impact = beat % 2 === 0;
  const actor = frame.actor;
  const enemy = actor !== null ? frame.run.combat?.enemies[actor] : undefined;
  const move = enemy && frame.moveId ? ENEMIES[enemy.defId]?.moves[frame.moveId] : undefined;
  const motion: CreatureMotion | null = !move
    ? null
    : move.effects.some((e) => e.type === 'damage')
      ? 'attack'
      : 'cast';
  return {
    run: impact ? frame.run : frames[k - 1].run,
    actor,
    motion,
    ms: impact ? IMPACT_MS : WINDUP_MS,
  };
}
