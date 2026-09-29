import { FINAL_ACT } from '../../data/acts';
import { RELICS } from '../../data/relics';
import { useGame } from '../../store/gameStore';
import type { RunState } from '../../types';
import { ICONS, RELIC_ICONS } from '../art';
import { CardView } from '../components/CardView';
import { Icon } from '../components/Icon';
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
  const unclaimed = !reward.goldClaimed || (relic !== null && !reward.relicClaimed);

  const leaveLabel = isBoss
    ? run.act >= FINAL_ACT
      ? '지하실을 벗어난다'
      : `${run.act + 1}막으로 내려간다`
    : '지도로 돌아가기';

  return (
    <div className={styles.screen}>
      <div className={`${styles.box} ${styles.wideBox} panel`}>
        <div className={styles.head}>
          <div className={styles.icon}>
            <Icon src={ICONS.reward} size={64} />
          </div>
          <div>
            <h2>전리품</h2>
            <div className="dim">
              {isBoss ? '보스 처치 보상' : reward.tier === 'elite' ? '정예 처치 보상' : '전투 보상'}
            </div>
          </div>
        </div>

        <div className={styles.rewardRows}>
          <button
            className={`btn ${styles.rewardRow} ${reward.goldClaimed ? styles.claimed : `btn-primary ${styles.unclaimed}`}`}
            onClick={claimGold}
            disabled={reward.goldClaimed}
          >
            <span className={styles.rewardIcon}>◉</span>
            <span className={styles.rewardText}>골드 {reward.gold}</span>
            <ClaimTag claimed={reward.goldClaimed} />
          </button>

          {relic && (
            <button
              className={`btn ${styles.rewardRow} ${reward.relicClaimed ? styles.claimed : `btn-primary ${styles.unclaimed}`}`}
              onClick={claimRelic}
              disabled={reward.relicClaimed}
              title={relic.description}
            >
              <span className={styles.rewardIcon}>
                <Icon src={RELIC_ICONS[relic.id]} size={32} />
              </span>
              <span className={styles.rewardText}>
                유물: <span className={styles.rewardName}>{relic.name}</span>{' '}
                <span className={styles.rewardDesc}>— {relic.description}</span>
              </span>
              <ClaimTag claimed={reward.relicClaimed} />
            </button>
          )}
        </div>

        <div className={styles.sectionTitle}>
          {reward.cardResolved ? '카드 보상 완료' : '덱에 추가할 카드를 1장 선택하세요'}
        </div>
        {!reward.cardResolved && (
          <div className={styles.cards}>
            {reward.cardChoices.map((card, i) => (
              <CardView key={card.uid} card={card} size="large" onClick={() => pickCard(i)} />
            ))}
          </div>
        )}

        <div className={styles.footer}>
          {!reward.cardResolved && (
            <button className={`btn btn-large ${styles.footerStart}`} onClick={skipCard}>
              카드 받지 않기
            </button>
          )}
          {unclaimed && <span className={styles.leaveWarn}>! 받지 않은 보상은 사라집니다</span>}
          <button className="btn btn-primary btn-large" onClick={leave}>
            {leaveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The row's call to action: a gilt "받기" tag that blinks until the reward is taken. */
function ClaimTag({ claimed }: { claimed: boolean }) {
  return (
    <span className={`${styles.claimTag} ${claimed ? styles.claimTagDone : ''}`}>
      {claimed ? '받음' : '받기'}
    </span>
  );
}
