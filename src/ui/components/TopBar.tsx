import { useState } from 'react';
import { getAct } from '../../data/acts';
import { RELICS } from '../../data/relics';
import { useGame } from '../../store/gameStore';
import type { RunState } from '../../types';
import { ICONS, RELIC_ICONS } from '../art';
import { CandleGauge } from './CandleGauge';
import { DeckModal } from './DeckModal';
import { Icon } from './Icon';
import styles from './TopBar.module.css';

export function TopBar({ run }: { run: RunState }) {
  const goToMenu = useGame((s) => s.goToMenu);
  const abandonRun = useGame((s) => s.abandonRun);
  const [showDeck, setShowDeck] = useState(false);
  const p = run.player;

  return (
    <header className={`${styles.bar} fade-in`}>
      <span className={styles.who}>
        <Icon src={ICONS.attack} size={18} /> {p.className}
      </span>
      <span className={`${styles.stat} ${styles.hp}`} title="체력">
        <Icon src={ICONS.hp} size={20} /> {p.hp}/{p.maxHp}
      </span>
      <CandleGauge candle={p.candle} maxCandle={p.maxCandle} size="small" />
      <span className={`${styles.stat} ${styles.gold}`} title="골드">
        ◉ {p.gold}
      </span>
      <span className={styles.where}>
        {run.act}막 · {getAct(run.act).name} · {run.floor}층
      </span>
      <div className={styles.relics}>
        {p.relics.map((id) => {
          const r = RELICS[id];
          return (
            <span key={id} className={styles.relic} title={`${r.name}: ${r.description}`}>
              <Icon src={RELIC_ICONS[id]} size={32} label={r.name} />
            </span>
          );
        })}
      </div>
      <div className={styles.spacer} />
      <div className={styles.actions}>
        <button className="btn" onClick={() => setShowDeck(true)}>
          덱 ({p.deck.length})
        </button>
        <button className="btn" onClick={goToMenu} title="진행 상황은 자동 저장됩니다">
          메뉴
        </button>
        {!run.result && (
          <button
            className="btn btn-danger"
            onClick={() => {
              if (window.confirm('이번 탐험을 포기하시겠습니까?')) abandonRun();
            }}
          >
            포기
          </button>
        )}
      </div>
      {showDeck && (
        <DeckModal
          title="덱"
          subtitle={`${p.deck.length}장`}
          cards={p.deck}
          onClose={() => setShowDeck(false)}
        />
      )}
    </header>
  );
}
