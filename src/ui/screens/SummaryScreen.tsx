import { getAct } from '../../data/acts';
import { RELICS } from '../../data/relics';
import { cardName } from '../../engine';
import { useGame } from '../../store/gameStore';
import type { RunState } from '../../types';
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

  const deckCounts = new Map<string, number>();
  for (const c of run.player.deck)
    deckCounts.set(cardName(c), (deckCounts.get(cardName(c)) ?? 0) + 1);

  return (
    <div className={`${styles.screen} fade-in`}>
      <div className={`${styles.box} panel`}>
        <div className={styles.head}>
          <div className={styles.icon}>{victory ? '👑' : '🪦'}</div>
          <div>
            <h2 className={victory ? styles.victoryTitle : styles.defeatTitle}>
              {victory ? '지하실을 정복했다' : '탐험 실패'}
            </h2>
            <div className="dim">
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
        <div className="dim">
          {[...deckCounts.entries()]
            .map(([name, n]) => `${name}${n > 1 ? ` ×${n}` : ''}`)
            .join(', ')}
        </div>

        <div className={styles.sectionTitle}>유물</div>
        <div className="dim">
          {run.player.relics.map((id) => `${RELICS[id].icon} ${RELICS[id].name}`).join(', ')}
        </div>

        <div className="dim" style={{ fontFamily: 'var(--font-px11)', fontSize: 12 }}>
          시드: {run.seed}
        </div>

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
