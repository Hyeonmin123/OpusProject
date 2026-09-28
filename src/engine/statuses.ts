import { STATUSES } from '../data/statuses';
import type { StatusEffect, StatusId, StatusMap } from '../types';

export function getStatus(map: StatusMap, id: StatusId): number {
  return map[id] ?? 0;
}

/** Adds (or subtracts) stacks; removes the entry when it reaches 0. */
export function addStatus(map: StatusMap, id: StatusId, amount: number): void {
  const next = getStatus(map, id) + amount;
  if (next === 0 || (STATUSES[id].decay === 'duration' && next < 0)) {
    delete map[id];
  } else {
    map[id] = next;
  }
}

/** Ticks every duration status down by one, except the ids in `skip`. */
export function decayDurationStatuses(map: StatusMap, skip: readonly StatusId[] = []): void {
  for (const id of Object.keys(map) as StatusId[]) {
    if (STATUSES[id].decay === 'duration' && !skip.includes(id)) {
      addStatus(map, id, -1);
    }
  }
}

export function listStatuses(map: StatusMap): StatusEffect[] {
  return (Object.keys(map) as StatusId[])
    .filter((id) => (map[id] ?? 0) !== 0)
    .map((id) => ({ id, amount: map[id] ?? 0 }));
}
