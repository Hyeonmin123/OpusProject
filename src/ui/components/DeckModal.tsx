import { useEffect } from 'react';
import { describeCard, getCardDef } from '../../engine';
import type { CardInstance } from '../../types';
import { CardView } from './CardView';
import styles from './Modal.module.css';

interface Props {
  title: string;
  subtitle?: string;
  cards: CardInstance[];
  /** When set, cards are clickable and the modal acts as a picker. */
  onPick?: (card: CardInstance) => void;
  /** Cards failing the filter are shown disabled. */
  canPick?: (card: CardInstance) => boolean;
  /** Omit to make the modal mandatory (no close button). */
  onClose?: () => void;
  showUpgradePreview?: boolean;
  /** Keep pile order (e.g. discard pile) instead of sorting by type/name. */
  keepOrder?: boolean;
}

const TYPE_ORDER = { attack: 0, skill: 1, power: 2, status: 3 };
const cardType = (card: CardInstance) => getCardDef(card.defId).type;

export function DeckModal({
  title,
  subtitle,
  cards,
  onPick,
  canPick,
  onClose,
  showUpgradePreview,
  keepOrder,
}: Props) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sorted = keepOrder
    ? cards
    : [...cards].sort((a, b) => {
        const ta = TYPE_ORDER[cardType(a)];
        const tb = TYPE_ORDER[cardType(b)];
        return ta - tb || a.defId.localeCompare(b.defId) || Number(b.upgraded) - Number(a.upgraded);
      });

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2>{title}</h2>
            {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
          </div>
          {onClose && (
            <button className="btn" onClick={onClose}>
              닫기
            </button>
          )}
        </div>
        <div className={styles.body}>
          {sorted.length === 0 ? (
            <div className={styles.empty}>카드가 없습니다.</div>
          ) : (
            <div className={styles.grid}>
              {sorted.map((card) => {
                const pickable = onPick && (canPick ? canPick(card) : true);
                return (
                  <div key={card.uid} className={styles.cell}>
                    <CardView
                      card={card}
                      size="small"
                      onClick={pickable ? () => onPick(card) : undefined}
                      disabled={onPick && !pickable}
                    />
                    {showUpgradePreview && pickable && (
                      <div className={styles.preview}>
                        → {describeCard({ ...card, upgraded: true })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
