import { describe, expect, it } from 'vitest';
import type { CardInstance, EncounterDef, RunState } from '../types';
import { endTurn, playCard, startCombat } from './combat';
import { createRun, finishCombat } from './run';

const SEED = 12345;

function combatRun(enemies: string[], tier: EncounterDef['tier'] = 'normal'): RunState {
  const run = createRun(SEED);
  run.player.relics = []; // isolate from relic effects
  return startCombat(run, { id: 'test', tier, enemies });
}

/** Replaces the hand with specific cards (tests may mutate their own copy). */
function withHand(run: RunState, defIds: string[]): { run: RunState; hand: CardInstance[] } {
  const next = structuredClone(run);
  const hand = defIds.map((defId, i) => ({ uid: `t${i}`, defId, upgraded: false }));
  next.combat!.hand = hand;
  return { run: next, hand };
}

describe('combat engine', () => {
  it('starts with 3 energy and 5 cards in hand', () => {
    const run = combatRun(['cultist']);
    expect(run.screen).toBe('combat');
    expect(run.combat!.energy).toBe(3);
    expect(run.combat!.hand).toHaveLength(5);
    expect(run.combat!.drawPile).toHaveLength(5);
    expect(run.combat!.enemies[0].intent).toBe('incantation');
  });

  it('Strike spends 1 energy, deals 6 and goes to the discard pile', () => {
    const base = combatRun(['cultist']);
    const { run, hand } = withHand(base, ['strike']);
    const hp = run.combat!.enemies[0].hp;
    const after = playCard(run, hand[0].uid, 0);
    expect(after.combat!.energy).toBe(2);
    expect(after.combat!.enemies[0].hp).toBe(hp - 6);
    expect(after.combat!.hand).toHaveLength(0);
    expect(after.combat!.discardPile.map((c) => c.uid)).toContain(hand[0].uid);
    // input state untouched
    expect(run.combat!.enemies[0].hp).toBe(hp);
  });

  it('rejects cards the player cannot afford', () => {
    const base = combatRun(['cultist']);
    const { run, hand } = withHand(base, ['bludgeon']);
    run.combat!.energy = 2;
    expect(playCard(run, hand[0].uid, 0)).toBe(run);
  });

  it('Vulnerable increases attack damage by 50% and decays at end of round', () => {
    const base = combatRun(['cultist']);
    const { run, hand } = withHand(base, ['bash', 'strike']);
    const hp = run.combat!.enemies[0].hp;
    let s = playCard(run, hand[0].uid, 0);
    expect(s.combat!.enemies[0].statuses.vulnerable).toBe(2);
    s = playCard(s, hand[1].uid, 0);
    expect(s.combat!.enemies[0].hp).toBe(hp - 8 - 9);
    s = endTurn(s);
    expect(s.combat!.enemies[0].statuses.vulnerable).toBe(1);
  });

  it('block absorbs enemy damage and resets at the start of the next turn', () => {
    const base = combatRun(['rottingGolem'], 'boss');
    // Turn 1 intent is "corrupt" (no damage); skip to the 18-damage slam.
    let s = endTurn(base);
    expect(s.combat!.enemies[0].intent).toBe('slam');
    const { run, hand } = withHand(s, ['defend', 'defend']);
    s = playCard(run, hand[0].uid);
    s = playCard(s, hand[1].uid);
    // Golem applied Frail on turn 1, so each Defend gives floor(5 * 0.75) = 3.
    expect(s.combat!.player.block).toBe(6);
    const hp = s.player.hp;
    s = endTurn(s);
    expect(s.player.hp).toBe(hp - (18 - 6));
    expect(s.combat!.player.block).toBe(0);
  });

  it('debuffs applied by enemies last through the player next turn', () => {
    const base = combatRun(['rottingGolem'], 'boss');
    const s = endTurn(base); // golem: Weak 2 + Frail 1
    expect(s.combat!.player.statuses.weak).toBe(2);
    const s2 = endTurn(s);
    expect(s2.combat!.player.statuses.weak).toBe(1);
  });

  it('Cultist gains Strength from Ritual on later turns', () => {
    let s = combatRun(['cultist']);
    s = endTurn(s); // incantation
    expect(s.combat!.enemies[0].statuses.ritual).toBe(2);
    const hp = s.player.hp;
    s.combat!.hand = [];
    s = endTurn(s); // ritual -> str 2, dark strike 6 + 2
    expect(s.combat!.enemies[0].statuses.strength).toBe(2);
    expect(hp - s.player.hp).toBe(8);
  });

  it('detects victory and produces a reward screen', () => {
    const base = combatRun(['rat']);
    const { run, hand } = withHand(base, ['bludgeon']);
    run.combat!.energy = 3;
    const won = playCard(run, hand[0].uid, 0);
    expect(won.combat!.phase).toBe('won');
    expect(endTurn(won)).toBe(won); // no actions after the fight ends
    const rewarded = finishCombat(won);
    expect(rewarded.screen).toBe('reward');
    expect(rewarded.reward!.cardChoices).toHaveLength(3);
    expect(rewarded.combat).toBeNull();
  });

  it('detects defeat', () => {
    const base = combatRun(['rottingGolem'], 'boss');
    base.player.hp = 5;
    let s = endTurn(base); // corrupt (no damage)
    s = endTurn(s); // slam 18
    expect(s.combat!.phase).toBe('lost');
    const summary = finishCombat(s);
    expect(summary.screen).toBe('summary');
    expect(summary.result).toBe('defeat');
  });

  it('multi-target cards hit every enemy and powers leave play', () => {
    const base = combatRun(['rat', 'rat']);
    const { run, hand } = withHand(base, ['cleave', 'inflame']);
    const before = run.combat!.enemies.map((e) => e.hp);
    let s = playCard(run, hand[1].uid);
    expect(s.combat!.player.statuses.strength).toBe(2);
    expect(s.combat!.discardPile.find((c) => c.uid === hand[1].uid)).toBeUndefined();
    s = playCard(s, hand[0].uid);
    s.combat!.enemies.forEach((e, i) => expect(e.hp).toBe(Math.max(0, before[i] - 10)));
  });
});
