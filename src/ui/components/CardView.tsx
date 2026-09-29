import type { ReactNode } from 'react';
import {
  type DescribeView,
  cardResonance,
  describeCard,
  getCardDef,
  getCardStats,
} from '../../engine';
import type { CardInstance, CardResonance, CardType } from '../../types';
import { CARD_TYPE_ICONS, ICONS } from '../art';
import styles from './CardView.module.css';
import { Icon } from './Icon';

const TYPE_LABEL: Record<CardType, string> = {
  attack: '공격',
  skill: '스킬',
  power: '파워',
  status: '상태이상',
};

const RESONANCE_LABEL: Record<CardResonance, string> = {
  light: '빛',
  shadow: '그림자',
  neutral: '',
};

const RESONANCE_ICON: Record<Exclude<CardResonance, 'neutral'>, string> = {
  light: ICONS.light,
  shadow: ICONS.shadow,
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
  /** 'large' is the normal card drawn at 2x (reward picks), where the screen has room. */
  size?: 'normal' | 'small' | 'large';
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
    size === 'large' && styles.large,
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
      <div className={styles.art}>
        {stats.candle ? (
          <span
            className={`${styles.wax} ${stats.candle > 0 ? styles.waxGain : styles.waxBurn}`}
            title={stats.candle > 0 ? `촛농 ${stats.candle} 회복` : `촛농 ${-stats.candle} 소모`}
          >
            <Icon src={ICONS.candle} size={13} />
            {stats.candle > 0 ? '+' : ''}
            {stats.candle}
          </span>
        ) : null}
        <Icon src={CARD_TYPE_ICONS[def.type]} size={size === 'small' ? 24 : 30} />
        {resonance !== 'neutral' && (
          <span className={styles.resonanceGlyph}>
            <Icon src={RESONANCE_ICON[resonance]} size={14} />
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
