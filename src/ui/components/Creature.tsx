import { useEffect, useRef, useState } from 'react';
import type { IntentView } from '../../engine';
import type { StatusMap } from '../../types';
import { IntentBadges, StatusBadges } from './Badges';
import styles from './Creature.module.css';
import { HpBar } from './HpBar';

interface Props {
  name: string;
  icon: string;
  hp: number;
  maxHp: number;
  block: number;
  statuses: StatusMap;
  variant: 'player' | 'normal' | 'elite' | 'boss';
  intent?: IntentView | null;
  targetable?: boolean;
  onClick?: () => void;
  onHover?: (hovering: boolean) => void;
}

/** Flashes briefly whenever `value` goes down. */
function useHitFlash(value: number): boolean {
  const prev = useRef(value);
  const [hit, setHit] = useState(false);
  useEffect(() => {
    if (value < prev.current) {
      setHit(true);
      const t = setTimeout(() => setHit(false), 350);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value]);
  return hit;
}

export function Creature({
  name,
  icon,
  hp,
  maxHp,
  block,
  statuses,
  variant,
  intent,
  targetable,
  onClick,
  onHover,
}: Props) {
  const hit = useHitFlash(hp + block);
  const dead = hp <= 0;
  const classes = [
    styles.creature,
    styles[variant],
    targetable && !dead && styles.targetable,
    dead && styles.dead,
    hit && styles.hit,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      onClick={targetable && !dead ? onClick : undefined}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      {variant !== 'player' && (
        <div className={styles.intent}>{!dead && <IntentBadges intent={intent ?? null} />}</div>
      )}
      <div className={styles.portrait} aria-hidden>
        {dead ? '✝️' : icon}
      </div>
      <div className={styles.name}>{name}</div>
      <HpBar hp={hp} maxHp={maxHp} block={block} />
      <StatusBadges statuses={statuses} />
    </div>
  );
}
