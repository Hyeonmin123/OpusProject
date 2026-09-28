import { describe, expect, it } from 'vitest';
import type { CardInstance, RunState } from '../types';
import { canUpgrade, getCardDef, getCardStats } from './cards';
import { canPlayCard, describeIntent, endTurn, playCard } from './combat';
import { reachableNodeIds } from './map';
import {
  buyShopCard,
  canChooseEventOption,
  chooseEventOption,
  claimRewardGold,
  claimRewardRelic,
  createRun,
  finishCombat,
  leaveEvent,
  leaveRest,
  leaveReward,
  leaveShop,
  pickRewardCard,
  resolveEventPick,
  restHeal,
  restUpgrade,
  selectNode,
} from './run';

function assertInvariants(run: RunState): void {
  const p = run.player;
  expect(p.hp).toBeGreaterThanOrEqual(0);
  expect(p.hp).toBeLessThanOrEqual(p.maxHp);
  expect(p.gold).toBeGreaterThanOrEqual(0);
  if (run.screen === 'combat') {
    const c = run.combat!;
    expect(c).not.toBeNull();
    expect(c.energy).toBeGreaterThanOrEqual(0);
    const uids = [...c.hand, ...c.drawPile, ...c.discardPile, ...c.exhaustPile].map((x) => x.uid);
    expect(new Set(uids).size).toBe(uids.length);
    expect(c.hand.length).toBeLessThanOrEqual(10);
    for (const e of c.enemies) {
      expect(e.hp).toBeGreaterThanOrEqual(0);
      if (e.hp > 0 && c.phase === 'player') expect(e.intent).not.toBeNull();
    }
  }
  if (run.screen === 'reward') expect(run.reward).not.toBeNull();
  if (run.screen === 'event') expect(run.event).not.toBeNull();
  if (run.screen === 'shop') expect(run.shop).not.toBeNull();
  if (run.screen === 'rest') expect(run.rest).not.toBeNull();
}

/** A simple greedy bot that drives the whole run through the public API. */
function autoplay(seed: number): { run: RunState; steps: number } {
  let run = createRun(seed);
  let steps = 0;
  for (; steps < 50_000 && !run.result; steps++) {
    const prev = run;
    switch (run.screen) {
      case 'map': {
        const options = reachableNodeIds(run.map, run.currentNodeId);
        // Prefer rest sites when hurt, otherwise walk the leftmost path.
        const hurt = run.player.hp < run.player.maxHp * 0.5;
        const pick =
          options.find((id) => hurt && run.map.nodes[id].type === 'rest') ??
          options.find((id) => run.map.nodes[id].type !== 'elite') ??
          options[0];
        run = selectNode(run, pick);
        break;
      }
      case 'combat': {
        const c = run.combat!;
        if (c.phase !== 'player') {
          run = finishCombat(run);
          break;
        }
        const target = c.enemies
          .map((e, i) => ({ e, i }))
          .filter(({ e }) => e.hp > 0)
          .sort((a, b) => a.e.hp - b.e.hp)[0].i;
        // Powers first; block cards first while an attack is incoming and unblocked.
        const incoming = c.enemies.reduce((sum, _e, i) => {
          const intent = describeIntent(run, i);
          return (
            sum +
            (intent?.parts ?? [])
              .filter((p) => p.kind === 'attack')
              .reduce((s, p) => {
                const [dmg, times = '1'] = p.label.split('×');
                return s + Number(dmg) * Number(times);
              }, 0)
          );
        }, 0);
        const needBlock = incoming > c.player.block;
        const score = (card: CardInstance) => {
          const def = getCardDef(card.defId);
          const blocks = getCardStats(card).effects.some((e) => e.type === 'block');
          return (
            (def.type === 'power' ? 4 : 0) +
            (needBlock && blocks ? 2 : 0) +
            (def.type === 'status' ? -5 : 0)
          );
        };
        const playable = c.hand
          .filter((card) => canPlayCard(run, card).ok)
          .sort((a, b) => score(b) - score(a));
        const next = playable.length ? playCard(run, playable[0].uid, target) : run;
        run = next === run ? endTurn(run) : next;
        break;
      }
      case 'reward': {
        run = claimRewardGold(run);
        run = claimRewardRelic(run);
        run = pickRewardCard(run, 0);
        run = leaveReward(run);
        break;
      }
      case 'event': {
        const ev = run.event!;
        if (ev.chosenOption === null) {
          const idx = [0, 1, 2, 3].find((i) => canChooseEventOption(run, i)) ?? 0;
          run = chooseEventOption(run, idx);
        } else if (ev.pendingPick) {
          const card =
            ev.pendingPick === 'upgrade' ? run.player.deck.find(canUpgrade)! : run.player.deck[0];
          run = resolveEventPick(run, card.uid);
        } else run = leaveEvent(run);
        break;
      }
      case 'shop':
        run = buyShopCard(run, 0);
        run = leaveShop(run);
        break;
      case 'rest': {
        if (!run.rest!.done) {
          const up = run.player.deck.find(canUpgrade);
          run =
            run.player.hp < run.player.maxHp * 0.7 || !up
              ? restHeal(run)
              : restUpgrade(run, up.uid);
        }
        run = leaveRest(run);
        break;
      }
      case 'summary':
        break;
    }
    assertInvariants(run);
    // Every step must make progress (no stuck states).
    expect(run).not.toBe(prev);
  }
  return { run, steps };
}

describe('full-run simulation', () => {
  it('runs are deterministic for a given seed', () => {
    const a = autoplay(777).run;
    const b = autoplay(777).run;
    expect(a.stats).toEqual(b.stats);
    expect(a.result).toBe(b.result);
  });

  it('every seeded run reaches an end state without getting stuck', () => {
    const outcomes: Array<{ seed: number; result: string | null; act: number; floor: number }> = [];
    for (let seed = 1; seed <= 40; seed++) {
      const { run } = autoplay(seed);
      expect(run.result).not.toBeNull();
      expect(run.screen).toBe('summary');
      // Save files must survive a JSON round-trip (localStorage).
      expect(JSON.parse(JSON.stringify(run))).toEqual(run);
      outcomes.push({ seed, result: run.result, act: run.act, floor: run.floor });
      if (process.env.SIM_DEBUG)
        console.log(seed, run.act, run.floor, run.deathCause, run.player.deck.length);
    }
    const wins = outcomes.filter((o) => o.result === 'victory').length;
    const byAct = [1, 2, 3].map((a) => outcomes.filter((o) => o.act === a).length);
    console.log(`bot outcomes over 40 seeds: ${wins} wins; final act distribution`, byAct);
  });
});
