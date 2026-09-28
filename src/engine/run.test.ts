import { describe, expect, it } from 'vitest';
import type { RunState } from '../types';
import { playCard, startCombat } from './combat';
import {
  buyShopCard,
  chooseEventOption,
  createRun,
  finishCombat,
  leaveEvent,
  leaveReward,
  resolveEventPick,
  restHeal,
  restUpgrade,
  selectNode,
  shopRemoveCard,
} from './run';

/** Puts the run into a won boss fight on `act` (enemy at 1 HP, Strike in hand). */
function winBossFight(act: number): RunState {
  let run = createRun(99);
  run.act = act;
  run.currentNodeId = run.map.bossId;
  const boss = { 1: 'rottingGolem', 2: 'boneQueen', 3: 'abyssalEye' }[act]!;
  run = startCombat(run, { id: 'boss', tier: 'boss', enemies: [boss] });
  run.combat!.enemies[0].hp = 1;
  run.combat!.enemies[0].block = 0;
  run.combat!.hand = [{ uid: 'k', defId: 'strike', upgraded: false }];
  run = playCard(run, 'k', 0);
  expect(run.combat!.phase).toBe('won');
  return finishCombat(run);
}

describe('run flow', () => {
  it('new run starts on the map with the starter deck and relic', () => {
    const run = createRun(1);
    expect(run.screen).toBe('map');
    expect(run.player.deck).toHaveLength(10);
    expect(run.player.relics).toEqual(['burningBlood']);
    expect(run.currentNodeId).toBeNull();
  });

  it('only reachable nodes can be selected', () => {
    const run = createRun(1);
    expect(selectNode(run, run.map.bossId)).toBe(run);
    const first = selectNode(run, run.map.startIds[0]);
    expect(first.screen).toBe('combat');
    expect(first.floor).toBe(1);
  });

  it('beating the Act 1 boss moves to a fresh Act 2 map', () => {
    const rewarded = winBossFight(1);
    expect(rewarded.screen).toBe('reward');
    expect(rewarded.reward!.relicId).not.toBeNull(); // boss relic
    const next = leaveReward(rewarded);
    expect(next.act).toBe(2);
    expect(next.screen).toBe('map');
    expect(next.currentNodeId).toBeNull();
    expect(next.map.act).toBe(2);
    expect(next.result).toBeNull();
  });

  it('beating the Act 3 boss wins the run', () => {
    const done = leaveReward(winBossFight(3));
    expect(done.result).toBe('victory');
    expect(done.screen).toBe('summary');
  });

  it('rest site heals or upgrades exactly once', () => {
    let run = createRun(5);
    run.player.hp = 40;
    run.rest = { done: false, note: null };
    run.screen = 'rest';
    const healed = restHeal(run);
    expect(healed.player.hp).toBe(64);
    expect(restHeal(healed)).toBe(healed);
    const upgraded = restUpgrade(run, run.player.deck[0].uid);
    expect(upgraded.player.deck[0].upgraded).toBe(true);
    run = upgraded;
    expect(restUpgrade(run, run.player.deck[1].uid)).toBe(run);
  });

  it('events apply outcomes and card picks', () => {
    let run = createRun(5);
    run.screen = 'event';
    run.event = { eventId: 'spring', chosenOption: null, pendingPick: null, notes: [] };
    run = chooseEventOption(run, 1); // remove a card
    expect(run.event!.pendingPick).toBe('remove');
    expect(leaveEvent(run)).toBe(run); // must pick first
    run = resolveEventPick(run, run.player.deck[0].uid);
    expect(run.player.deck).toHaveLength(9);
    run = leaveEvent(run);
    expect(run.screen).toBe('map');
  });

  it('shop purchases spend gold and respect prices', () => {
    let run = createRun(5);
    run.screen = 'shop';
    run.shop = {
      cards: [{ card: { uid: 'x', defId: 'cleave', upgraded: false }, price: 50, sold: false }],
      relics: [],
      removePrice: 75,
      removeUsed: false,
    };
    run.player.gold = 120;
    run = buyShopCard(run, 0);
    expect(run.player.gold).toBe(70);
    expect(run.player.deck.some((c) => c.uid === 'x')).toBe(true);
    expect(buyShopCard(run, 0)).toBe(run); // already sold
    expect(shopRemoveCard(run, run.player.deck[0].uid)).toBe(run); // 70 < 75 gold
  });
});
