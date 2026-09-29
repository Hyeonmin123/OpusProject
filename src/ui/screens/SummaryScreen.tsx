import { getAct } from '../../data/acts';
import { RELICS } from '../../data/relics';
import { cardName, getCardDef } from '../../engine';
import { useGame } from '../../store/gameStore';
import type { CardType, RunState } from '../../types';
import { CARD_TYPE_ICONS, ICONS, RELIC_ICONS } from '../art';
import { Icon } from '../components/Icon';
import styles from './Screens.module.css';

export function SummaryScreen({ run }: { run: RunState }) {
  const closeRun = useGame((s) => s.closeRun);
  const newRun = useGame((s) => s.newRun);
  const victory = run.result === 'victory';
  const s = run.stats;

  const stats: Array<[string, number | string]> = [
    ['도달', `${run.act}막 ${run.floor}층`],
    ['처치한 적', s.enemiesKilled],
    ['정예 처치', s.elitesKilled],
    ['보스 처치', s.bossesKilled],
    ['사용한 카드', s.cardsPlayed],
    ['진행한 턴', s.turnsTaken],
    ['가한 피해', s.damageDealt],
    ['받은 피해', s.damageTaken],
    ['획득 골드', s.goldEarned],
    ['태운 촛농', s.waxBurned],
    ['암전 속 턴', s.blackoutTurns],
  ];

  // The final deck, one chip per distinct card (in deck order) with its type and count.
  const deck = new Map<string, { n: number; type: CardType; upgraded: boolean }>();
  for (const c of run.player.deck) {
    const name = cardName(c);
    const entry = deck.get(name);
    if (entry) entry.n += 1;
    else deck.set(name, { n: 1, type: getCardDef(c.defId).type, upgraded: c.upgraded });
  }

  return (
    <div className={styles.screen}>
      <div className={`${styles.box} ${styles.wideBox} ${styles.summaryBox} panel`}>
        <div className={styles.head}>
          <div className={styles.icon}>
            <Icon src={victory ? ICONS.victory : ICONS.defeat} size={128} />
          </div>
          <div>
            <h2 className={victory ? styles.victoryTitle : styles.defeatTitle}>
              {victory ? '지하실을 정복했다' : '탐험 실패'}
            </h2>
            <div className={styles.subtitle}>
              {victory
                ? '끝없는 지하실의 가장 깊은 곳에서 살아 돌아왔다.'
                : `${getAct(run.act).name}에서 — ${run.deathCause ?? '알 수 없는 이유'}`}
            </div>
          </div>
        </div>

        <div className={styles.statsGrid}>
          {stats.map(([label, value]) => (
            <div key={label} className={styles.stat}>
              <div className={styles.statValue}>{value}</div>
              <div className={styles.statLabel}>{label}</div>
            </div>
          ))}
        </div>

        <div className={styles.sectionTitle}>최종 덱 ({run.player.deck.length}장)</div>
        <div className={styles.chips}>
          {[...deck.entries()].map(([name, { n, type, upgraded }]) => (
            <span key={name} className={`${styles.chip} ${upgraded ? styles.chipUpgraded : ''}`}>
              <Icon src={CARD_TYPE_ICONS[type]} size={16} />
              {name}
              {n > 1 && <span className={styles.chipCount}>×{n}</span>}
            </span>
          ))}
        </div>

        <div className={styles.sectionTitle}>유물 ({run.player.relics.length}개)</div>
        <div className={styles.chips}>
          {run.player.relics.map((id) => (
            <span
              key={id}
              className={styles.chip}
              title={`${RELICS[id].name}: ${RELICS[id].description}`}
            >
              <Icon src={RELIC_ICONS[id]} size={32} />
              {RELICS[id].name}
            </span>
          ))}
        </div>

        <div className={styles.seed}>시드: {run.seed}</div>

        <div className={styles.footer}>
          <button className="btn btn-large" onClick={closeRun}>
            메인 메뉴
          </button>
          <button
            className="btn btn-primary btn-large"
            onClick={() => {
              closeRun();
              newRun();
            }}
          >
            새 탐험
          </button>
        </div>
      </div>
    </div>
  );
}
