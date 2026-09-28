import { useState } from 'react';
import { canUpgrade, restHealAmount } from '../../engine';
import { useGame } from '../../store/gameStore';
import type { RunState } from '../../types';
import { DeckModal } from '../components/DeckModal';
import styles from './Screens.module.css';

export function RestScreen({ run }: { run: RunState }) {
  const rest = run.rest!;
  const heal = useGame((s) => s.restHeal);
  const upgrade = useGame((s) => s.restUpgrade);
  const leave = useGame((s) => s.leaveRest);
  const [picking, setPicking] = useState(false);
  const p = run.player;
  const healAmount = Math.min(restHealAmount(run), p.maxHp - p.hp);
  const anyUpgradable = p.deck.some(canUpgrade);

  return (
    <div className={`${styles.screen} fade-in`}>
      <div className={`${styles.box} panel`}>
        <div className={styles.head}>
          <div className={styles.icon}>🔥</div>
          <div>
            <h2>휴식처</h2>
            <div className="dim">꺼져 가는 모닥불. 잠시 숨을 돌릴 수 있을 것 같다.</div>
          </div>
        </div>

        {!rest.done ? (
          <div className={styles.restChoices}>
            <button className={`btn ${styles.restChoice}`} onClick={heal}>
              <span className={styles.relicIcon}>💤</span>
              <span className={styles.relicName}>휴식</span>
              <span className={styles.relicDesc}>
                최대 체력의 30%를 회복합니다. (+{healAmount})
              </span>
            </button>
            <button
              className={`btn ${styles.restChoice}`}
              onClick={() => setPicking(true)}
              disabled={!anyUpgradable}
            >
              <span className={styles.relicIcon}>⚒️</span>
              <span className={styles.relicName}>단련</span>
              <span className={styles.relicDesc}>카드 1장을 강화합니다.</span>
            </button>
          </div>
        ) : (
          <div className={styles.result}>{rest.note}</div>
        )}

        <div className={styles.footer}>
          <button className={`btn ${rest.done ? 'btn-primary' : ''} btn-large`} onClick={leave}>
            {rest.done ? '계속' : '그냥 지나가기'}
          </button>
        </div>
      </div>

      {picking && (
        <DeckModal
          title="강화할 카드 선택"
          cards={p.deck}
          canPick={canUpgrade}
          showUpgradePreview
          onPick={(card) => {
            upgrade(card.uid);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
