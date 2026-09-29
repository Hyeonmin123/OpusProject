import type { EnemyAiContext, EnemyDef } from '../types';

// ---- AI helpers ----------------------------------------------------------------

const last = (h: readonly string[], n = 1): string | undefined => h[h.length - n];

/** True if `move` was used in each of the last `n` turns. */
const usedLastN = (h: readonly string[], move: string, n: number): boolean =>
  h.length >= n && h.slice(-n).every((m) => m === move);

/**
 * Weighted random choice that refuses to pick a move more than `maxRepeat`
 * times in a row (falls back to the other options).
 */
function weighted(
  ctx: EnemyAiContext,
  options: Array<[move: string, weight: number]>,
  maxRepeat = 2,
): string {
  const allowed = options.filter(([m]) => !usedLastN(ctx.history, m, maxRepeat));
  const pool = allowed.length > 0 ? allowed : options;
  const total = pool.reduce((s, [, w]) => s + w, 0);
  let roll = ctx.rng.next() * total;
  for (const [m, w] of pool) {
    roll -= w;
    if (roll < 0) return m;
  }
  return pool[pool.length - 1][0];
}

/** Fixed rotation, 1-based turn. */
const cycle = (ctx: EnemyAiContext, moves: string[]): string =>
  moves[(ctx.turn - 1) % moves.length];

// ---- Enemy definitions ------------------------------------------------------------

const ENEMY_LIST: EnemyDef[] = [
  // Act 1 normals
  {
    id: 'rat',
    name: '굶주린 쥐',
    icon: '🐀',
    tier: 'normal',
    hp: [12, 16],
    moves: {
      bite: { id: 'bite', name: '물어뜯기', effects: [{ type: 'damage', amount: 6 }] },
      scratch: {
        id: 'scratch',
        name: '할퀴기',
        effects: [
          { type: 'damage', amount: 3 },
          { type: 'applyStatus', status: 'weak', amount: 1, target: 'target' },
        ],
      },
    },
    ai: (ctx) =>
      weighted(ctx, [
        ['bite', 60],
        ['scratch', 40],
      ]),
  },
  {
    id: 'bat',
    name: '동굴 박쥐',
    icon: '🦇',
    tier: 'normal',
    hp: [13, 17],
    moves: {
      swoop: {
        id: 'swoop',
        name: '급강하',
        effects: [{ type: 'damage', amount: 3, times: 2 }],
      },
      screech: {
        id: 'screech',
        name: '초음파',
        effects: [
          { type: 'applyStatus', status: 'vulnerable', amount: 1, target: 'target' },
          // The shriek and wingbeats make the candle gutter.
          { type: 'candle', amount: -1 },
        ],
      },
    },
    ai: (ctx) =>
      weighted(
        ctx,
        [
          ['swoop', 65],
          ['screech', 35],
        ],
        1,
      ),
  },
  {
    id: 'cultist',
    name: '광신도',
    icon: '🧙',
    tier: 'normal',
    hp: [44, 50],
    moves: {
      incantation: {
        id: 'incantation',
        name: '주문 영창',
        effects: [{ type: 'applyStatus', status: 'ritual', amount: 2, target: 'self' }],
      },
      darkStrike: {
        id: 'darkStrike',
        name: '어둠의 일격',
        effects: [{ type: 'damage', amount: 6 }],
      },
    },
    ai: (ctx) => (ctx.turn === 1 ? 'incantation' : 'darkStrike'),
  },
  {
    id: 'slime',
    name: '산성 점액',
    icon: '🟢',
    tier: 'normal',
    hp: [30, 34],
    moves: {
      spit: {
        id: 'spit',
        name: '부식성 침',
        effects: [
          { type: 'damage', amount: 7 },
          { type: 'addCard', cardId: 'slimed', count: 1, pile: 'discard' },
        ],
      },
      tackle: { id: 'tackle', name: '몸통 박치기', effects: [{ type: 'damage', amount: 10 }] },
      lick: {
        id: 'lick',
        name: '핥기',
        effects: [{ type: 'applyStatus', status: 'weak', amount: 1, target: 'target' }],
      },
    },
    ai: (ctx) =>
      weighted(
        ctx,
        [
          ['spit', 40],
          ['tackle', 35],
          ['lick', 25],
        ],
        1,
      ),
  },
  {
    id: 'skeleton',
    name: '해골 파수꾼',
    icon: '💀',
    tier: 'normal',
    hp: [38, 42],
    moves: {
      shieldBash: {
        id: 'shieldBash',
        name: '방패 밀치기',
        effects: [
          { type: 'damage', amount: 6 },
          { type: 'block', amount: 6 },
        ],
      },
      fortify: {
        id: 'fortify',
        name: '재조립',
        effects: [
          { type: 'block', amount: 10 },
          { type: 'applyStatus', status: 'strength', amount: 1, target: 'self' },
        ],
      },
      heavySwing: { id: 'heavySwing', name: '내려찍기', effects: [{ type: 'damage', amount: 11 }] },
    },
    ai: (ctx) =>
      last(ctx.history) === 'fortify'
        ? 'heavySwing'
        : weighted(ctx, [
            ['shieldBash', 45],
            ['heavySwing', 35],
            ['fortify', 20],
          ]),
  },

  // Act 1 elites
  {
    id: 'fallenKnight',
    name: '타락한 기사',
    icon: '🗡️',
    tier: 'elite',
    hp: [80, 86],
    moves: {
      bellow: {
        id: 'bellow',
        name: '포효',
        effects: [
          { type: 'applyStatus', status: 'strength', amount: 2, target: 'self' },
          { type: 'block', amount: 8 },
        ],
      },
      rush: { id: 'rush', name: '돌진', effects: [{ type: 'damage', amount: 14 }] },
      skullBash: {
        id: 'skullBash',
        name: '두개골 강타',
        effects: [
          { type: 'damage', amount: 6 },
          { type: 'applyStatus', status: 'vulnerable', amount: 2, target: 'target' },
        ],
      },
    },
    ai: (ctx) =>
      ctx.turn === 1
        ? 'bellow'
        : weighted(
            ctx,
            [
              ['rush', 60],
              ['skullBash', 40],
            ],
            2,
          ),
  },
  {
    id: 'gargoyle',
    name: '석상 가고일',
    icon: '🗿',
    tier: 'elite',
    hp: [40, 44],
    startStatuses: { metallicize: 2 },
    moves: {
      stoneBeam: { id: 'stoneBeam', name: '석화 광선', effects: [{ type: 'damage', amount: 9 }] },
      gaze: {
        id: 'gaze',
        name: '응시',
        effects: [
          { type: 'damage', amount: 4 },
          { type: 'applyStatus', status: 'frail', amount: 2, target: 'target' },
        ],
      },
      harden: { id: 'harden', name: '경화', effects: [{ type: 'block', amount: 12 }] },
    },
    ai: (ctx) =>
      weighted(
        ctx,
        [
          ['stoneBeam', 45],
          ['gaze', 30],
          ['harden', 25],
        ],
        1,
      ),
  },

  // Bosses
  {
    id: 'rottingGolem',
    name: '썩은 골렘',
    icon: '🧟',
    tier: 'boss',
    hp: [105, 105],
    moves: {
      corrupt: {
        id: 'corrupt',
        name: '부패의 숨결',
        effects: [
          { type: 'applyStatus', status: 'weak', amount: 1, target: 'target' },
          { type: 'applyStatus', status: 'frail', amount: 1, target: 'target' },
          { type: 'addCard', cardId: 'slimed', count: 2, pile: 'discard' },
        ],
      },
      slam: { id: 'slam', name: '짓누르기', effects: [{ type: 'damage', amount: 16 }] },
      flail: { id: 'flail', name: '난타', effects: [{ type: 'damage', amount: 4, times: 3 }] },
      harden: {
        id: 'harden',
        name: '진흙 갑옷',
        effects: [
          { type: 'block', amount: 12 },
          { type: 'applyStatus', status: 'strength', amount: 2, target: 'self' },
        ],
      },
    },
    ai: (ctx) => cycle(ctx, ['corrupt', 'slam', 'flail', 'harden']),
  },
  {
    id: 'boneQueen',
    name: '뼈의 여왕',
    icon: '👑',
    tier: 'boss',
    hp: [140, 140],
    moves: {
      curse: {
        id: 'curse',
        name: '저주',
        effects: [
          { type: 'applyStatus', status: 'vulnerable', amount: 1, target: 'target' },
          { type: 'applyStatus', status: 'weak', amount: 1, target: 'target' },
          { type: 'candle', amount: -3 },
        ],
      },
      boneStorm: {
        id: 'boneStorm',
        name: '뼈 폭풍',
        effects: [{ type: 'damage', amount: 4, times: 4 }],
      },
      decree: {
        id: 'decree',
        name: '칙령',
        effects: [
          { type: 'applyStatus', status: 'strength', amount: 1, target: 'self' },
          { type: 'block', amount: 12 },
        ],
      },
      execute: { id: 'execute', name: '처형', effects: [{ type: 'damage', amount: 24 }] },
    },
    ai: (ctx) => cycle(ctx, ['curse', 'boneStorm', 'decree', 'execute']),
  },
  {
    id: 'abyssalEye',
    name: '심연의 눈',
    icon: '👁️',
    tier: 'boss',
    hp: [175, 175],
    moves: {
      awaken: {
        id: 'awaken',
        name: '각성',
        effects: [
          { type: 'applyStatus', status: 'ritual', amount: 1, target: 'self' },
          { type: 'block', amount: 12 },
        ],
      },
      beam: { id: 'beam', name: '심연 광선', effects: [{ type: 'damage', amount: 20 }] },
      barrage: {
        id: 'barrage',
        name: '촉수 연타',
        effects: [{ type: 'damage', amount: 3, times: 5 }],
      },
      gaze: {
        id: 'gaze',
        name: '광기의 응시',
        effects: [
          { type: 'applyStatus', status: 'vulnerable', amount: 1, target: 'target' },
          { type: 'applyStatus', status: 'frail', amount: 1, target: 'target' },
          { type: 'addCard', cardId: 'wound', count: 2, pile: 'draw' },
          { type: 'candle', amount: -4 },
        ],
      },
    },
    ai: (ctx) =>
      ctx.turn === 1
        ? 'awaken'
        : cycle({ ...ctx, turn: ctx.turn - 1 }, ['gaze', 'beam', 'barrage']),
  },
];

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(
  ENEMY_LIST.map((e) => [e.id, e]),
);
