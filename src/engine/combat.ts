import { getAct } from '../data/acts';
import { ENEMIES } from '../data/enemies';
import { RELICS } from '../data/relics';
import { STATUSES } from '../data/statuses';
import type {
  CardInstance,
  CombatState,
  Effect,
  EncounterDef,
  EnemyDef,
  EnemyState,
  RunState,
  StatusId,
  StatusMap,
} from '../types';
import {
  BLACKOUT_DAMAGE,
  BLACKOUT_ENEMY_DAMAGE_BONUS,
  DIM_HIDE_CHANCE,
  REVEAL_WAX_COST,
  burnCandle,
  candleDrainPerTurn,
  isBlackout,
  lightLevel,
} from './candle';
import { cardName, cardNeedsTarget, getCardDef, getCardStats, makeCard } from './cards';
import { type Ctx, nextUid, transact } from './context';
import { calcAttackDamage, calcBlockGain } from './math';
import { addStatus, decayDurationStatuses, getStatus } from './statuses';

export const MAX_HAND_SIZE = 10;

// ---- Fighter abstraction -----------------------------------------------------------
// The player's HP lives on the persistent PlayerState while block/statuses are
// combat-only, so we expose both sides through one small interface.

export type FighterRef = { kind: 'player' } | { kind: 'enemy'; index: number };
const PLAYER: FighterRef = { kind: 'player' };

interface Fighter {
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  statuses: StatusMap;
}

function combatOf(ctx: Ctx): CombatState {
  if (!ctx.run.combat) throw new Error('No active combat');
  return ctx.run.combat;
}

function fighter(ctx: Ctx, ref: FighterRef): Fighter {
  const combat = combatOf(ctx);
  if (ref.kind === 'enemy') return combat.enemies[ref.index];
  const p = ctx.run.player;
  const cp = combat.player;
  return {
    name: p.className,
    get hp() {
      return p.hp;
    },
    set hp(v: number) {
      p.hp = v;
    },
    get maxHp() {
      return p.maxHp;
    },
    set maxHp(v: number) {
      p.maxHp = v;
    },
    get block() {
      return cp.block;
    },
    set block(v: number) {
      cp.block = v;
    },
    statuses: cp.statuses,
  };
}

const alive = (ctx: Ctx, ref: FighterRef): boolean => fighter(ctx, ref).hp > 0;

function livingEnemyRefs(combat: CombatState): FighterRef[] {
  return combat.enemies
    .map((e, index) => ({ e, index }))
    .filter(({ e }) => e.hp > 0)
    .map(({ index }) => ({ kind: 'enemy', index }));
}

function opponents(ctx: Ctx, actor: FighterRef): FighterRef[] {
  if (actor.kind === 'player') return livingEnemyRefs(combatOf(ctx));
  return alive(ctx, PLAYER) ? [PLAYER] : [];
}

function log(ctx: Ctx, text: string, side: 'player' | 'enemy' | 'system' = 'system'): void {
  const combat = combatOf(ctx);
  combat.logCounter += 1;
  combat.log.push({ id: combat.logCounter, turn: combat.turn, text, side });
  if (combat.log.length > 60) combat.log.splice(0, combat.log.length - 60);
}

// ---- Primitive operations ------------------------------------------------------------

function resolveTargets(
  ctx: Ctx,
  actor: FighterRef,
  spec: 'self' | 'target' | 'allEnemies' | 'random',
  chosen: FighterRef | null,
): FighterRef[] {
  switch (spec) {
    case 'self':
      return [actor];
    case 'allEnemies':
      return opponents(ctx, actor);
    case 'random': {
      const opp = opponents(ctx, actor);
      return opp.length > 0 ? [ctx.rng.pick(opp)] : [];
    }
    case 'target': {
      if (actor.kind === 'enemy') return opponents(ctx, actor);
      // Player: the chosen enemy (no retargeting if it died mid-card).
      if (chosen) return alive(ctx, chosen) ? [chosen] : [];
      return opponents(ctx, actor).slice(0, 1);
    }
  }
}

function handleEnemyDeath(ctx: Ctx, enemy: EnemyState): void {
  enemy.hp = 0;
  enemy.block = 0;
  enemy.intent = null;
  enemy.intentHidden = false;
  for (const id of Object.keys(enemy.statuses) as StatusId[]) delete enemy.statuses[id];
  ctx.run.stats.enemiesKilled += 1;
  log(ctx, `${enemy.name} 처치!`, 'system');
}

/** Applies damage through block. Returns HP actually lost. */
function applyDamage(ctx: Ctx, ref: FighterRef, amount: number): number {
  const f = fighter(ctx, ref);
  if (f.hp <= 0 || amount <= 0) return 0;
  const blocked = Math.min(f.block, amount);
  f.block -= blocked;
  const hpLoss = Math.min(f.hp, amount - blocked);
  f.hp -= hpLoss;
  if (ref.kind === 'enemy') ctx.run.stats.damageDealt += hpLoss;
  else ctx.run.stats.damageTaken += hpLoss;
  if (f.hp <= 0 && ref.kind === 'enemy') handleEnemyDeath(ctx, combatOf(ctx).enemies[ref.index]);
  return hpLoss;
}

function loseHp(ctx: Ctx, ref: FighterRef, amount: number): void {
  const f = fighter(ctx, ref);
  if (f.hp <= 0) return;
  const loss = Math.min(f.hp, amount);
  f.hp -= loss;
  if (ref.kind === 'player') ctx.run.stats.damageTaken += loss;
  else {
    ctx.run.stats.damageDealt += loss;
    if (f.hp <= 0) handleEnemyDeath(ctx, combatOf(ctx).enemies[ref.index]);
  }
}

function attack(ctx: Ctx, source: FighterRef, target: FighterRef, base: number): void {
  const src = fighter(ctx, source);
  const tgt = fighter(ctx, target);
  if (src.hp <= 0 || tgt.hp <= 0) return;
  const dmg = calcAttackDamage(base, src.statuses, tgt.statuses, attackBonus(ctx.run, source));
  const blocked = Math.min(tgt.block, dmg);
  applyDamage(ctx, target, dmg);
  log(
    ctx,
    `${src.name} → ${tgt.name}: 피해 ${dmg}${blocked > 0 ? ` (방어 ${blocked})` : ''}`,
    source.kind === 'player' ? 'player' : 'enemy',
  );
  const thorns = getStatus(tgt.statuses, 'thorns');
  if (thorns > 0 && src.hp > 0) {
    applyDamage(ctx, source, thorns);
    log(ctx, `가시: ${src.name}에게 피해 ${thorns}`, 'system');
  }
}

/** Percent damage bonus for an attacker: enemies hit harder while the player is in blackout. */
function attackBonus(run: RunState, source: FighterRef): number {
  return source.kind === 'enemy' && isBlackout(run) ? BLACKOUT_ENEMY_DAMAGE_BONUS : 0;
}

// ---- Candle & darkness -----------------------------------------------------------------

/** Clears every hidden intent. Returns true if anything was revealed. */
function revealAll(ctx: Ctx): boolean {
  let any = false;
  for (const e of combatOf(ctx).enemies) {
    if (e.intentHidden) any = true;
    e.intentHidden = false;
  }
  return any;
}

/**
 * Changes the candle during combat: positive restores (clamped to max), negative
 * burns (clamped at 0). Logs blackout transitions, and a bright light instantly
 * reveals hidden intents. Returns the burn shortfall (wax that was not there).
 */
function changeCandle(ctx: Ctx, delta: number): number {
  const p = ctx.run.player;
  const before = p.candle;
  let shortfall = 0;
  if (delta > 0) p.candle = Math.min(p.maxCandle, p.candle + delta);
  else if (delta < 0) shortfall = burnCandle(ctx.run, -delta).shortfall;
  if (before > 0 && p.candle === 0) {
    log(
      ctx,
      `🕯️ 촛불이 꺼졌습니다 — 암전! (턴마다 체력 ${BLACKOUT_DAMAGE} 잃음, 적 피해 +${BLACKOUT_ENEMY_DAMAGE_BONUS}%)`,
    );
  } else if (before === 0 && p.candle > 0) {
    log(ctx, '🕯️ 촛불이 다시 타오릅니다. 암전이 걷혔습니다.');
  }
  if (lightLevel(p) === 'bright' && revealAll(ctx)) {
    log(ctx, '밝아진 불빛에 적의 의도가 드러났습니다.');
  }
  return shortfall;
}

/**
 * Re-rolls which intents the darkness hides (called at the start of each player
 * turn, after the candle burned). Bright: none. Dim: each enemy with
 * DIM_HIDE_CHANCE, but at least one. Blackout: all of them.
 */
function applyDarkness(ctx: Ctx): void {
  const combat = combatOf(ctx);
  const level = lightLevel(ctx.run.player);
  const living = combat.enemies.filter((e) => e.hp > 0);
  for (const e of combat.enemies) e.intentHidden = false;
  if (level === 'bright' || living.length === 0) return;
  if (level === 'dark') {
    for (const e of living) e.intentHidden = true;
  } else {
    for (const e of living) e.intentHidden = ctx.rng.chance(DIM_HIDE_CHANCE);
    if (!living.some((e) => e.intentHidden)) ctx.rng.pick(living).intentHidden = true;
  }
  const hidden = living.filter((e) => e.intentHidden).length;
  log(ctx, `어둠이 짙어 적 ${hidden}명의 의도가 보이지 않습니다.`);
}

/** Start-of-turn candle upkeep: drain (minus Kindle), then blackout damage at 0 wax. */
function burnTurnCandle(ctx: Ctx): void {
  const combat = combatOf(ctx);
  const kindle = getStatus(combat.player.statuses, 'kindle');
  changeCandle(ctx, kindle - candleDrainPerTurn(ctx.run));
  if (!isBlackout(ctx.run)) return;
  ctx.run.stats.blackoutTurns += 1;
  log(ctx, `암전: 어둠 속에서 체력 ${BLACKOUT_DAMAGE} 잃음`);
  loseHp(ctx, PLAYER, BLACKOUT_DAMAGE);
  checkCombatEnd(ctx);
}

function gainBlock(ctx: Ctx, ref: FighterRef, amount: number): void {
  const f = fighter(ctx, ref);
  if (f.hp <= 0 || amount <= 0) return;
  f.block += amount;
}

function applyStatusTo(
  ctx: Ctx,
  actor: FighterRef,
  target: FighterRef,
  status: StatusId,
  amount: number,
): void {
  const f = fighter(ctx, target);
  if (f.hp <= 0) return;
  addStatus(f.statuses, status, amount);
  const combat = combatOf(ctx);
  if (
    actor.kind === 'enemy' &&
    target.kind === 'player' &&
    STATUSES[status].decay === 'duration' &&
    !combat.player.skipDecay.includes(status)
  ) {
    combat.player.skipDecay.push(status);
  }
  log(
    ctx,
    `${f.name}: ${STATUSES[status].name} ${amount > 0 ? '+' : ''}${amount}`,
    actor.kind === 'player' ? 'player' : 'enemy',
  );
}

function addCardsToPile(
  ctx: Ctx,
  cardId: string,
  count: number,
  pile: 'draw' | 'discard' | 'hand',
) {
  const combat = combatOf(ctx);
  for (let i = 0; i < count; i++) {
    const card = makeCard(ctx.run, cardId);
    if (pile === 'draw') {
      const at = ctx.rng.int(0, combat.drawPile.length);
      combat.drawPile.splice(at, 0, card);
    } else if (pile === 'hand' && combat.hand.length < MAX_HAND_SIZE) {
      combat.hand.push(card);
    } else {
      combat.discardPile.push(card);
    }
  }
  log(ctx, `${getCardDef(cardId).name} ${count}장이 덱에 섞여 들어왔습니다.`, 'enemy');
}

export function drawCards(ctx: Ctx, count: number): void {
  const combat = combatOf(ctx);
  for (let i = 0; i < count; i++) {
    if (combat.drawPile.length === 0) {
      if (combat.discardPile.length === 0) return;
      combat.drawPile = ctx.rng.shuffle(combat.discardPile);
      combat.discardPile = [];
      log(ctx, '버린 카드 더미를 섞어 뽑을 카드 더미로 만들었습니다.');
    }
    const card = combat.drawPile.pop() as CardInstance;
    if (combat.hand.length >= MAX_HAND_SIZE) combat.discardPile.push(card);
    else combat.hand.push(card);
  }
}

function combatOver(ctx: Ctx): boolean {
  return combatOf(ctx).phase !== 'player';
}

function checkCombatEnd(ctx: Ctx): void {
  const combat = combatOf(ctx);
  if (combat.phase !== 'player') return;
  if (ctx.run.player.hp <= 0) {
    combat.phase = 'lost';
    log(ctx, '당신은 쓰러졌습니다…');
  } else if (combat.enemies.every((e) => e.hp <= 0)) {
    combat.phase = 'won';
    log(ctx, '승리!');
  }
}

/** Interprets a list of effects for `actor`. Stops early if combat ends. */
export function executeEffects(
  ctx: Ctx,
  actor: FighterRef,
  effects: readonly Effect[],
  chosen: FighterRef | null,
): void {
  const combat = combatOf(ctx);
  for (const effect of effects) {
    if (!alive(ctx, actor)) return;
    checkCombatEnd(ctx);
    if (combatOver(ctx)) return;

    switch (effect.type) {
      case 'damage': {
        const times = effect.times ?? 1;
        for (let i = 0; i < times; i++) {
          const targets = resolveTargets(ctx, actor, effect.target ?? 'target', chosen);
          if (targets.length === 0) break;
          for (const t of targets) attack(ctx, actor, t, effect.amount);
          if (!alive(ctx, actor)) break;
        }
        break;
      }
      case 'damageEqualBlock': {
        const base = fighter(ctx, actor).block;
        for (const t of resolveTargets(ctx, actor, 'target', chosen)) attack(ctx, actor, t, base);
        break;
      }
      case 'block': {
        const f = fighter(ctx, actor);
        gainBlock(ctx, actor, calcBlockGain(effect.amount, f.statuses));
        break;
      }
      case 'doubleBlock': {
        const f = fighter(ctx, actor);
        gainBlock(ctx, actor, f.block);
        break;
      }
      case 'applyStatus': {
        for (const t of resolveTargets(ctx, actor, effect.target, chosen)) {
          applyStatusTo(ctx, actor, t, effect.status, effect.amount);
        }
        break;
      }
      case 'draw':
        if (actor.kind === 'player') drawCards(ctx, effect.amount);
        break;
      case 'gainEnergy':
        if (actor.kind === 'player') combat.energy += effect.amount;
        break;
      case 'loseHp':
        loseHp(ctx, actor, effect.amount);
        break;
      case 'heal': {
        const f = fighter(ctx, actor);
        f.hp = Math.min(f.maxHp, f.hp + effect.amount);
        break;
      }
      case 'addCard':
        addCardsToPile(ctx, effect.cardId, effect.count, effect.pile);
        break;
      case 'candle': {
        const before = ctx.run.player.candle;
        changeCandle(ctx, effect.amount);
        const diff = ctx.run.player.candle - before;
        if (diff !== 0) {
          log(
            ctx,
            `촛농 ${diff > 0 ? '+' : ''}${diff}`,
            actor.kind === 'player' ? 'player' : 'enemy',
          );
        }
        break;
      }
      case 'reveal':
        if (actor.kind === 'player' && revealAll(ctx))
          log(ctx, '숨겨진 적의 의도가 드러났습니다.', 'player');
        break;
      case 'ifDark':
        if (lightLevel(ctx.run.player) !== 'bright')
          executeEffects(ctx, actor, effect.effects, chosen);
        break;
    }
  }
  checkCombatEnd(ctx);
}

// ---- Turn structure -------------------------------------------------------------------

function enemyDef(enemy: EnemyState): EnemyDef {
  const def = ENEMIES[enemy.defId];
  if (!def) throw new Error(`Unknown enemy: ${enemy.defId}`);
  return def;
}

function chooseIntents(ctx: Ctx): void {
  for (const enemy of combatOf(ctx).enemies) {
    if (enemy.hp <= 0) continue;
    const def = enemyDef(enemy);
    const moveId = def.ai({
      turn: enemy.history.length + 1,
      history: enemy.history,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      rng: ctx.rng,
    });
    enemy.intent = def.moves[moveId] ? moveId : Object.keys(def.moves)[0];
  }
}

/** Energy the player refills to at the start of each turn. */
export function energyPerTurn(run: RunState): number {
  return (
    run.player.baseEnergy +
    run.player.relics.reduce((sum, id) => sum + (RELICS[id]?.energyPerTurn ?? 0), 0)
  );
}

function startPlayerTurn(ctx: Ctx): void {
  const combat = combatOf(ctx);
  combat.turn += 1;
  ctx.run.stats.turnsTaken += 1;
  log(ctx, `— ${combat.turn}턴 —`);
  // Block expires at the start of your turn (turn 1 keeps relic-granted block).
  if (combat.turn > 1) combat.player.block = 0;

  const ritual = getStatus(combat.player.statuses, 'ritual');
  if (ritual > 0) applyStatusTo(ctx, PLAYER, PLAYER, 'strength', ritual);

  // The candle burns down; blackout damage can end the fight right here.
  burnTurnCandle(ctx);
  if (combatOver(ctx)) return;
  applyDarkness(ctx);

  combat.energy = energyPerTurn(ctx.run);
  for (const relicId of ctx.run.player.relics) {
    for (const trig of RELICS[relicId]?.triggers ?? []) {
      if (trig.when === 'turnStart' && (!trig.onlyTurn || trig.onlyTurn === combat.turn)) {
        executeEffects(ctx, PLAYER, trig.effects, null);
      }
    }
  }
  drawCards(ctx, ctx.run.player.handSize);
}

function nameEnemies(defs: EnemyDef[]): string[] {
  const counts = new Map<string, number>();
  defs.forEach((d) => counts.set(d.id, (counts.get(d.id) ?? 0) + 1));
  const seen = new Map<string, number>();
  return defs.map((d) => {
    if ((counts.get(d.id) ?? 0) < 2) return d.name;
    const n = (seen.get(d.id) ?? 0) + 1;
    seen.set(d.id, n);
    return `${d.name} ${String.fromCharCode(64 + n)}`;
  });
}

/** Sets up a fresh combat on `ctx.run` and starts turn 1. */
export function beginCombat(ctx: Ctx, encounter: EncounterDef): void {
  const run = ctx.run;
  const scaling = encounter.tier === 'boss' ? { hpMult: 1, strength: 0 } : getAct(run.act).scaling;
  const defs = encounter.enemies.map((id) => {
    const def = ENEMIES[id];
    if (!def) throw new Error(`Unknown enemy in encounter ${encounter.id}: ${id}`);
    return def;
  });
  const names = nameEnemies(defs);
  const enemies: EnemyState[] = defs.map((def, i) => {
    const hp = Math.round(ctx.rng.int(def.hp[0], def.hp[1]) * scaling.hpMult);
    const statuses: StatusMap = { ...def.startStatuses };
    if (scaling.strength) addStatus(statuses, 'strength', scaling.strength);
    return {
      uid: nextUid(run, 'e'),
      defId: def.id,
      name: names[i],
      hp,
      maxHp: hp,
      block: 0,
      statuses,
      intent: null,
      intentHidden: false,
      history: [],
    };
  });

  run.combat = {
    tier: encounter.tier,
    encounterId: encounter.id,
    enemies,
    player: { block: 0, statuses: {}, skipDecay: [] },
    hand: [],
    drawPile: ctx.rng.shuffle(run.player.deck.map((c) => ({ ...c }))),
    discardPile: [],
    exhaustPile: [],
    energy: 0,
    turn: 0,
    phase: 'player',
    log: [],
    logCounter: 0,
  };
  run.screen = 'combat';
  log(ctx, `전투 시작: ${enemies.map((e) => e.name).join(', ')}`);

  for (const relicId of run.player.relics) {
    for (const trig of RELICS[relicId]?.triggers ?? []) {
      if (trig.when === 'combatStart') executeEffects(ctx, PLAYER, trig.effects, null);
    }
  }
  chooseIntents(ctx);
  startPlayerTurn(ctx);
}

// ---- Public actions ---------------------------------------------------------------------

/** Starts a specific encounter directly (debug / tests); normal play goes through selectNode. */
export function startCombat(run: RunState, encounter: EncounterDef): RunState {
  return transact(run, (ctx) => beginCombat(ctx, encounter));
}

export interface PlayCheck {
  ok: boolean;
  reason?: string;
}

export function canPlayCard(run: RunState, card: CardInstance): PlayCheck {
  const combat = run.combat;
  if (!combat || combat.phase !== 'player')
    return { ok: false, reason: '지금은 카드를 낼 수 없습니다.' };
  const stats = getCardStats(card);
  if (stats.unplayable) return { ok: false, reason: '사용할 수 없는 카드입니다.' };
  if (stats.cost > combat.energy) return { ok: false, reason: '에너지가 부족합니다.' };
  return { ok: true };
}

/**
 * Plays a card from hand. `targetIndex` is the enemy index for targeted cards;
 * if omitted, the first living enemy is used. Invalid plays return `run` unchanged.
 */
export function playCard(run: RunState, cardUid: string, targetIndex?: number): RunState {
  return transact(run, (ctx) => {
    const combat = ctx.run.combat;
    if (!combat || combat.phase !== 'player') return false;
    const idx = combat.hand.findIndex((c) => c.uid === cardUid);
    if (idx < 0) return false;
    const card = combat.hand[idx];
    if (!canPlayCard(ctx.run, card).ok) return false;

    let chosen: FighterRef | null = null;
    if (cardNeedsTarget(card)) {
      if (targetIndex !== undefined) {
        const target = combat.enemies[targetIndex];
        if (!target || target.hp <= 0) return false;
        chosen = { kind: 'enemy', index: targetIndex };
      } else {
        chosen = livingEnemyRefs(combat)[0] ?? null;
        if (!chosen) return false;
      }
    }

    const stats = getCardStats(card);
    const def = getCardDef(card.defId);
    combat.energy -= stats.cost;
    combat.hand.splice(idx, 1);
    ctx.run.stats.cardsPlayed += 1;
    log(ctx, `${cardName(card)} 사용`, 'player');

    // Wax is paid like energy, before the effects (so a shadow card can darken
    // the room enough to trigger its own "in darkness" bonus).
    if (stats.candle) {
      const shortfall = changeCandle(ctx, stats.candle);
      if (shortfall > 0) {
        log(ctx, `촛농이 모자라 그림자가 생명을 태웁니다: 체력 ${shortfall} 잃음`, 'player');
        loseHp(ctx, PLAYER, shortfall);
        checkCombatEnd(ctx);
      }
    }

    executeEffects(ctx, PLAYER, stats.effects, chosen);

    // Powers leave play permanently; exhausted cards go to the exhaust pile.
    if (def.type === 'power') {
      /* consumed */
    } else if (stats.exhaust) combat.exhaustPile.push(card);
    else combat.discardPile.push(card);
    checkCombatEnd(ctx);
  });
}

export function canRevealIntents(run: RunState): PlayCheck {
  const combat = run.combat;
  if (!combat || combat.phase !== 'player') return { ok: false, reason: '지금은 할 수 없습니다.' };
  if (!combat.enemies.some((e) => e.hp > 0 && e.intentHidden))
    return { ok: false, reason: '가려진 의도가 없습니다.' };
  if (run.player.candle < REVEAL_WAX_COST)
    return { ok: false, reason: `촛농이 부족합니다. (필요: ${REVEAL_WAX_COST})` };
  return { ok: true };
}

/**
 * "Raise the wick" (심지 돋우기): spends REVEAL_WAX_COST wax to reveal every
 * hidden enemy intent for this turn. Always available when something is hidden.
 */
export function revealIntents(run: RunState): RunState {
  return transact(run, (ctx) => {
    if (!canRevealIntents(ctx.run).ok) return false;
    log(ctx, `심지를 돋웁니다 (촛농 -${REVEAL_WAX_COST})`, 'player');
    changeCandle(ctx, -REVEAL_WAX_COST);
    if (revealAll(ctx)) log(ctx, '숨겨진 적의 의도가 드러났습니다.', 'player');
  });
}

/** Ends the player's turn, resolves every enemy action, and starts the next turn. */
export function endTurn(run: RunState): RunState {
  return transact(run, (ctx) => {
    const combat = ctx.run.combat;
    if (!combat || combat.phase !== 'player') return false;

    // -- End of player turn
    combat.discardPile.push(...combat.hand);
    combat.hand = [];
    const metal = getStatus(combat.player.statuses, 'metallicize');
    if (metal > 0) gainBlock(ctx, PLAYER, metal);

    // -- Enemy turn
    for (let i = 0; i < combat.enemies.length; i++) {
      const enemy = combat.enemies[i];
      if (enemy.hp <= 0) continue;
      const ref: FighterRef = { kind: 'enemy', index: i };
      enemy.block = 0;
      const ritual = getStatus(enemy.statuses, 'ritual');
      if (ritual > 0 && enemy.history.length > 0) applyStatusTo(ctx, ref, ref, 'strength', ritual);

      const def = enemyDef(enemy);
      const move = enemy.intent ? def.moves[enemy.intent] : undefined;
      if (move) {
        log(ctx, `${enemy.name}: ${move.name}`, 'enemy');
        executeEffects(ctx, ref, move.effects, PLAYER);
        enemy.history.push(move.id);
      }
      if (enemy.hp > 0) {
        const eMetal = getStatus(enemy.statuses, 'metallicize');
        if (eMetal > 0) gainBlock(ctx, ref, eMetal);
      }
      checkCombatEnd(ctx);
      if (combatOver(ctx)) return;
    }

    // -- End of round: duration statuses tick down
    decayDurationStatuses(combat.player.statuses, combat.player.skipDecay);
    combat.player.skipDecay = [];
    for (const enemy of combat.enemies) {
      if (enemy.hp > 0) decayDurationStatuses(enemy.statuses);
    }

    chooseIntents(ctx);
    startPlayerTurn(ctx);
  });
}

// ---- UI helpers ----------------------------------------------------------------------------

export type IntentKind = 'attack' | 'defend' | 'buff' | 'debuff' | 'special' | 'hidden';

export interface IntentPart {
  kind: IntentKind;
  label: string;
}

export interface IntentView {
  moveName: string;
  parts: IntentPart[];
  /** True when darkness hides the intent: `parts` then carries no real information. */
  hidden?: boolean;
}

const HIDDEN_INTENT: IntentView = {
  moveName: '???',
  parts: [{ kind: 'hidden', label: '???' }],
  hidden: true,
};

/**
 * What an enemy is about to do, with damage already modified by statuses. This is
 * the only player-facing view of intents: a hidden intent yields no information.
 */
export function describeIntent(run: RunState, enemyIndex: number): IntentView | null {
  const combat = run.combat;
  const enemy = combat?.enemies[enemyIndex];
  if (!combat || !enemy || enemy.hp <= 0 || !enemy.intent) return null;
  if (enemy.intentHidden) return HIDDEN_INTENT;
  const move = enemyDef(enemy).moves[enemy.intent];
  if (!move) return null;
  const bonus = isBlackout(run) ? BLACKOUT_ENEMY_DAMAGE_BONUS : 0;

  const parts: IntentPart[] = [];
  for (const e of move.effects) {
    switch (e.type) {
      case 'damage': {
        const dmg = calcAttackDamage(e.amount, enemy.statuses, combat.player.statuses, bonus);
        parts.push({
          kind: 'attack',
          label: e.times && e.times > 1 ? `${dmg}×${e.times}` : `${dmg}`,
        });
        break;
      }
      case 'block':
        parts.push({ kind: 'defend', label: `${calcBlockGain(e.amount, enemy.statuses)}` });
        break;
      case 'applyStatus':
        parts.push({
          kind: e.target === 'self' ? 'buff' : 'debuff',
          label: `${STATUSES[e.status].name} ${e.amount}`,
        });
        break;
      case 'addCard':
        parts.push({ kind: 'special', label: `${getCardDef(e.cardId).name} +${e.count}` });
        break;
      case 'candle':
        parts.push({
          kind: e.amount < 0 ? 'debuff' : 'buff',
          label: `촛농 ${e.amount > 0 ? '+' : ''}${e.amount}`,
        });
        break;
      default:
        parts.push({ kind: 'special', label: '?' });
    }
  }
  return { moveName: move.name, parts };
}
