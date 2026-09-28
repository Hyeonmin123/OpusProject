import { FINAL_ACT, getAct } from '../data/acts';
import { STARTER_DECK } from '../data/cards';
import { EVENT_IDS, EVENTS } from '../data/events';
import { RELICS, STARTER_RELIC } from '../data/relics';
import type { EncounterDef, EnemyTier, EventOutcome, RunState } from '../types';
import { canUpgrade, cardName, makeCard } from './cards';
import { beginCombat } from './combat';
import { type Ctx, transact } from './context';
import { generateMap, reachableNodeIds } from './map';
import { createReward, createShop, gainGold, grantRelic, rollCards, rollRelic } from './rewards';
import { Rng, randomSeed } from './rng';

/** Bump when RunState changes shape; older saves are discarded. */
export const SAVE_VERSION = 1;

const STARTING_HP = 80;
const STARTING_GOLD = 99;
const REST_HEAL_PERCENT = 30;
/** Portion of missing HP restored when moving to the next act. */
const ACT_TRANSITION_HEAL = 0.75;

// ---- Run creation ----------------------------------------------------------------------

export function createRun(seed: number = randomSeed()): RunState {
  const rng = new Rng(seed);
  const map = generateMap(rng, 1);
  const run: RunState = {
    version: SAVE_VERSION,
    seed,
    rngState: rng.state,
    uidCounter: 0,
    act: 1,
    floor: 0,
    map,
    currentNodeId: null,
    visitedNodeIds: [],
    actCombats: 0,
    lastEncounterId: null,
    seenEvents: [],
    cardRemovals: 0,
    screen: 'map',
    player: {
      className: '전사',
      hp: STARTING_HP,
      maxHp: STARTING_HP,
      gold: STARTING_GOLD,
      deck: [],
      relics: [STARTER_RELIC],
      baseEnergy: 3,
      handSize: 5,
    },
    combat: null,
    reward: null,
    shop: null,
    event: null,
    rest: null,
    stats: {
      floorsClimbed: 0,
      enemiesKilled: 0,
      elitesKilled: 0,
      bossesKilled: 0,
      damageDealt: 0,
      damageTaken: 0,
      cardsPlayed: 0,
      goldEarned: 0,
      turnsTaken: 0,
    },
    result: null,
    deathCause: null,
  };
  run.player.deck = STARTER_DECK.map((id) => makeCard(run, id));
  return run;
}

// ---- Map navigation ---------------------------------------------------------------------

function pickEncounter(ctx: Ctx, tier: EnemyTier): EncounterDef {
  const act = getAct(ctx.run.act);
  let pool: EncounterDef[];
  if (tier === 'boss') pool = act.bossEncounters;
  else if (tier === 'elite') pool = act.eliteEncounters;
  else {
    pool = ctx.run.actCombats < act.easyCombats ? act.easyEncounters : act.hardEncounters;
    ctx.run.actCombats += 1;
  }
  const fresh = pool.filter((e) => e.id !== ctx.run.lastEncounterId);
  const encounter = ctx.rng.pick(fresh.length > 0 ? fresh : pool);
  ctx.run.lastEncounterId = encounter.id;
  return encounter;
}

export function canSelectNode(run: RunState, nodeId: string): boolean {
  return run.screen === 'map' && reachableNodeIds(run.map, run.currentNodeId).includes(nodeId);
}

export function selectNode(run: RunState, nodeId: string): RunState {
  return transact(run, (ctx) => {
    const r = ctx.run;
    if (!canSelectNode(r, nodeId)) return false;
    const node = r.map.nodes[nodeId];
    r.currentNodeId = nodeId;
    r.visitedNodeIds.push(nodeId);
    r.floor += 1;
    r.stats.floorsClimbed += 1;

    switch (node.type) {
      case 'combat':
        beginCombat(ctx, pickEncounter(ctx, 'normal'));
        break;
      case 'elite':
        beginCombat(ctx, pickEncounter(ctx, 'elite'));
        break;
      case 'boss':
        beginCombat(ctx, pickEncounter(ctx, 'boss'));
        break;
      case 'event': {
        let unseen = EVENT_IDS.filter((id) => !r.seenEvents.includes(id));
        if (unseen.length === 0) {
          r.seenEvents = [];
          unseen = EVENT_IDS;
        }
        const eventId = ctx.rng.pick(unseen);
        r.seenEvents.push(eventId);
        r.event = { eventId, chosenOption: null, pendingPick: null, notes: [] };
        r.screen = 'event';
        break;
      }
      case 'shop':
        r.shop = createShop(ctx);
        r.screen = 'shop';
        break;
      case 'rest':
        r.rest = { done: false, note: null };
        r.screen = 'rest';
        break;
    }
  });
}

function returnToMap(ctx: Ctx): void {
  const r = ctx.run;
  r.combat = null;
  r.reward = null;
  r.shop = null;
  r.event = null;
  r.rest = null;
  r.screen = 'map';
}

function advanceAct(ctx: Ctx): void {
  const r = ctx.run;
  if (r.act >= FINAL_ACT) {
    r.result = 'victory';
    r.combat = null;
    r.reward = null;
    r.screen = 'summary';
    return;
  }
  r.act += 1;
  r.map = generateMap(ctx.rng, r.act);
  r.currentNodeId = null;
  r.visitedNodeIds = [];
  r.actCombats = 0;
  r.lastEncounterId = null;
  const missing = r.player.maxHp - r.player.hp;
  r.player.hp += Math.floor(missing * ACT_TRANSITION_HEAL);
  returnToMap(ctx);
}

// ---- Combat resolution ------------------------------------------------------------------

/** Called after the combat screen shows its win/lose banner. */
export function finishCombat(run: RunState): RunState {
  return transact(run, (ctx) => {
    const r = ctx.run;
    const combat = r.combat;
    if (!combat || combat.phase === 'player') return false;

    if (combat.phase === 'lost') {
      r.result = 'defeat';
      r.deathCause = `${combat.enemies.map((e) => e.name).join(', ')}에게 패배`;
      r.combat = null;
      r.screen = 'summary';
      return;
    }

    if (combat.tier === 'elite') r.stats.elitesKilled += 1;
    if (combat.tier === 'boss') r.stats.bossesKilled += 1;

    let bonusGold = 0;
    for (const relicId of r.player.relics) {
      for (const trig of RELICS[relicId]?.triggers ?? []) {
        if (trig.when !== 'combatWin') continue;
        if (trig.heal) r.player.hp = Math.min(r.player.maxHp, r.player.hp + trig.heal);
        if (trig.gold) bonusGold += trig.gold;
      }
    }
    r.reward = createReward(ctx, combat.tier, bonusGold);
    r.combat = null;
    r.screen = 'reward';
  });
}

// ---- Reward screen ------------------------------------------------------------------------

export function claimRewardGold(run: RunState): RunState {
  return transact(run, (ctx) => {
    const reward = ctx.run.reward;
    if (!reward || reward.goldClaimed) return false;
    gainGold(ctx, reward.gold);
    reward.goldClaimed = true;
  });
}

export function claimRewardRelic(run: RunState): RunState {
  return transact(run, (ctx) => {
    const reward = ctx.run.reward;
    if (!reward || !reward.relicId || reward.relicClaimed) return false;
    grantRelic(ctx, reward.relicId);
    reward.relicClaimed = true;
  });
}

export function pickRewardCard(run: RunState, index: number): RunState {
  return transact(run, (ctx) => {
    const reward = ctx.run.reward;
    if (!reward || reward.cardResolved) return false;
    const card = reward.cardChoices[index];
    if (!card) return false;
    ctx.run.player.deck.push(card);
    reward.cardResolved = true;
  });
}

export function skipRewardCard(run: RunState): RunState {
  return transact(run, (ctx) => {
    const reward = ctx.run.reward;
    if (!reward || reward.cardResolved) return false;
    reward.cardResolved = true;
  });
}

/** Leaves the reward screen (unclaimed gold is collected automatically). */
export function leaveReward(run: RunState): RunState {
  return transact(run, (ctx) => {
    const r = ctx.run;
    const reward = r.reward;
    if (r.screen !== 'reward' || !reward) return false;
    if (!reward.goldClaimed) {
      gainGold(ctx, reward.gold);
      reward.goldClaimed = true;
    }
    const wasBoss = r.currentNodeId === r.map.bossId;
    if (wasBoss) advanceAct(ctx);
    else returnToMap(ctx);
  });
}

// ---- Events -------------------------------------------------------------------------------

function applyOutcome(ctx: Ctx, outcome: EventOutcome): void {
  const r = ctx.run;
  const p = r.player;
  const event = r.event!;
  switch (outcome.type) {
    case 'gold':
      gainGold(ctx, outcome.amount);
      break;
    case 'hp':
      if (outcome.amount >= 0) p.hp = Math.min(p.maxHp, p.hp + outcome.amount);
      else {
        const loss = Math.min(p.hp - 1, -outcome.amount);
        p.hp -= loss;
        r.stats.damageTaken += loss;
      }
      break;
    case 'healPercent':
      p.hp = Math.min(p.maxHp, p.hp + Math.floor((p.maxHp * outcome.percent) / 100));
      break;
    case 'maxHp':
      p.maxHp += outcome.amount;
      p.hp = Math.max(1, Math.min(p.maxHp, p.hp + outcome.amount));
      break;
    case 'randomRelic': {
      const relicId = rollRelic(ctx, 'common');
      if (relicId) {
        grantRelic(ctx, relicId);
        event.notes.push(`유물 획득: ${RELICS[relicId].name}`);
      } else {
        gainGold(ctx, 50);
        event.notes.push('더 얻을 유물이 없어 골드 50을 얻었습니다.');
      }
      break;
    }
    case 'randomCard': {
      const [card] = rollCards(ctx, 1, 'normal');
      if (card) {
        p.deck.push(card);
        event.notes.push(`카드 획득: ${cardName(card)}`);
      }
      break;
    }
    case 'addCard': {
      const card = makeCard(r, outcome.cardId);
      p.deck.push(card);
      event.notes.push(`덱에 추가됨: ${cardName(card)}`);
      break;
    }
    case 'upgradeRandom': {
      const candidates = ctx.rng.shuffle(p.deck.filter(canUpgrade));
      for (const card of candidates.slice(0, outcome.count)) {
        card.upgraded = true;
        event.notes.push(`강화됨: ${cardName(card)}`);
      }
      break;
    }
    case 'chooseRemove':
      if (p.deck.length > 1) event.pendingPick = 'remove';
      break;
    case 'chooseUpgrade':
      if (p.deck.some(canUpgrade)) event.pendingPick = 'upgrade';
      break;
  }
}

export function canChooseEventOption(run: RunState, index: number): boolean {
  const event = run.event;
  if (!event || event.chosenOption !== null) return false;
  const option = EVENTS[event.eventId]?.options[index];
  if (!option) return false;
  return option.requiresGold === undefined || run.player.gold >= option.requiresGold;
}

export function chooseEventOption(run: RunState, index: number): RunState {
  return transact(run, (ctx) => {
    if (!canChooseEventOption(ctx.run, index)) return false;
    const event = ctx.run.event!;
    const option = EVENTS[event.eventId].options[index];
    event.chosenOption = index;
    for (const outcome of option.outcomes) applyOutcome(ctx, outcome);
  });
}

/** Completes a pending remove/upgrade pick from an event. */
export function resolveEventPick(run: RunState, cardUid: string): RunState {
  return transact(run, (ctx) => {
    const event = ctx.run.event;
    if (!event || !event.pendingPick) return false;
    const deck = ctx.run.player.deck;
    const idx = deck.findIndex((c) => c.uid === cardUid);
    if (idx < 0) return false;
    const card = deck[idx];
    if (event.pendingPick === 'remove') {
      deck.splice(idx, 1);
      event.notes.push(`제거됨: ${cardName(card)}`);
    } else {
      if (!canUpgrade(card)) return false;
      card.upgraded = true;
      event.notes.push(`강화됨: ${cardName(card)}`);
    }
    event.pendingPick = null;
  });
}

export function leaveEvent(run: RunState): RunState {
  return transact(run, (ctx) => {
    const event = ctx.run.event;
    if (!event || event.chosenOption === null || event.pendingPick) return false;
    returnToMap(ctx);
  });
}

// ---- Shop ---------------------------------------------------------------------------------

export function buyShopCard(run: RunState, index: number): RunState {
  return transact(run, (ctx) => {
    const slot = ctx.run.shop?.cards[index];
    if (!slot || slot.sold || ctx.run.player.gold < slot.price) return false;
    ctx.run.player.gold -= slot.price;
    ctx.run.player.deck.push(slot.card);
    slot.sold = true;
  });
}

export function buyShopRelic(run: RunState, index: number): RunState {
  return transact(run, (ctx) => {
    const slot = ctx.run.shop?.relics[index];
    if (!slot || slot.sold || ctx.run.player.gold < slot.price) return false;
    ctx.run.player.gold -= slot.price;
    grantRelic(ctx, slot.relicId);
    slot.sold = true;
  });
}

export function shopRemoveCard(run: RunState, cardUid: string): RunState {
  return transact(run, (ctx) => {
    const shop = ctx.run.shop;
    const p = ctx.run.player;
    if (!shop || shop.removeUsed || p.gold < shop.removePrice || p.deck.length <= 1) return false;
    const idx = p.deck.findIndex((c) => c.uid === cardUid);
    if (idx < 0) return false;
    p.gold -= shop.removePrice;
    p.deck.splice(idx, 1);
    shop.removeUsed = true;
    ctx.run.cardRemovals += 1;
  });
}

export function leaveShop(run: RunState): RunState {
  return transact(run, (ctx) => {
    if (ctx.run.screen !== 'shop') return false;
    returnToMap(ctx);
  });
}

// ---- Rest site ------------------------------------------------------------------------------

export function restHealAmount(run: RunState): number {
  return Math.floor((run.player.maxHp * REST_HEAL_PERCENT) / 100);
}

export function restHeal(run: RunState): RunState {
  return transact(run, (ctx) => {
    const rest = ctx.run.rest;
    if (!rest || rest.done) return false;
    const p = ctx.run.player;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + restHealAmount(ctx.run));
    rest.done = true;
    rest.note = `체력을 ${p.hp - before} 회복했습니다.`;
  });
}

export function restUpgrade(run: RunState, cardUid: string): RunState {
  return transact(run, (ctx) => {
    const rest = ctx.run.rest;
    if (!rest || rest.done) return false;
    const card = ctx.run.player.deck.find((c) => c.uid === cardUid);
    if (!card || !canUpgrade(card)) return false;
    card.upgraded = true;
    rest.done = true;
    rest.note = `${cardName(card)}(으)로 강화했습니다.`;
  });
}

export function leaveRest(run: RunState): RunState {
  return transact(run, (ctx) => {
    if (ctx.run.screen !== 'rest') return false;
    returnToMap(ctx);
  });
}

// ---- Misc ------------------------------------------------------------------------------------

export function abandonRun(run: RunState): RunState {
  return transact(run, (ctx) => {
    if (ctx.run.result) return false;
    ctx.run.result = 'defeat';
    ctx.run.deathCause = '탐험 포기';
    ctx.run.combat = null;
    ctx.run.screen = 'summary';
  });
}
