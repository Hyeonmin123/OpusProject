import type { StatusMap } from '../types';
import { getStatus } from './statuses';

/**
 * Final attack damage for one hit:
 * (base + Strength) -> x0.75 if attacker Weak -> +bonusPercent (e.g. blackout)
 * -> x1.5 if defender Vulnerable.
 */
export function calcAttackDamage(
  base: number,
  attacker: StatusMap,
  defender?: StatusMap,
  bonusPercent = 0,
): number {
  let dmg = base + getStatus(attacker, 'strength');
  if (getStatus(attacker, 'weak') > 0) dmg = Math.floor(dmg * 0.75);
  if (bonusPercent !== 0) dmg = Math.floor((dmg * (100 + bonusPercent)) / 100);
  if (defender && getStatus(defender, 'vulnerable') > 0) dmg = Math.floor(dmg * 1.5);
  return Math.max(0, dmg);
}

/** Block gained from a card/move: (base + Dexterity) -> x0.75 if Frail. */
export function calcBlockGain(base: number, statuses: StatusMap): number {
  let block = base + getStatus(statuses, 'dexterity');
  if (getStatus(statuses, 'frail') > 0) block = Math.floor(block * 0.75);
  return Math.max(0, block);
}
