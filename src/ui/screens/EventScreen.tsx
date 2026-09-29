import { EVENTS } from '../../data/events';
import { canChooseEventOption, canUpgrade } from '../../engine';
import { useGame } from '../../store/gameStore';
import type { RunState } from '../../types';
import { EVENT_ICONS } from '../art';
import { DeckModal } from '../components/DeckModal';
import { Icon } from '../components/Icon';
import styles from './Screens.module.css';

export function EventScreen({ run }: { run: RunState }) {
  const event = run.event!;
  const def = EVENTS[event.eventId];
  const choose = useGame((s) => s.chooseEventOption);
  const resolvePick = useGame((s) => s.resolveEventPick);
  const leave = useGame((s) => s.leaveEvent);
  const chosen = event.chosenOption !== null ? def.options[event.chosenOption] : null;

  return (
    <div className={`${styles.screen} ${styles.eventScreen}`}>
      <div className={`${styles.box} ${styles.eventBox} panel`}>
        <div className={styles.head}>
          <div className={styles.icon}>
            <Icon src={EVENT_ICONS[def.id]} size={128} />
          </div>
          <h2>{def.title}</h2>
        </div>
        <p className={styles.text}>{def.text}</p>

        {!chosen ? (
          <div className={styles.options}>
            {def.options.map((opt, i) => (
              <button
                key={i}
                className={`btn ${styles.option}`}
                onClick={() => choose(i)}
                disabled={!canChooseEventOption(run, i)}
              >
                <span className={styles.optionLabel}>[{opt.label}]</span>
                <span className={styles.optionDetail}>
                  {opt.detail}
                  {opt.requiresGold !== undefined && run.player.gold < opt.requiresGold
                    ? ' (골드 부족)'
                    : ''}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className={styles.result}>
              {chosen.result}
              {event.notes.length > 0 && (
                <ul className={styles.notes}>
                  {event.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className={styles.footer}>
              <button
                className="btn btn-primary btn-large"
                onClick={leave}
                disabled={!!event.pendingPick}
              >
                계속
              </button>
            </div>
          </>
        )}
      </div>

      {event.pendingPick && (
        <DeckModal
          title={event.pendingPick === 'remove' ? '제거할 카드 선택' : '강화할 카드 선택'}
          subtitle="카드를 1장 선택하세요."
          cards={run.player.deck}
          canPick={event.pendingPick === 'upgrade' ? canUpgrade : undefined}
          showUpgradePreview={event.pendingPick === 'upgrade'}
          onPick={(card) => resolvePick(card.uid)}
        />
      )}
    </div>
  );
}
