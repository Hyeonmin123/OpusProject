import { useState } from 'react';
import { canUpgrade, restHealAmount, restRekindleAmount } from '../../engine';
import { useGame } from '../../store/gameStore';
import type { RunState } from '../../types';
import { ICONS, NODE_ICONS } from '../art';
import { DeckModal } from '../components/DeckModal';
import { Icon } from '../components/Icon';
import styles from './Screens.module.css';

export function RestScreen({ run }: { run: RunState }) {
  const rest = run.rest!;
  const heal = useGame((s) => s.restHeal);
  const upgrade = useGame((s) => s.restUpgrade);
  const rekindle = useGame((s) => s.restRekindle);
  const leave = useGame((s) => s.leaveRest);
  const [picking, setPicking] = useState(false);
  const p = run.player;
  const healAmount = Math.min(restHealAmount(run), p.maxHp - p.hp);
  const anyUpgradable = p.deck.some(canUpgrade);
  const waxAmount = Math.min(restRekindleAmount(run), p.maxCandle - p.candle);

  return (
    <div className={styles.screen}>
      <div className={`${styles.box} panel`}>
        <div className={styles.head}>
          <div className={styles.icon}>
            <Icon src={NODE_ICONS.rest} size={64} />
          </div>
          <div>
            <h2>휴식처</h2>
            <div className="dim">꺼져 가는 모닥불. 잠시 숨을 돌릴 수 있을 것 같다.</div>
          </div>
        </div>

        {!rest.done ? (
          <div className={styles.restChoices}>
            <button className={`btn ${styles.restChoice}`} onClick={heal}>
              <span className={styles.relicIcon}>
                <Icon src={ICONS.restHeal} size={42} />
              </span>
              <span className={styles.relicName}>휴식</span>
              <span className={styles.relicDesc}>
                최대 체력의 30%를 회복합니다. (+{healAmount})
              </span>
            </button>
            <button
              className={`btn ${styles.restChoice}`}
              onClick={rekindle}
              disabled={waxAmount <= 0}
            >
              <span className={styles.relicIcon}>
                <Icon src={ICONS.candle} size={42} />
              </span>
              <span className={styles.relicName}>촛불 밝히기</span>
              <span className={styles.relicDesc}>
                모닥불로 초를 다시 밝혀 최대 촛농의 50%를 회복합니다. (+{waxAmount}, 현재 {p.candle}
                /{p.maxCandle})
              </span>
            </button>
            <button
              className={`btn ${styles.restChoice}`}
              onClick={() => setPicking(true)}
              disabled={!anyUpgradable}
            >
              <span className={styles.relicIcon}>
                <Icon src={ICONS.restUpgrade} size={42} />
              </span>
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
