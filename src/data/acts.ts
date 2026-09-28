import type { EncounterDef } from '../types';

export interface ActDef {
  act: number;
  name: string;
  /** Pool for the first `easyCombats` normal fights of the act. */
  easyEncounters: EncounterDef[];
  hardEncounters: EncounterDef[];
  eliteEncounters: EncounterDef[];
  bossEncounters: EncounterDef[];
  easyCombats: number;
  /**
   * Scaling applied to non-boss enemies. Acts 2-3 currently reuse Act 1
   * monsters with more HP and starting Strength (content stub).
   */
  scaling: { hpMult: number; strength: number };
}

const enc = (id: string, tier: EncounterDef['tier'], enemies: string[]): EncounterDef => ({
  id,
  tier,
  enemies,
});

const EASY: EncounterDef[] = [
  enc('rats', 'normal', ['rat', 'rat']),
  enc('cultist', 'normal', ['cultist']),
  enc('slime', 'normal', ['slime']),
  enc('bats', 'normal', ['bat', 'bat']),
];

const HARD: EncounterDef[] = [
  enc('skeletonRat', 'normal', ['skeleton', 'rat']),
  enc('cultistBat', 'normal', ['cultist', 'bat']),
  enc('slimeRats', 'normal', ['slime', 'rat', 'rat']),
  enc('skeleton', 'normal', ['skeleton']),
  enc('batSwarm', 'normal', ['bat', 'bat', 'bat']),
  enc('twinSlimes', 'normal', ['slime', 'slime']),
];

const ELITES: EncounterDef[] = [
  enc('fallenKnight', 'elite', ['fallenKnight']),
  enc('gargoyles', 'elite', ['gargoyle', 'gargoyle']),
];

export const ACTS: ActDef[] = [
  {
    act: 1,
    name: '무너진 지하 묘지',
    easyEncounters: EASY,
    hardEncounters: HARD,
    eliteEncounters: ELITES,
    bossEncounters: [enc('rottingGolem', 'boss', ['rottingGolem'])],
    easyCombats: 3,
    scaling: { hpMult: 1, strength: 0 },
  },
  {
    act: 2,
    name: '뼈의 회랑',
    easyEncounters: HARD,
    hardEncounters: HARD,
    eliteEncounters: ELITES,
    bossEncounters: [enc('boneQueen', 'boss', ['boneQueen'])],
    easyCombats: 0,
    scaling: { hpMult: 1.5, strength: 2 },
  },
  {
    act: 3,
    name: '심연의 문턱',
    easyEncounters: HARD,
    hardEncounters: HARD,
    eliteEncounters: ELITES,
    bossEncounters: [enc('abyssalEye', 'boss', ['abyssalEye'])],
    easyCombats: 0,
    scaling: { hpMult: 2, strength: 4 },
  },
];

export const FINAL_ACT = ACTS.length;

export function getAct(act: number): ActDef {
  return ACTS[Math.min(Math.max(act, 1), ACTS.length) - 1];
}
