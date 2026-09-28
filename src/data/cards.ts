import type { CardDef } from '../types';

/**
 * Warrior card pool. Descriptions are generated from `effects` unless a card
 * sets `description` explicitly (see engine/cards.ts describeCard).
 */
const CARD_LIST: CardDef[] = [
  // ---- Starter -------------------------------------------------------------
  {
    id: 'strike',
    name: '타격',
    type: 'attack',
    rarity: 'starter',
    cost: 1,
    effects: [{ type: 'damage', amount: 6 }],
    upgrade: { effects: [{ type: 'damage', amount: 9 }] },
  },
  {
    id: 'defend',
    name: '수비',
    type: 'skill',
    rarity: 'starter',
    cost: 1,
    effects: [{ type: 'block', amount: 5 }],
    upgrade: { effects: [{ type: 'block', amount: 8 }] },
  },
  {
    id: 'bash',
    name: '강타',
    type: 'attack',
    rarity: 'starter',
    cost: 2,
    effects: [
      { type: 'damage', amount: 8 },
      { type: 'applyStatus', status: 'vulnerable', amount: 2, target: 'target' },
    ],
    upgrade: {
      effects: [
        { type: 'damage', amount: 10 },
        { type: 'applyStatus', status: 'vulnerable', amount: 3, target: 'target' },
      ],
    },
  },
  {
    id: 'ironWave',
    name: '무쇠 파동',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    effects: [
      { type: 'block', amount: 5 },
      { type: 'damage', amount: 5 },
    ],
    upgrade: {
      effects: [
        { type: 'block', amount: 7 },
        { type: 'damage', amount: 7 },
      ],
    },
  },

  // ---- Common --------------------------------------------------------------
  {
    id: 'cleave',
    name: '휩쓸기',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    effects: [{ type: 'damage', amount: 8, target: 'allEnemies' }],
    upgrade: { effects: [{ type: 'damage', amount: 11, target: 'allEnemies' }] },
  },
  {
    id: 'twinStrike',
    name: '연속 베기',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    effects: [{ type: 'damage', amount: 5, times: 2 }],
    upgrade: { effects: [{ type: 'damage', amount: 7, times: 2 }] },
  },
  {
    id: 'bodySlam',
    name: '몸통 박치기',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    effects: [{ type: 'damageEqualBlock' }],
    upgrade: { cost: 0 },
  },
  {
    id: 'clothesline',
    name: '목조르기',
    type: 'attack',
    rarity: 'common',
    cost: 2,
    effects: [
      { type: 'damage', amount: 12 },
      { type: 'applyStatus', status: 'weak', amount: 2, target: 'target' },
    ],
    upgrade: {
      effects: [
        { type: 'damage', amount: 14 },
        { type: 'applyStatus', status: 'weak', amount: 3, target: 'target' },
      ],
    },
  },
  {
    id: 'pommelStrike',
    name: '자루 치기',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    effects: [
      { type: 'damage', amount: 9 },
      { type: 'draw', amount: 1 },
    ],
    upgrade: {
      effects: [
        { type: 'damage', amount: 10 },
        { type: 'draw', amount: 2 },
      ],
    },
  },
  {
    id: 'shrugItOff',
    name: '털어내기',
    type: 'skill',
    rarity: 'common',
    cost: 1,
    effects: [
      { type: 'block', amount: 8 },
      { type: 'draw', amount: 1 },
    ],
    upgrade: {
      effects: [
        { type: 'block', amount: 11 },
        { type: 'draw', amount: 1 },
      ],
    },
  },

  // ---- Uncommon ------------------------------------------------------------
  {
    id: 'uppercut',
    name: '올려치기',
    type: 'attack',
    rarity: 'uncommon',
    cost: 2,
    effects: [
      { type: 'damage', amount: 13 },
      { type: 'applyStatus', status: 'weak', amount: 1, target: 'target' },
      { type: 'applyStatus', status: 'vulnerable', amount: 1, target: 'target' },
    ],
    upgrade: {
      effects: [
        { type: 'damage', amount: 13 },
        { type: 'applyStatus', status: 'weak', amount: 2, target: 'target' },
        { type: 'applyStatus', status: 'vulnerable', amount: 2, target: 'target' },
      ],
    },
  },
  {
    id: 'bloodletting',
    name: '사혈',
    type: 'skill',
    rarity: 'uncommon',
    cost: 0,
    effects: [
      { type: 'loseHp', amount: 3 },
      { type: 'gainEnergy', amount: 2 },
    ],
    upgrade: {
      effects: [
        { type: 'loseHp', amount: 3 },
        { type: 'gainEnergy', amount: 3 },
      ],
    },
  },
  {
    id: 'battleTrance',
    name: '전투 몰입',
    type: 'skill',
    rarity: 'uncommon',
    cost: 0,
    effects: [{ type: 'draw', amount: 3 }],
    upgrade: { effects: [{ type: 'draw', amount: 4 }] },
  },
  {
    id: 'intimidate',
    name: '위협',
    type: 'skill',
    rarity: 'uncommon',
    cost: 0,
    exhaust: true,
    effects: [{ type: 'applyStatus', status: 'weak', amount: 1, target: 'allEnemies' }],
    upgrade: {
      effects: [{ type: 'applyStatus', status: 'weak', amount: 2, target: 'allEnemies' }],
    },
  },
  {
    id: 'entrench',
    name: '참호',
    type: 'skill',
    rarity: 'uncommon',
    cost: 2,
    effects: [{ type: 'doubleBlock' }],
    upgrade: { cost: 1 },
  },
  {
    id: 'inflame',
    name: '분노 점화',
    type: 'power',
    rarity: 'uncommon',
    cost: 1,
    effects: [{ type: 'applyStatus', status: 'strength', amount: 2, target: 'self' }],
    upgrade: {
      effects: [{ type: 'applyStatus', status: 'strength', amount: 3, target: 'self' }],
    },
  },
  {
    id: 'metallicize',
    name: '금속화',
    type: 'power',
    rarity: 'uncommon',
    cost: 1,
    effects: [{ type: 'applyStatus', status: 'metallicize', amount: 3, target: 'self' }],
    upgrade: {
      effects: [{ type: 'applyStatus', status: 'metallicize', amount: 4, target: 'self' }],
    },
  },
  {
    id: 'thornArmor',
    name: '가시 갑옷',
    type: 'power',
    rarity: 'uncommon',
    cost: 1,
    effects: [{ type: 'applyStatus', status: 'thorns', amount: 3, target: 'self' }],
    upgrade: {
      effects: [{ type: 'applyStatus', status: 'thorns', amount: 5, target: 'self' }],
    },
  },

  // ---- Rare ----------------------------------------------------------------
  {
    id: 'bludgeon',
    name: '분쇄',
    type: 'attack',
    rarity: 'rare',
    cost: 3,
    effects: [{ type: 'damage', amount: 32 }],
    upgrade: { effects: [{ type: 'damage', amount: 42 }] },
  },
  {
    id: 'demonForm',
    name: '악마의 형상',
    type: 'power',
    rarity: 'rare',
    cost: 3,
    effects: [{ type: 'applyStatus', status: 'ritual', amount: 2, target: 'self' }],
    upgrade: {
      effects: [{ type: 'applyStatus', status: 'ritual', amount: 3, target: 'self' }],
    },
  },
  {
    id: 'impervious',
    name: '불굴',
    type: 'skill',
    rarity: 'rare',
    cost: 2,
    exhaust: true,
    effects: [{ type: 'block', amount: 30 }],
    upgrade: { effects: [{ type: 'block', amount: 40 }] },
  },

  // ---- Status (added by enemies / events) ------------------------------------
  {
    id: 'slimed',
    name: '점액',
    type: 'status',
    rarity: 'special',
    cost: 1,
    exhaust: true,
    effects: [],
    description: '아무 효과 없음.',
  },
  {
    id: 'wound',
    name: '상처',
    type: 'status',
    rarity: 'special',
    cost: 0,
    unplayable: true,
    effects: [],
    description: '사용할 수 없습니다.',
  },
];

export const CARDS: Record<string, CardDef> = Object.fromEntries(CARD_LIST.map((c) => [c.id, c]));

export const STARTER_DECK: string[] = [
  'strike',
  'strike',
  'strike',
  'strike',
  'defend',
  'defend',
  'defend',
  'defend',
  'bash',
  'ironWave',
];

/** Cards that may appear as rewards or in shops. */
export const REWARD_POOL: CardDef[] = CARD_LIST.filter(
  (c) => c.rarity === 'common' || c.rarity === 'uncommon' || c.rarity === 'rare',
);
