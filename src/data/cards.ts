import type { CardDef } from '../types';

/**
 * Warrior card pool. Descriptions are generated from `effects` unless a card
 * sets `description` explicitly (see engine/cards.ts describeCard).
 *
 * Candle resonance: cards without `resonance` are neutral. Light cards restore
 * wax (`candle` > 0) and are a bit weaker per energy than neutral cards; shadow
 * cards burn wax (`candle` < 0) and are clearly stronger per energy.
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

  // ---- Light (빛): restore wax, weaker per energy ------------------------------
  {
    id: 'emberStrike',
    name: '불씨 베기',
    type: 'attack',
    rarity: 'common',
    resonance: 'light',
    cost: 1,
    candle: 1,
    effects: [{ type: 'damage', amount: 6 }],
    upgrade: { candle: 2, effects: [{ type: 'damage', amount: 9 }] },
    flavor: '칼날에 옮겨 붙은 불씨가 심지로 돌아온다.',
  },
  {
    id: 'wardingFlame',
    name: '수호의 불꽃',
    type: 'skill',
    rarity: 'common',
    resonance: 'light',
    cost: 1,
    candle: 2,
    effects: [{ type: 'block', amount: 6 }],
    upgrade: { effects: [{ type: 'block', amount: 9 }] },
  },
  {
    id: 'tendTheWick',
    name: '심지 다듬기',
    type: 'skill',
    rarity: 'uncommon',
    resonance: 'light',
    cost: 0,
    candle: 4,
    exhaust: true,
    effects: [{ type: 'draw', amount: 1 }],
    upgrade: { candle: 6 },
  },
  {
    id: 'radiantBlow',
    name: '광휘의 일격',
    type: 'attack',
    rarity: 'uncommon',
    resonance: 'light',
    cost: 2,
    candle: 2,
    effects: [
      { type: 'damage', amount: 11 },
      { type: 'applyStatus', status: 'weak', amount: 2, target: 'target' },
    ],
    upgrade: {
      candle: 3,
      effects: [
        { type: 'damage', amount: 14 },
        { type: 'applyStatus', status: 'weak', amount: 2, target: 'target' },
      ],
    },
  },
  {
    id: 'sanctuaryLamp',
    name: '성역의 등불',
    type: 'power',
    rarity: 'uncommon',
    resonance: 'light',
    cost: 1,
    candle: 1,
    effects: [{ type: 'applyStatus', status: 'kindle', amount: 1, target: 'self' }],
    upgrade: { cost: 0 },
  },
  {
    id: 'dawnVow',
    name: '새벽의 서약',
    type: 'skill',
    rarity: 'rare',
    resonance: 'light',
    cost: 1,
    candle: 8,
    exhaust: true,
    effects: [{ type: 'block', amount: 10 }],
    upgrade: { candle: 10, effects: [{ type: 'block', amount: 14 }] },
  },

  // ---- Shadow (그림자): burn wax, stronger per energy --------------------------
  {
    id: 'shadowStrike',
    name: '그림자 베기',
    type: 'attack',
    rarity: 'common',
    resonance: 'shadow',
    cost: 1,
    candle: -2,
    effects: [{ type: 'damage', amount: 10 }],
    upgrade: { effects: [{ type: 'damage', amount: 14 }] },
  },
  {
    id: 'duskVeil',
    name: '어스름 장막',
    type: 'skill',
    rarity: 'common',
    resonance: 'shadow',
    cost: 1,
    candle: -2,
    effects: [{ type: 'block', amount: 10 }],
    upgrade: { effects: [{ type: 'block', amount: 13 }] },
  },
  {
    id: 'gazeIntoDark',
    name: '어둠 응시',
    type: 'skill',
    rarity: 'common',
    resonance: 'shadow',
    cost: 0,
    candle: -2,
    effects: [{ type: 'reveal' }, { type: 'draw', amount: 1 }],
    upgrade: { effects: [{ type: 'reveal' }, { type: 'draw', amount: 2 }] },
    flavor: '불빛을 줄이면 오히려 어둠 속의 움직임이 보인다.',
  },
  {
    id: 'nightStalker',
    name: '밤의 추적자',
    type: 'attack',
    rarity: 'uncommon',
    resonance: 'shadow',
    cost: 1,
    candle: -2,
    effects: [
      { type: 'damage', amount: 7 },
      { type: 'ifDark', effects: [{ type: 'damage', amount: 7 }] },
    ],
    upgrade: {
      effects: [
        { type: 'damage', amount: 9 },
        { type: 'ifDark', effects: [{ type: 'damage', amount: 9 }] },
      ],
    },
  },
  {
    id: 'devouringDark',
    name: '삼키는 어둠',
    type: 'attack',
    rarity: 'uncommon',
    resonance: 'shadow',
    cost: 2,
    candle: -4,
    effects: [{ type: 'damage', amount: 14, target: 'allEnemies' }],
    upgrade: { effects: [{ type: 'damage', amount: 19, target: 'allEnemies' }] },
  },
  {
    id: 'umbralForm',
    name: '그늘의 형상',
    type: 'power',
    rarity: 'rare',
    resonance: 'shadow',
    cost: 1,
    candle: -5,
    effects: [{ type: 'applyStatus', status: 'strength', amount: 3, target: 'self' }],
    upgrade: {
      effects: [{ type: 'applyStatus', status: 'strength', amount: 4, target: 'self' }],
    },
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
