import { describe, expect, it } from 'vitest';
import type { RunState } from '../types';
import { MAX_CANDLE, SHOP_CANDLE_AMOUNT } from './candle';
import { playCard, startCombat } from './combat';
import {
  buyShopCandle,
  buyShopCard,
  buyShopRelic,
  chooseEventOption,
  createRun,
  finishCombat,
  leaveEvent,
  leaveReward,
  resolveEventPick,
  restHeal,
  restRekindle,
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
      candlePrice: 35,
      candleUsed: false,
    };
    run.player.gold = 120;
    run = buyShopCard(run, 0);
    expect(run.player.gold).toBe(70);
    expect(run.player.deck.some((c) => c.uid === 'x')).toBe(true);
    expect(buyShopCard(run, 0)).toBe(run); // already sold
    expect(shopRemoveCard(run, run.player.deck[0].uid)).toBe(run); // 70 < 75 gold
  });
});

describe('candle across the run', () => {
  it('a new run starts with a full candle', () => {
    const run = createRun(1);
    expect(run.player.candle).toBe(MAX_CANDLE);
    expect(run.player.maxCandle).toBe(MAX_CANDLE);
  });

  it('rest site can rekindle the candle instead of healing', () => {
    const run = createRun(5);
    run.player.candle = 10;
    run.rest = { done: false, note: null };
    run.screen = 'rest';
    const lit = restRekindle(run);
    expect(lit.player.candle).toBe(10 + MAX_CANDLE / 2);
    expect(lit.rest!.done).toBe(true);
    expect(restHeal(lit)).toBe(lit); // one choice per rest site
    const full = structuredClone(run);
    full.player.candle = MAX_CANDLE;
    expect(restRekindle(full)).toBe(full); // nothing to rekindle
  });

  it('shops sell one candle per visit', () => {
    let run = createRun(5);
    run.player.candle = 5;
    run.player.gold = 100;
    run.screen = 'shop';
    run.shop = {
      cards: [],
      relics: [{ relicId: 'silverCandlestick', price: 10, sold: false }],
      removePrice: 75,
      removeUsed: false,
      candlePrice: 35,
      candleUsed: false,
    };
    run = buyShopCandle(run);
    expect(run.player.candle).toBe(5 + SHOP_CANDLE_AMOUNT);
    expect(run.player.gold).toBe(65);
    expect(buyShopCandle(run)).toBe(run);
    // Silver Candlestick raises the maximum and refills a bit.
    run = buyShopRelic(run, 0);
    expect(run.player.maxCandle).toBe(MAX_CANDLE + 15);
    expect(run.player.candle).toBe(5 + SHOP_CANDLE_AMOUNT + 15);
  });

  it('descending to the next act restores half of the missing wax', () => {
    const rewarded = winBossFight(1);
    rewarded.player.candle = 10;
    const next = leaveReward(rewarded);
    expect(next.act).toBe(2);
    expect(next.player.candle).toBe(10 + Math.ceil((MAX_CANDLE - 10) / 2));
  });

  it('events can restore or spend wax', () => {
    let run = createRun(5);
    run.player.candle = 30;
    run.screen = 'event';
    run.event = { eventId: 'chandler', chosenOption: null, pendingPick: null, notes: [] };
    expect(chooseEventOption(run, 0).player.candle).toBe(50);
    const sealed = chooseEventOption(run, 1);
    expect(sealed.player.candle).toBe(22);
    const shadow = chooseEventOption(run, 2);
    expect(shadow.player.candle).toBe(24);
    expect(shadow.player.deck).toHaveLength(11);
    const added = shadow.player.deck[shadow.player.deck.length - 1];
    expect(added.defId).toMatch(
      /shadowStrike|duskVeil|gazeIntoDark|nightStalker|devouringDark|umbralForm/,
    );
    // Burning never goes below zero.
    run = structuredClone(run);
    run.player.candle = 3;
    expect(chooseEventOption(run, 1).player.candle).toBe(0);
  });

  it('Wax Seal restores wax after a won fight', () => {
    let run = createRun(3);
    run.player.relics = ['waxSeal'];
    run = startCombat(run, { id: 't', tier: 'normal', enemies: ['rat'] });
    run.combat!.enemies[0].hp = 1;
    run.combat!.hand = [{ uid: 'k', defId: 'strike', upgraded: false }];
    run.player.candle = 20;
    const won = finishCombat(playCard(run, 'k', 0));
    expect(won.player.candle).toBe(23);
  });
});
