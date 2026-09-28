import styles from './HpBar.module.css';

interface Props {
  hp: number;
  maxHp: number;
  block?: number;
}

export function HpBar({ hp, maxHp, block = 0 }: Props) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  return (
    <div className={styles.wrap}>
      {block > 0 && (
        <div className={styles.block} title={`방어도 ${block}`}>
          {block}
        </div>
      )}
      <div className={`${styles.bar} ${block > 0 ? styles.withBlock : ''}`}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
        <div className={styles.label}>
          {hp} / {maxHp}
        </div>
      </div>
    </div>
  );
}
