import type { ReactNode } from 'react';
import {
  type DescribeView,
  cardResonance,
  describeCard,
  getCardDef,
  getCardStats,
} from '../../engine';
import type { CardInstance, CardResonance, CardType } from '../../types';
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

const RESONANCE_LABEL: Record<CardResonance, string> = {
  light: '빛',
  shadow: '그림자',
  neutral: '',
};

const RESONANCE_GLYPH: Record<CardResonance, string> = {
  light: '☀️',
  shadow: '🌑',
  neutral: '',
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
  const resonance = cardResonance(card);
  const classes = [
    styles.card,
    styles[def.type],
    resonance !== 'neutral' && styles[resonance],
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
      {stats.candle ? (
        <div
          className={`${styles.wax} ${stats.candle > 0 ? styles.waxGain : styles.waxBurn}`}
          title={stats.candle > 0 ? `촛농 ${stats.candle} 회복` : `촛농 ${-stats.candle} 소모`}
        >
          {stats.candle > 0 ? '+' : ''}
          {stats.candle}
        </div>
      ) : null}
      <div className={styles.name}>
        {def.name}
        {card.upgraded ? '+' : ''}
      </div>
      <div className={styles.art}>
        {TYPE_GLYPH[def.type]}
        {resonance !== 'neutral' && (
          <span className={styles.resonanceGlyph} aria-hidden>
            {RESONANCE_GLYPH[resonance]}
          </span>
        )}
      </div>
      <div className={styles.type}>
        {TYPE_LABEL[def.type]}
        {resonance !== 'neutral' && ` · ${RESONANCE_LABEL[resonance]}`}
      </div>
      <div className={styles.desc}>{describeCard(card, view)}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
