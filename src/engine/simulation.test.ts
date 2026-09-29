import { describe, expect, it } from 'vitest';
import type { CardInstance, RunState } from '../types';
import { REVEAL_WAX_COST, lightLevel, type LightLevel } from './candle';
import { canUpgrade, cardResonance, getCardDef, getCardStats } from './cards';
import {
  canPlayCard,
  canRevealIntents,
  describeIntent,
  endTurn,
  playCard,
  revealIntents,
} from './combat';
import { reachableNodeIds } from './map';
import {
  buyShopCandle,
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
  restRekindle,
  restUpgrade,
  selectNode,
} from './run';

function assertInvariants(run: RunState): void {
  const p = run.player;
  expect(p.hp).toBeGreaterThanOrEqual(0);
  expect(p.hp).toBeLessThanOrEqual(p.maxHp);
  expect(p.gold).toBeGreaterThanOrEqual(0);
  expect(p.candle).toBeGreaterThanOrEqual(0);
  expect(p.candle).toBeLessThanOrEqual(p.maxCandle);
  if (run.screen === 'combat') {
    const c = run.combat!;
    // Bright light never hides anything; blackout hides every living intent.
    const level = lightLevel(p);
    c.enemies.forEach((e, i) => {
      if (level === 'bright') expect(e.intentHidden).toBe(false);
      // Hidden intents must not leak through the player-facing view.
      if (e.hp > 0 && e.intentHidden) {
        const view = describeIntent(run, i)!;
        expect(view.hidden).toBe(true);
        expect(view.parts.every((part) => part.kind === 'hidden')).toBe(true);
      }
    });
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

export interface CandleTrace {
  /** Player turns started at each light level. */
  turnsByLight: Record<LightLevel, number>;
  /** Wax when each boss fight started (index = act - 1). */
  candleAtBoss: number[];
  /** Times the bot paid wax to reveal hidden intents. */
  reveals: number;
}

const low = (run: RunState, share: number) => run.player.candle < run.player.maxCandle * share;

/**
 * 'aware' manages the candle (rekindles, buys candles, budgets shadow cards, pays
 * to reveal); 'careless' ignores it entirely, to show that the resource matters.
 */
type Policy = 'aware' | 'careless';

/**
 * A simple greedy bot that drives the whole run through the public API. It only
 * sees enemy intents through describeIntent, so darkness really hides them.
 */
function autoplay(
  seed: number,
  policy: Policy = 'aware',
): { run: RunState; steps: number; trace: CandleTrace } {
  const aware = policy === 'aware';
  let run = createRun(seed);
  let steps = 0;
  const trace: CandleTrace = {
    turnsByLight: { bright: 0, dim: 0, dark: 0 },
    candleAtBoss: [],
    reveals: 0,
  };
  let seenTurn = '';
  for (; steps < 50_000 && !run.result; steps++) {
    const prev = run;
    switch (run.screen) {
      case 'map': {
        const options = reachableNodeIds(run.map, run.currentNodeId);
        // Prefer rest sites when hurt or the candle is low, else walk the leftmost path.
        const needRest = run.player.hp < run.player.maxHp * 0.5 || (aware && low(run, 0.35));
        const pick =
          options.find((id) => needRest && run.map.nodes[id].type === 'rest') ??
          options.find((id) => run.map.nodes[id].type !== 'elite') ??
          options[0];
        run = selectNode(run, pick);
        if (run.combat?.tier === 'boss') trace.candleAtBoss[run.act - 1] = run.player.candle;
        break;
      }
      case 'combat': {
        const c = run.combat!;
        if (c.phase !== 'player') {
          run = finishCombat(run);
          break;
        }
        const turnKey = `${run.floor}:${c.turn}`;
        if (turnKey !== seenTurn) {
          seenTurn = turnKey;
          trace.turnsByLight[lightLevel(run.player)] += 1;
        }
        // Buy information when darkness hides intents and wax can be spared.
        if (aware && canRevealIntents(run).ok && run.player.candle >= REVEAL_WAX_COST + 4) {
          run = revealIntents(run);
          trace.reveals += 1;
          break;
        }
        const target = c.enemies
          .map((e, i) => ({ e, i }))
          .filter(({ e }) => e.hp > 0)
          .sort((a, b) => a.e.hp - b.e.hp)[0].i;
        // Powers first; block cards first while an attack is incoming and unblocked.
        // A hidden intent is treated as a possible attack.
        let unknown = false;
        const incoming = c.enemies.reduce((sum, _e, i) => {
          const intent = describeIntent(run, i);
          if (intent?.hidden) unknown = true;
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
        const needBlock = unknown || incoming > c.player.block;
        const candle = run.player.candle;
        const score = (card: CardInstance) => {
          const def = getCardDef(card.defId);
          const stats = getCardStats(card);
          const blocks = stats.effects.some((e) => e.type === 'block');
          const res = cardResonance(card);
          const wax = stats.candle ?? 0;
          return (
            (def.type === 'power' ? 4 : 0) +
            (needBlock && blocks ? 2 : 0) +
            (def.type === 'status' ? -5 : 0) +
            (aware && res === 'light' && low(run, 0.5) ? 1 : 0) +
            (aware && wax < 0 && candle + wax < run.player.maxCandle * 0.4 ? -3 : 0)
          );
        };
        const playable = c.hand
          .filter((card) => canPlayCard(run, card).ok)
          .filter((card) => {
            // Budget shadow cards: hold them once the candle is under 40%.
            const wax = getCardStats(card).candle ?? 0;
            return !aware || wax >= 0 || !low(run, 0.4);
          })
          .sort((a, b) => score(b) - score(a));
        const next = playable.length ? playCard(run, playable[0].uid, target) : run;
        run = next === run ? endTurn(run) : next;
        break;
      }
      case 'reward': {
        run = claimRewardGold(run);
        run = claimRewardRelic(run);
        const choices = run.reward!.cardChoices;
        // Take a light card when the candle is low; otherwise prefer non-light cards.
        const light = choices.findIndex((card) => cardResonance(card) === 'light');
        const other = choices.findIndex((card) => cardResonance(card) !== 'light');
        const pick = low(run, 0.5) && light >= 0 ? light : Math.max(0, other);
        run = pickRewardCard(run, aware ? pick : 0);
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
        if (aware && low(run, 0.6)) run = buyShopCandle(run);
        run = buyShopCard(run, 0);
        run = leaveShop(run);
        break;
      case 'rest': {
        if (!run.rest!.done) {
          const p = run.player;
          const up = p.deck.find(canUpgrade);
          // Nearly out of wax: blackout is worse than a missing chunk of HP.
          if (aware && low(run, 0.25) && p.hp >= p.maxHp * 0.3) run = restRekindle(run);
          else if (p.hp < p.maxHp * 0.5) run = restHeal(run);
          else if (aware && low(run, 0.4)) run = restRekindle(run);
          else if (p.hp < p.maxHp * 0.7 || !up) run = restHeal(run);
          else run = restUpgrade(run, up.uid);
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
  return { run, steps, trace };
}

interface Batch {
  runs: Array<{ run: RunState; trace: CandleTrace }>;
  turns: Record<LightLevel, number>;
  blackoutDeaths: number;
}

function playBatch(seeds: number, policy: Policy): Batch {
  const runs: Batch['runs'] = [];
  const turns = { bright: 0, dim: 0, dark: 0 };
  for (let seed = 1; seed <= seeds; seed++) {
    const { run, trace } = autoplay(seed, policy);
    expect(run.result).not.toBeNull();
    expect(run.screen).toBe('summary');
    runs.push({ run, trace });
    for (const k of ['bright', 'dim', 'dark'] as const) turns[k] += trace.turnsByLight[k];
    if (process.env.SIM_DEBUG)
      console.log(
        policy,
        seed,
        `act ${run.act} floor ${run.floor}`,
        run.deathCause,
        `deck ${run.player.deck.length}`,
        `candle ${run.player.candle}/${run.player.maxCandle}`,
        `turns bright/dim/dark ${trace.turnsByLight.bright}/${trace.turnsByLight.dim}/${trace.turnsByLight.dark}`,
        `boss wax ${trace.candleAtBoss.join(',')}`,
        `reveals ${trace.reveals}`,
      );
  }
  const blackoutDeaths = runs.filter(({ run }) => run.deathCause?.startsWith('암전')).length;
  const wins = runs.filter(({ run }) => run.result === 'victory').length;
  const byAct = [1, 2, 3].map((a) => runs.filter(({ run }) => run.act === a).length);
  console.log(
    `[${policy}] bot outcomes over ${seeds} seeds: ${wins} wins; final act distribution`,
    byAct,
    `; turns bright/dim/dark ${turns.bright}/${turns.dim}/${turns.dark}`,
    `; blackout deaths ${blackoutDeaths}`,
  );
  return { runs, turns, blackoutDeaths };
}

const share = (b: Batch, level: LightLevel) =>
  b.turns[level] / (b.turns.bright + b.turns.dim + b.turns.dark);

describe('full-run simulation', () => {
  const SEEDS = 40;
  let awareBatch: Batch | undefined;
  let carelessBatch: Batch | undefined;
  const getAware = () => (awareBatch ??= playBatch(SEEDS, 'aware'));
  const getCareless = () => (carelessBatch ??= playBatch(SEEDS, 'careless'));
  const wins = (b: Batch) => b.runs.filter(({ run }) => run.result === 'victory').length;

  it('runs are deterministic for a given seed', () => {
    const a = autoplay(777).run;
    const b = autoplay(777).run;
    expect(a.stats).toEqual(b.stats);
    expect(a.result).toBe(b.result);
  });

  it('every seeded run reaches an end state without getting stuck', () => {
    const batch = getAware();
    for (const { run } of batch.runs) {
      // Save files must survive a JSON round-trip (localStorage).
      expect(JSON.parse(JSON.stringify(run))).toEqual(run);
    }
    // Some runs still make it deep into the dungeon with the candle system on.
    expect(batch.runs.filter(({ run }) => run.act >= 2).length).toBeGreaterThan(SEEDS / 8);
  });

  it('candle pacing: relevant for a careful player, ruinous when ignored', () => {
    const aware = getAware();
    const careless = getCareless();

    // Relevant: even a careful player regularly fights in dim light.
    const sawDim = aware.runs.filter(({ trace }) => trace.turnsByLight.dim > 0).length;
    expect(sawDim).toBeGreaterThanOrEqual(SEEDS / 4);
    // Sustainable: managing the candle keeps most turns lit and blackout rare.
    expect(share(aware, 'bright')).toBeGreaterThan(0.75);
    expect(share(aware, 'dark')).toBeLessThan(0.05);
    expect(aware.blackoutDeaths).toBeLessThanOrEqual(SEEDS / 5);
    // Ignoring it spirals: far more time in blackout and more blackout deaths.
    expect(share(careless, 'dark')).toBeGreaterThan(share(aware, 'dark') * 2);
    expect(careless.blackoutDeaths).toBeGreaterThanOrEqual(aware.blackoutDeaths * 2);
  });

  it('difficulty: a careful run is winnable but not a sure thing', () => {
    const aware = getAware();
    const careless = getCareless();
    // The simple greedy bot should win a real share of runs (about a fifth over
    // hundreds of seeds), but far from all of them.
    expect(wins(aware)).toBeGreaterThanOrEqual(SEEDS / 10);
    expect(wins(aware)).toBeLessThanOrEqual(SEEDS / 2);
    // Act 1 is a hurdle, not a wall: most runs reach Act 2.
    expect(aware.runs.filter(({ run }) => run.act >= 2).length).toBeGreaterThan(SEEDS / 2);
    // Ignoring the candle costs wins.
    expect(wins(careless)).toBeLessThan(wins(aware));
  });
});
