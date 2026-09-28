import type { RunState } from '../types';
import { Rng } from './rng';

/** Mutable working context handed to engine internals. */
export interface Ctx {
  run: RunState;
  rng: Rng;
}

/**
 * Runs `fn` against a deep copy of `run` and returns the copy. This keeps every
 * public engine function pure (input state is never mutated) while letting the
 * internals use straightforward mutation. RNG state is threaded through the run.
 *
 * If `fn` returns `false` the action is treated as rejected and the original
 * (unchanged) run object is returned, so callers can cheaply detect no-ops.
 */
export function transact(run: RunState, fn: (ctx: Ctx) => void | boolean): RunState {
  const draft = structuredClone(run);
  const rng = new Rng(draft.rngState);
  if (fn({ run: draft, rng }) === false) return run;
  draft.rngState = rng.state;
  return draft;
}

export function nextUid(run: RunState, prefix: string): string {
  run.uidCounter += 1;
  return `${prefix}${run.uidCounter}`;
}
