import { describe, expect, it } from 'vitest';
import type { CardInstance, EncounterDef, RunState } from '../types';
import { BLACKOUT_DAMAGE, MAX_CANDLE, REVEAL_WAX_COST, dimThreshold, lightLevel } from './candle';
import { describeCard } from './cards';
import {
  canRevealIntents,
  describeIntent,
  endTurn,
  playCard,
  revealIntents,
  startCombat,
} from './combat';
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
    // Turn 1 intent is "corrupt" (no damage); skip to the 16-damage slam.
    let s = endTurn(base);
    expect(s.combat!.enemies[0].intent).toBe('slam');
    const { run, hand } = withHand(s, ['defend', 'defend']);
    s = playCard(run, hand[0].uid);
    s = playCard(s, hand[1].uid);
    // Golem applied Frail on turn 1, so each Defend gives floor(5 * 0.75) = 3.
    expect(s.combat!.player.block).toBe(6);
    const hp = s.player.hp;
    s = endTurn(s);
    expect(s.player.hp).toBe(hp - (16 - 6));
    expect(s.combat!.player.block).toBe(0);
  });

  it('debuffs applied by enemies last through the player next turn', () => {
    const base = combatRun(['rottingGolem'], 'boss');
    const s = endTurn(base); // golem: Weak 1 + Frail 1
    // Applied during the enemy turn, so it skips that round's decay...
    expect(s.combat!.player.statuses.weak).toBe(1);
    expect(s.combat!.player.statuses.frail).toBe(1);
    // ...and wears off at the end of the player's next round.
    const s2 = endTurn(s);
    expect(s2.combat!.player.statuses.weak).toBeUndefined();
    expect(s2.combat!.player.statuses.frail).toBeUndefined();
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

/** Clone with the candle set to `wax` (tests may mutate their own copy). */
function withCandle(run: RunState, wax: number): RunState {
  const next = structuredClone(run);
  next.player.candle = wax;
  return next;
}

const DIM = dimThreshold(MAX_CANDLE);

describe('candle system', () => {
  it('burns 1 wax at the start of every turn and persists after combat', () => {
    let s = combatRun(['cultist']);
    expect(s.player.candle).toBe(MAX_CANDLE - 1); // turn 1 already burned
    s = endTurn(s);
    expect(s.player.candle).toBe(MAX_CANDLE - 2);
    // Win the fight: the candle is not refilled afterwards.
    const { run, hand } = withHand(s, ['bludgeon']);
    run.combat!.enemies[0].hp = 1;
    const won = finishCombat(playCard(run, hand[0].uid, 0));
    expect(won.screen).toBe('reward');
    expect(won.player.candle).toBe(MAX_CANDLE - 2);
    // The next combat starts from the same wax.
    const next = startCombat(won, { id: 't2', tier: 'normal', enemies: ['rat'] });
    expect(next.player.candle).toBe(MAX_CANDLE - 3);
  });

  it('blackout at 0 wax: fixed HP loss each turn, but no instant defeat', () => {
    const base = withCandle(combatRun(['cultist']), 1); // cultist turn 1: no damage
    const hp = base.player.hp;
    const s = endTurn(base);
    expect(s.player.candle).toBe(0);
    expect(lightLevel(s.player)).toBe('dark');
    expect(s.player.hp).toBe(hp - BLACKOUT_DAMAGE);
    expect(s.stats.blackoutTurns).toBe(1);
    expect(s.combat!.phase).toBe('player');
    expect(s.combat!.log.some((l) => l.text.includes('암전'))).toBe(true);
    const s2 = endTurn({ ...s, combat: { ...s.combat!, hand: [] } });
    expect(s2.stats.blackoutTurns).toBe(2);
  });

  it('blackout makes enemy attacks hit 25% harder (and still hides them)', () => {
    let s = combatRun(['cultist']);
    s = endTurn(s); // incantation -> Ritual 2
    s = withCandle(s, 0);
    s.combat!.hand = [];
    const hp = s.player.hp;
    s = endTurn(s); // Strength 2 + Dark Strike 6 = 8 -> x1.25 = 10, then blackout 3
    expect(hp - s.player.hp).toBe(10 + BLACKOUT_DAMAGE);
  });

  it('blackout damage can kill, and the death is attributed to the darkness', () => {
    const base = withCandle(combatRun(['cultist']), 0);
    base.player.hp = BLACKOUT_DAMAGE;
    const s = endTurn(base);
    expect(s.player.hp).toBe(0);
    expect(s.combat!.phase).toBe('lost');
    const summary = finishCombat(s);
    expect(summary.result).toBe('defeat');
    expect(summary.deathCause).toMatch(/^암전/);
  });

  it('bright light never hides intents', () => {
    const s = combatRun(['rat', 'rat']);
    expect(s.combat!.enemies.every((e) => !e.intentHidden)).toBe(true);
    expect(describeIntent(s, 0)!.hidden).toBeFalsy();
  });

  it('dim light hides at least one intent; blackout hides all of them', () => {
    const dim = endTurn(withCandle(combatRun(['rat', 'rat', 'bat']), DIM));
    expect(lightLevel(dim.player)).toBe('dim');
    expect(dim.combat!.enemies.some((e) => e.intentHidden)).toBe(true);

    const dark = endTurn(withCandle(combatRun(['rat', 'rat', 'bat']), 1));
    expect(dark.combat!.enemies.filter((e) => e.hp > 0).every((e) => e.intentHidden)).toBe(true);
  });

  it('hidden intents are withheld from the player view but still executed', () => {
    let s = combatRun(['cultist']);
    s = endTurn(withCandle(s, 1)); // now blacked out; cultist will Dark Strike
    const enemy = s.combat!.enemies[0];
    expect(enemy.intentHidden).toBe(true);
    expect(enemy.intent).toBe('darkStrike'); // the engine still knows
    const view = describeIntent(s, 0)!;
    expect(view.hidden).toBe(true);
    expect(view.moveName).toBe('???');
    expect(view.parts.map((p) => p.kind)).toEqual(['hidden']);
    expect(JSON.stringify(view)).not.toMatch(/어둠의 일격|\d/);
    const hp = s.player.hp;
    s.combat!.hand = [];
    s = endTurn(s); // Ritual 2 -> 8 dmg x1.25 = 10, + blackout 3
    expect(hp - s.player.hp).toBe(10 + BLACKOUT_DAMAGE);
  });

  it('raising the wick spends wax to reveal hidden intents', () => {
    const s = endTurn(withCandle(combatRun(['cultist']), 10)); // 9 wax: dim
    expect(s.combat!.enemies[0].intentHidden).toBe(true);
    expect(canRevealIntents(s).ok).toBe(true);
    const r = revealIntents(s);
    expect(r.player.candle).toBe(s.player.candle - REVEAL_WAX_COST);
    expect(r.combat!.enemies[0].intentHidden).toBe(false);
    const view = describeIntent(r, 0)!;
    expect(view.hidden).toBeFalsy();
    expect(view.parts[0]).toEqual({ kind: 'attack', label: '6' }); // Dark Strike (Ritual not yet applied)
    // Nothing left to reveal, or not enough wax: rejected without changes.
    expect(revealIntents(r)).toBe(r);
    const poor = withCandle(s, REVEAL_WAX_COST - 1);
    expect(canRevealIntents(poor).ok).toBe(false);
    expect(revealIntents(poor)).toBe(poor);
  });

  it('the shadow card Gaze into the Dark reveals intents for 2 wax', () => {
    const s = endTurn(withCandle(combatRun(['cultist']), 10));
    const { run, hand } = withHand(s, ['gazeIntoDark']);
    const after = playCard(run, hand[0].uid);
    expect(after.player.candle).toBe(run.player.candle - 2);
    expect(after.combat!.enemies[0].intentHidden).toBe(false);
  });

  it('light cards restore wax, and a bright light reveals everything at once', () => {
    const base = combatRun(['cultist']);
    const { run, hand } = withHand(withCandle(base, 30), ['emberStrike']);
    const hp = run.combat!.enemies[0].hp;
    const after = playCard(run, hand[0].uid, 0);
    expect(after.player.candle).toBe(31);
    expect(after.combat!.enemies[0].hp).toBe(hp - 6);
    // Restoring is clamped to the maximum.
    const full = playCard(withCandle(run, MAX_CANDLE), hand[0].uid, 0);
    expect(full.player.candle).toBe(MAX_CANDLE);

    // Dim with a hidden intent -> Dawn Vow (+8) lifts the light above the threshold.
    const dim = endTurn(withCandle(combatRun(['cultist']), DIM - 3));
    expect(dim.combat!.enemies[0].intentHidden).toBe(true);
    const vow = withHand(dim, ['dawnVow']);
    const lit = playCard(vow.run, vow.hand[0].uid);
    expect(lightLevel(lit.player)).toBe('bright');
    expect(lit.combat!.enemies[0].intentHidden).toBe(false);
  });

  it('light cards end a blackout', () => {
    const s = endTurn(withCandle(combatRun(['cultist']), 1));
    expect(s.player.candle).toBe(0);
    const { run, hand } = withHand(s, ['wardingFlame']);
    const after = playCard(run, hand[0].uid);
    expect(after.player.candle).toBe(2);
    expect(lightLevel(after.player)).toBe('dim');
  });

  it('shadow cards burn wax, and a shortfall is paid in HP', () => {
    const base = combatRun(['cultist']);
    const { run, hand } = withHand(withCandle(base, 30), ['shadowStrike']);
    const hp = run.combat!.enemies[0].hp;
    const after = playCard(run, hand[0].uid, 0);
    expect(after.player.candle).toBe(28);
    expect(after.combat!.enemies[0].hp).toBe(hp - 10);

    const poor = withCandle(run, 1);
    const playerHp = poor.player.hp;
    const burned = playCard(poor, hand[0].uid, 0);
    expect(burned.player.candle).toBe(0);
    expect(burned.player.hp).toBe(playerHp - 1);
  });

  it('Night Stalker strikes twice in the dark (its own wax cost counts)', () => {
    const base = combatRun(['cultist']);
    const bright = withHand(withCandle(base, 40), ['nightStalker']);
    const hp = bright.run.combat!.enemies[0].hp;
    expect(playCard(bright.run, bright.hand[0].uid, 0).combat!.enemies[0].hp).toBe(hp - 7);
    // DIM + 1 wax -> paying 2 drops below the threshold -> bonus hit.
    const edge = withHand(withCandle(base, DIM + 1), ['nightStalker']);
    expect(playCard(edge.run, edge.hand[0].uid, 0).combat!.enemies[0].hp).toBe(hp - 14);
  });

  it('Kindle (Sanctuary Lamp) offsets the per-turn drain', () => {
    const base = combatRun(['cultist']);
    const { run, hand } = withHand(withCandle(base, 30), ['sanctuaryLamp']);
    let s = playCard(run, hand[0].uid);
    expect(s.player.candle).toBe(31);
    expect(s.combat!.player.statuses.kindle).toBe(1);
    s = endTurn(s);
    expect(s.player.candle).toBe(31);
  });

  it('enemies can snuff the candle, and their intent shows it', () => {
    const s = combatRun(['boneQueen'], 'boss'); // turn 1: curse (-3 wax)
    const view = describeIntent(s, 0)!;
    expect(view.parts.some((p) => p.label === '촛농 -3')).toBe(true);
    const wax = s.player.candle;
    const after = endTurn(s);
    expect(after.player.candle).toBe(wax - 3 - 1);
  });

  it('describes wax costs on cards', () => {
    expect(describeCard({ uid: 'x', defId: 'shadowStrike', upgraded: false })).toMatch(
      /^촛농 2 소모\./,
    );
    expect(describeCard({ uid: 'x', defId: 'emberStrike', upgraded: false })).toMatch(
      /^촛농 1 회복\./,
    );
    expect(describeCard({ uid: 'x', defId: 'nightStalker', upgraded: false })).toContain(
      '어둠 속이면',
    );
  });
});
