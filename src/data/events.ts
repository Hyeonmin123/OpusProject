import type { EventDef } from '../types';

const EVENT_LIST: EventDef[] = [
  {
    id: 'altar',
    title: '버려진 제단',
    icon: '🕯️',
    text: '먼지 덮인 제단 위에서 희미한 빛이 새어 나온다. 제단 앞 바닥에는 오래된 핏자국이 말라붙어 있다.',
    options: [
      {
        label: '피를 바친다',
        detail: '체력 8 잃음. 무작위 유물 획득.',
        outcomes: [{ type: 'hp', amount: -8 }, { type: 'randomRelic' }],
        result: '손바닥을 긋자 제단이 피를 삼킨다. 빛이 잦아들고, 그 자리에 무언가가 남았다.',
      },
      {
        label: '제단을 부순다',
        detail: '골드 40 획득. 덱에 상처 추가.',
        outcomes: [
          { type: 'gold', amount: 40 },
          { type: 'addCard', cardId: 'wound' },
        ],
        result: '돌 틈에서 금화가 쏟아진다. 하지만 날카로운 파편이 팔을 긋고 지나갔다.',
      },
      {
        label: '떠난다',
        detail: '아무 일도 일어나지 않습니다.',
        outcomes: [],
        result: '불길한 기운을 뒤로하고 발걸음을 옮긴다.',
      },
    ],
  },
  {
    id: 'corpse',
    title: '모험가의 시체',
    icon: '⚰️',
    text: '벽에 기대어 쓰러진 모험가의 시체. 배낭은 아직 멀쩡해 보인다. 그 주변에는 덫의 흔적이 있다.',
    options: [
      {
        label: '배낭을 뒤진다',
        detail: '골드 50 획득. 체력 5 잃음.',
        outcomes: [
          { type: 'gold', amount: 50 },
          { type: 'hp', amount: -5 },
        ],
        result: '배낭 속에서 금화를 찾았지만, 숨겨진 칼날이 손을 베었다.',
      },
      {
        label: '비망록을 읽는다',
        detail: '무작위 카드 1장 획득.',
        outcomes: [{ type: 'randomCard' }],
        result: '그가 남긴 전투 기록에서 새로운 기술을 익혔다.',
      },
      {
        label: '명복을 빈다',
        detail: '최대 체력 +4.',
        outcomes: [{ type: 'maxHp', amount: 4 }],
        result: '짧은 묵념. 어쩐지 마음이 단단해진다.',
      },
    ],
  },
  {
    id: 'spring',
    title: '검은 샘',
    icon: '⛲',
    text: '칠흑 같은 물이 고인 샘. 물에서는 쇠 맛이 나는 냉기가 올라온다.',
    options: [
      {
        label: '물을 마신다',
        detail: '최대 체력의 30% 회복.',
        outcomes: [{ type: 'healPercent', percent: 30 }],
        result: '차가운 물이 목을 타고 흐르며 상처가 아문다.',
      },
      {
        label: '몸을 씻는다',
        detail: '덱에서 카드 1장 제거.',
        outcomes: [{ type: 'chooseRemove' }],
        result: '검은 물이 오래된 습관 하나를 씻어 내렸다.',
      },
      {
        label: '떠난다',
        detail: '아무 일도 일어나지 않습니다.',
        outcomes: [],
        result: '샘을 지나친다.',
      },
    ],
  },
  {
    id: 'whisper',
    title: '속삭이는 그림자',
    icon: '👤',
    text: '어둠 속에서 목소리가 들린다. "대가를 치르면… 너의 기술을 벼려 주마."',
    options: [
      {
        label: '귀를 기울인다',
        detail: '체력 6 잃음. 무작위 카드 2장 강화.',
        outcomes: [
          { type: 'hp', amount: -6 },
          { type: 'upgradeRandom', count: 2 },
        ],
        result: '머릿속을 파고드는 목소리. 고통과 함께 기술이 날카로워졌다.',
      },
      {
        label: '금화를 바친다',
        detail: '골드 50 지불. 카드 1장 선택 강화.',
        requiresGold: 50,
        outcomes: [{ type: 'gold', amount: -50 }, { type: 'chooseUpgrade' }],
        result: '그림자가 금화를 삼키고 속삭였다. "좋은 거래였다."',
      },
      {
        label: '무시한다',
        detail: '아무 일도 일어나지 않습니다.',
        outcomes: [],
        result: '목소리는 점점 멀어졌다.',
      },
    ],
  },
  {
    id: 'forge',
    title: '버려진 대장간',
    icon: '⚒️',
    text: '아직 불씨가 남아 있는 화로와 낡은 모루. 누군가 급히 떠난 흔적이다.',
    options: [
      {
        label: '무기를 벼린다',
        detail: '카드 1장 선택 강화.',
        outcomes: [{ type: 'chooseUpgrade' }],
        result: '망치 소리가 지하에 울려 퍼진다.',
      },
      {
        label: '쉬어 간다',
        detail: '체력 10 회복.',
        outcomes: [{ type: 'hp', amount: 10 }],
        result: '화로의 온기에 잠시 몸을 녹였다.',
      },
      {
        label: '불씨를 옮겨 붙인다',
        detail: '촛농 15 회복.',
        outcomes: [{ type: 'candle', amount: 15 }],
        result: '화로의 불씨로 촛불을 다시 밝혔다. 그림자가 한 걸음 물러난다.',
      },
    ],
  },
  {
    id: 'chandler',
    title: '양초장이의 작업실',
    icon: '🕯️',
    text: '녹아내린 밀랍이 켜켜이 쌓인 작업대. 반쯤 만들다 만 양초들 사이로, 검게 물든 초 하나가 스스로 타고 있다.',
    options: [
      {
        label: '밀랍을 긁어모은다',
        detail: '촛농 20 회복.',
        outcomes: [{ type: 'candle', amount: 20 }],
        result: '남은 밀랍을 모아 촛대에 덧발랐다. 불꽃이 한층 커졌다.',
      },
      {
        label: '밀랍으로 상처를 봉한다',
        detail: '촛농 8 소모. 체력 14 회복.',
        outcomes: [
          { type: 'candle', amount: -8 },
          { type: 'hp', amount: 14 },
        ],
        result: '뜨거운 밀랍이 상처를 덮는다. 고통과 함께 피가 멎었다.',
      },
      {
        label: '검은 초의 불꽃을 들여다본다',
        detail: '촛농 6 소모. 그림자 카드 1장 획득.',
        outcomes: [
          { type: 'candle', amount: -6 },
          { type: 'randomCard', resonance: 'shadow' },
        ],
        result: '검은 불꽃 속에서 무언가가 속삭였다. 어둠을 다루는 법을 알 것 같다.',
      },
    ],
  },
];

export const EVENTS: Record<string, EventDef> = Object.fromEntries(
  EVENT_LIST.map((e) => [e.id, e]),
);

export const EVENT_IDS: string[] = EVENT_LIST.map((e) => e.id);
