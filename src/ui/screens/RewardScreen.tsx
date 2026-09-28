import { FINAL_ACT } from '../../data/acts';
import { RELICS } from '../../data/relics';
import { useGame } from '../../store/gameStore';
import type { RunState } from '../../types';
import { CardView } from '../components/CardView';
import styles from './Screens.module.css';

export function RewardScreen({ run }: { run: RunState }) {
  const reward = run.reward!;
  const claimGold = useGame((s) => s.claimRewardGold);
  const claimRelic = useGame((s) => s.claimRewardRelic);
  const pickCard = useGame((s) => s.pickRewardCard);
  const skipCard = useGame((s) => s.skipRewardCard);
  const leave = useGame((s) => s.leaveReward);
  const relic = reward.relicId ? RELICS[reward.relicId] : null;
  const isBoss = reward.tier === 'boss';

  const leaveLabel = isBoss
    ? run.act >= FINAL_ACT
      ? '지하실을 벗어난다'
      : `${run.act + 1}막으로 내려간다`
    : '지도로 돌아가기';

  return (
    <div className={`${styles.screen} fade-in`}>
      <div className={`${styles.box} panel`}>
        <div className={styles.head}>
          <div className={styles.icon}>🏆</div>
          <div>
            <h2>전리품</h2>
            <div className="dim">
              {isBoss ? '보스 처치 보상' : reward.tier === 'elite' ? '정예 처치 보상' : '전투 보상'}
            </div>
          </div>
        </div>

        <button
          className={`btn ${styles.rewardRow} ${reward.goldClaimed ? styles.claimed : ''}`}
          onClick={claimGold}
          disabled={reward.goldClaimed}
        >
          <span className={styles.rewardIcon}>◉</span>
          <span>골드 {reward.gold}</span>
        </button>

        {relic && (
          <button
            className={`btn ${styles.rewardRow} ${reward.relicClaimed ? styles.claimed : ''}`}
            onClick={claimRelic}
            disabled={reward.relicClaimed}
            title={relic.description}
          >
            <span className={styles.rewardIcon}>{relic.icon}</span>
            <span>
              유물: <b>{relic.name}</b> <span className="dim">— {relic.description}</span>
            </span>
          </button>
        )}

        <div className={styles.sectionTitle}>
          {reward.cardResolved ? '카드 보상 완료' : '덱에 추가할 카드를 1장 선택하세요'}
        </div>
        {!reward.cardResolved && (
          <>
            <div className={styles.cards}>
              {reward.cardChoices.map((card, i) => (
                <CardView key={card.uid} card={card} onClick={() => pickCard(i)} />
              ))}
            </div>
            <div className={styles.center}>
              <button className="btn" onClick={skipCard}>
                카드 받지 않기
              </button>
            </div>
          </>
        )}

        <div className={styles.footer}>
          <button className="btn btn-primary btn-large" onClick={leave}>
            {leaveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
