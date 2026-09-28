import type { ReactNode } from 'react';
import { type DescribeView, describeCard, getCardDef, getCardStats } from '../../engine';
import type { CardInstance, CardType } from '../../types';
import styles from './CardView.module.css';

const TYPE_LABEL: Record<CardType, string> = {
  attack: '공격',
  skill: '스킬',
  power: '파워',
  status: '상태이상',
};

/** Placeholder "art" glyph per card type until Figma illustrations exist. */
const TYPE_GLYPH: Record<CardType, string> = {
  attack: '⚔️',
  skill: '🛡️',
  power: '✨',
  status: '☁️',
};

interface Props {
  card: CardInstance;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  /** Energy available; the cost gem turns red if the card is unaffordable. */
  energy?: number;
  /** Live combat numbers for the rules text. */
  view?: DescribeView;
  size?: 'normal' | 'small';
  footer?: ReactNode;
  title?: string;
}

export function CardView({
  card,
  onClick,
  selected,
  disabled,
  energy,
  view,
  size = 'normal',
  footer,
  title,
}: Props) {
  const def = getCardDef(card.defId);
  const stats = getCardStats(card);
  const classes = [
    styles.card,
    styles[def.type],
    size === 'small' && styles.small,
    card.upgraded && styles.upgraded,
    onClick && !disabled && styles.clickable,
    selected && styles.selected,
    disabled && styles.disabled,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      onClick={disabled ? undefined : onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && !disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      title={title}
    >
      {!stats.unplayable && (
        <div
          className={`${styles.cost} ${energy !== undefined && stats.cost > energy ? styles.costUnaffordable : ''}`}
        >
          {stats.cost}
        </div>
      )}
      <div className={styles.name}>
        {def.name}
        {card.upgraded ? '+' : ''}
      </div>
      <div className={styles.art}>{TYPE_GLYPH[def.type]}</div>
      <div className={styles.type}>{TYPE_LABEL[def.type]}</div>
      <div className={styles.desc}>{describeCard(card, view)}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
