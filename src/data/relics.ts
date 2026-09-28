import type { RelicDef } from '../types';

const RELIC_LIST: RelicDef[] = [
  {
    id: 'burningBlood',
    name: '전사의 피',
    icon: '🩸',
    rarity: 'starter',
    description: '전투에서 승리하면 체력을 6 회복합니다.',
    triggers: [{ when: 'combatWin', heal: 6 }],
  },
  {
    id: 'anchor',
    name: '녹슨 닻',
    icon: '⚓',
    rarity: 'common',
    description: '전투 시작 시 방어도를 10 얻습니다.',
    triggers: [{ when: 'combatStart', effects: [{ type: 'block', amount: 10 }] }],
  },
  {
    id: 'vajra',
    name: '금강저',
    icon: '🔱',
    rarity: 'common',
    description: '전투 시작 시 힘을 1 얻습니다.',
    triggers: [
      {
        when: 'combatStart',
        effects: [{ type: 'applyStatus', status: 'strength', amount: 1, target: 'self' }],
      },
    ],
  },
  {
    id: 'bagOfMarbles',
    name: '구슬 주머니',
    icon: '🔮',
    rarity: 'common',
    description: '전투 시작 시 모든 적에게 취약을 1 부여합니다.',
    triggers: [
      {
        when: 'combatStart',
        effects: [{ type: 'applyStatus', status: 'vulnerable', amount: 1, target: 'allEnemies' }],
      },
    ],
  },
  {
    id: 'lantern',
    name: '등불',
    icon: '🏮',
    rarity: 'common',
    description: '각 전투의 첫 턴에 에너지를 1 추가로 얻습니다.',
    triggers: [{ when: 'turnStart', onlyTurn: 1, effects: [{ type: 'gainEnergy', amount: 1 }] }],
  },
  {
    id: 'bloodVial',
    name: '피의 약병',
    icon: '🧪',
    rarity: 'common',
    description: '전투 시작 시 체력을 3 회복합니다.',
    triggers: [{ when: 'combatStart', effects: [{ type: 'heal', amount: 3 }] }],
  },
  {
    id: 'bronzeScales',
    name: '청동 비늘',
    icon: '🐉',
    rarity: 'common',
    description: '전투 시작 시 가시를 3 얻습니다.',
    triggers: [
      {
        when: 'combatStart',
        effects: [{ type: 'applyStatus', status: 'thorns', amount: 3, target: 'self' }],
      },
    ],
  },
  {
    id: 'wildBerry',
    name: '야생 산딸기',
    icon: '🍓',
    rarity: 'common',
    description: '획득 시 최대 체력이 7 증가합니다.',
    triggers: [{ when: 'pickup', maxHp: 7, heal: 7 }],
  },
  {
    id: 'goldenIdol',
    name: '황금 우상',
    icon: '🏺',
    rarity: 'common',
    description: '전투에서 승리할 때마다 골드를 10 추가로 얻습니다.',
    triggers: [{ when: 'combatWin', gold: 10 }],
  },

  // Boss relics
  {
    id: 'cursedCrown',
    name: '저주받은 왕관',
    icon: '👑',
    rarity: 'boss',
    description: '매 턴 에너지를 1 추가로 얻습니다.',
    triggers: [],
    energyPerTurn: 1,
  },
  {
    id: 'eternalFlame',
    name: '영원의 불꽃',
    icon: '🔥',
    rarity: 'boss',
    description: '전투 시작 시 힘을 2 얻습니다.',
    triggers: [
      {
        when: 'combatStart',
        effects: [{ type: 'applyStatus', status: 'strength', amount: 2, target: 'self' }],
      },
    ],
  },
  {
    id: 'ironHeart',
    name: '무쇠 심장',
    icon: '🫀',
    rarity: 'boss',
    description: '획득 시 최대 체력이 20 증가합니다. 전투 시작 시 금속화를 2 얻습니다.',
    triggers: [
      { when: 'pickup', maxHp: 20, heal: 20 },
      {
        when: 'combatStart',
        effects: [{ type: 'applyStatus', status: 'metallicize', amount: 2, target: 'self' }],
      },
    ],
  },
];

export const RELICS: Record<string, RelicDef> = Object.fromEntries(
  RELIC_LIST.map((r) => [r.id, r]),
);

export const STARTER_RELIC = 'burningBlood';
