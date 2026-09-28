import { REWARD_POOL } from '../data/cards';
import { RELICS } from '../data/relics';
import type {
  CardDef,
  CardInstance,
  CardRarity,
  EnemyTier,
  RelicRarity,
  RewardState,
  ShopState,
} from '../types';
import { restoreCandle, shopCandlePrice } from './candle';
import { makeCard } from './cards';
import type { Ctx } from './context';

const RARITY_WEIGHTS: Record<EnemyTier, Array<[CardRarity, number]>> = {
  normal: [
    ['common', 60],
    ['uncommon', 33],
    ['rare', 7],
  ],
  elite: [
    ['common', 45],
    ['uncommon', 40],
    ['rare', 15],
  ],
  boss: [['rare', 1]],
};

/** Rolls `count` distinct reward cards (optionally only cards matching `filter`). */
export function rollCards(
  ctx: Ctx,
  count: number,
  tier: EnemyTier,
  filter: (def: CardDef) => boolean = () => true,
): CardInstance[] {
  const picked = new Set<string>();
  const result: CardInstance[] = [];
  for (let guard = 0; result.length < count && guard < 100; guard++) {
    const rarity = ctx.rng.weighted(RARITY_WEIGHTS[tier]);
    const pool = REWARD_POOL.filter(
      (c) => c.rarity === rarity && !picked.has(c.id) && filter(c),
    );
    if (pool.length === 0) continue;
    const def = ctx.rng.pick(pool);
    picked.add(def.id);
    result.push(makeCard(ctx.run, def.id));
  }
  return result;
}

/** A relic of the given rarity the player does not own yet (null if exhausted). */
export function rollRelic(ctx: Ctx, rarity: RelicRarity, exclude: string[] = []): string | null {
  const pool = Object.values(RELICS).filter(
    (r) => r.rarity === rarity && !ctx.run.player.relics.includes(r.id) && !exclude.includes(r.id),
  );
  return pool.length > 0 ? ctx.rng.pick(pool).id : null;
}

/** Adds a relic to the player and fires its pickup trigger. */
export function grantRelic(ctx: Ctx, relicId: string): void {
  const relic = RELICS[relicId];
  if (!relic || ctx.run.player.relics.includes(relicId)) return;
  const p = ctx.run.player;
  p.relics.push(relicId);
  for (const trig of relic.triggers) {
    if (trig.when !== 'pickup') continue;
    if (trig.maxHp) p.maxHp += trig.maxHp;
    if (trig.heal) p.hp = Math.min(p.maxHp, p.hp + trig.heal);
    if (trig.gold) gainGold(ctx, trig.gold);
    if (trig.maxCandle) p.maxCandle += trig.maxCandle;
    if (trig.candle) restoreCandle(p, trig.candle);
  }
}

export function gainGold(ctx: Ctx, amount: number): void {
  ctx.run.player.gold = Math.max(0, ctx.run.player.gold + amount);
  if (amount > 0) ctx.run.stats.goldEarned += amount;
}

export function createReward(ctx: Ctx, tier: EnemyTier, bonusGold: number): RewardState {
  const rng = ctx.rng;
  const baseGold =
    tier === 'boss' ? rng.int(70, 90) : tier === 'elite' ? rng.int(25, 35) : rng.int(10, 20);
  let relicId: string | null = null;
  if (tier === 'boss') relicId = rollRelic(ctx, 'boss');
  else if (tier === 'elite' || rng.chance(0.1)) relicId = rollRelic(ctx, 'common');
  return {
    tier,
    gold: baseGold + bonusGold,
    goldClaimed: false,
    cardChoices: rollCards(ctx, 3, tier),
    cardResolved: false,
    relicId,
    relicClaimed: false,
  };
}

const PRICE: Record<CardRarity, [number, number]> = {
  starter: [30, 40],
  common: [45, 55],
  uncommon: [68, 82],
  rare: [135, 165],
  special: [0, 0],
};

export function createShop(ctx: Ctx): ShopState {
  const cards = rollCards(ctx, 5, 'normal').map((card) => {
    const def = REWARD_POOL.find((c) => c.id === card.defId)!;
    const [lo, hi] = PRICE[def.rarity];
    return { card, price: ctx.rng.int(lo, hi), sold: false };
  });
  const relics: ShopState['relics'] = [];
  for (let i = 0; i < 2; i++) {
    const id = rollRelic(
      ctx,
      'common',
      relics.map((r) => r.relicId),
    );
    if (id) relics.push({ relicId: id, price: ctx.rng.int(140, 170), sold: false });
  }
  return {
    cards,
    relics,
    removePrice: 75 + 25 * ctx.run.cardRemovals,
    removeUsed: false,
    candlePrice: shopCandlePrice(ctx.run.act),
    candleUsed: false,
  };
}
