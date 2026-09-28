import {
  BLACKOUT_DAMAGE,
  BLACKOUT_ENEMY_DAMAGE_BONUS,
  dimThreshold,
  lightLevel,
} from '../../engine';
import { ICONS } from '../art';
import styles from './CandleGauge.module.css';
import { Icon } from './Icon';

interface Props {
  candle: number;
  maxCandle: number;
  /** 'large' is the combat gauge; 'small' fits the top bar. */
  size?: 'large' | 'small';
  /** Wax burned per combat turn, shown as a hint on the large gauge. */
  drain?: number;
}

const LEVEL_LABEL = { bright: '밝음', dim: '어스름', dark: '암전' } as const;

/** Candle wax gauge: a flame plus a bar with a tick at the dim threshold. */
export function CandleGauge({ candle, maxCandle, size = 'large', drain }: Props) {
  const level = lightLevel({ candle, maxCandle });
  const pct = maxCandle > 0 ? Math.max(0, Math.min(100, (candle / maxCandle) * 100)) : 0;
  const thresholdPct = (dimThreshold(maxCandle) / maxCandle) * 100;
  const title =
    level === 'dark'
      ? `암전: 턴마다 체력 ${BLACKOUT_DAMAGE} 잃음, 적 공격 피해 +${BLACKOUT_ENEMY_DAMAGE_BONUS}%, 적의 의도가 모두 가려짐`
      : level === 'dim'
        ? '어스름: 적의 의도 일부가 어둠에 가려집니다'
        : '촛불이 밝게 타고 있습니다';

  return (
    <div
      className={`${styles.gauge} ${styles[size]} ${styles[level]}`}
      title={`촛농 ${candle}/${maxCandle} — ${title}`}
      data-testid={size === 'large' ? 'candle-gauge' : undefined}
      data-level={level}
    >
      <span className={styles.flame}>
        <Icon
          src={level === 'dark' ? ICONS.candleOut : ICONS.candle}
          size={size === 'large' ? 30 : 18}
        />
      </span>
      <div className={styles.body}>
        {size === 'large' && (
          <div className={styles.header}>
            <span>촛불 · {LEVEL_LABEL[level]}</span>
            {drain !== undefined && <span className={styles.drain}>턴당 -{drain}</span>}
          </div>
        )}
        <div className={styles.bar}>
          <div className={styles.fill} style={{ width: `${pct}%` }} />
          <div className={styles.tick} style={{ left: `${thresholdPct}%` }} />
          <div className={styles.label}>
            {candle}/{maxCandle}
          </div>
        </div>
      </div>
    </div>
  );
}
