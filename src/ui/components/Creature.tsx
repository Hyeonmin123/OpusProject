import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { STATUSES } from '../../data/statuses';
import type { IntentView } from '../../engine';
import type { CombatFx, StatusMap } from '../../types';
import { ICONS, STATUS_ICONS } from '../art';
import { IntentBadges, StatusBadges } from './Badges';
import styles from './Creature.module.css';
import { HpBar } from './HpBar';
import { Icon } from './Icon';

/** What a combatant is doing this beat: an attack lunges at the other side, anything else hops. */
export type CreatureMotion = 'attack' | 'cast';

interface Props {
  name: string;
  /** Emoji fallback, shown when there is no portrait art. */
  icon: string;
  /** Portrait image URL (see `ui/art.ts`). */
  portrait?: string;
  hp: number;
  maxHp: number;
  block: number;
  statuses: StatusMap;
  variant: 'player' | 'normal' | 'elite' | 'boss';
  intent?: IntentView | null;
  targetable?: boolean;
  /** Presentation cues for this combatant (see `CombatFx`); new ones pop up as numbers. */
  cues?: CombatFx[];
  /** Set while this combatant acts; `motionKey` restarts the motion for a new action. */
  motion?: CreatureMotion | null;
  motionKey?: number;
  /** The enemy the player's current attack is aimed at (the player's strike lands on it). */
  aimed?: boolean;
  onClick?: () => void;
  onHover?: (hovering: boolean) => void;
}

type Tone = 'damage' | 'blocked' | 'block' | 'heal' | 'buff' | 'debuff';

interface Float {
  key: number;
  tone: Tone;
  text: string;
  icon?: string;
  /** Small secondary line (e.g. the part of a hit that block absorbed). */
  sub?: string;
  /** Stagger for several cues landing at once (multi-hits). */
  delay: number;
  dx: number;
}

const FLOAT_MS = 900;
/** Horizontal lanes (px) that successive floats take turns in, so overlapping ones stay legible. */
const LANES = [0, 30, -30];
/** Longest portrait flash (the hit), plus a frame. */
const FLASH_MS = 400;

function toFloat(cue: CombatFx): Float | null {
  const base = { key: cue.id, delay: 0, dx: 0 };
  switch (cue.kind) {
    case 'damage': {
      const hpLoss = cue.amount - (cue.blocked ?? 0);
      if (hpLoss > 0)
        return {
          ...base,
          tone: 'damage',
          text: `-${hpLoss}`,
          sub: cue.blocked ? `방어 -${cue.blocked}` : undefined,
        };
      return { ...base, tone: 'blocked', text: `-${cue.blocked ?? cue.amount}`, icon: ICONS.block };
    }
    case 'hpLoss':
      return cue.amount > 0 ? { ...base, tone: 'damage', text: `-${cue.amount}` } : null;
    case 'block':
      return { ...base, tone: 'block', text: `+${cue.amount}`, icon: ICONS.block };
    case 'heal':
      return { ...base, tone: 'heal', text: `+${cue.amount}` };
    case 'status': {
      if (!cue.status) return null;
      const def = STATUSES[cue.status];
      return {
        ...base,
        tone: def.kind,
        text: `${def.name} ${cue.amount > 0 ? '+' : ''}${cue.amount}`,
        icon: STATUS_ICONS[cue.status],
      };
    }
  }
}

/** How far (px) a striking portrait runs into the target's frame at the moment of contact. */
const STRIKE_OVERLAP = 12;
/** Strike offsets snap to this step, so every keyframe (eighths of the reach) is whole pixels. */
const STRIKE_STEP = 8;

function snapStrike(v: number) {
  return Math.round(v / STRIKE_STEP) * STRIKE_STEP;
}

/**
 * Where an attacking portrait must travel to strike the other side: from its resting place to
 * where its leading edge runs `STRIKE_OVERLAP` px into the target's frame, level with it.
 * Measured from the (untransformed) creature roots and the portraits' layout offsets, so the
 * motion's own transform never skews it. The player strikes the aimed enemy (or the first one
 * standing); an enemy strikes the player. Null when there is nothing to aim at.
 */
function strikeReach(root: HTMLElement, isPlayer: boolean): { x: number; y: number } | null {
  const target = isPlayer
    ? (document.querySelector<HTMLElement>('[data-combatant="enemy"][data-aimed="true"]') ??
      document.querySelector<HTMLElement>('[data-combatant="enemy"]:not([data-dead="true"])'))
    : document.querySelector<HTMLElement>('[data-combatant="player"]');
  if (!target) return null;
  const frame = (el: HTMLElement) => {
    const portrait = el.querySelector<HTMLElement>('[data-portrait]');
    const body = portrait?.parentElement;
    if (!portrait || !body) return null;
    const r = el.getBoundingClientRect();
    const w = portrait.offsetWidth;
    const h = portrait.offsetHeight;
    return {
      cx: r.left + body.offsetLeft + portrait.offsetLeft + w / 2,
      cy: r.top + body.offsetTop + portrait.offsetTop + h / 2,
      w,
      h,
    };
  };
  const a = frame(root);
  const b = frame(target);
  if (!a || !b) return null;
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  // Side by side (the normal stage): close the horizontal gap and come level with the target.
  // Stacked (the narrow layout): close the vertical gap instead.
  if (Math.abs(dx) >= Math.abs(dy)) {
    const gap = Math.max(0, Math.abs(dx) - (a.w + b.w) / 2);
    return { x: snapStrike(Math.sign(dx) * (gap + STRIKE_OVERLAP)), y: snapStrike(dy) };
  }
  const gap = Math.max(0, Math.abs(dy) - (a.h + b.h) / 2);
  return { x: snapStrike(dx), y: snapStrike(Math.sign(dy) * (gap + STRIKE_OVERLAP)) };
}

type Flash = 'hit' | 'hitBlocked' | 'guard';

/** The strongest reaction a batch of cues calls for: losing HP, a hit soaked by block, block. */
function flashFor(cues: CombatFx[]): Flash | null {
  const hit = (c: CombatFx) =>
    (c.kind === 'damage' && c.amount > (c.blocked ?? 0)) || (c.kind === 'hpLoss' && c.amount > 0);
  if (cues.some(hit)) return 'hit';
  if (cues.some((c) => c.kind === 'damage')) return 'hitBlocked';
  if (cues.some((c) => c.kind === 'block')) return 'guard';
  return null;
}

/**
 * Turns new cues into floating numbers and a portrait flash. Cues that already existed when
 * the combatant mounted (a reload, a new screen) are never replayed.
 */
function useCues(cues: CombatFx[] | undefined) {
  const seen = useRef(cues?.at(-1)?.id ?? 0);
  const lane = useRef(0);
  const [floats, setFloats] = useState<Float[]>([]);
  /** n alternates 1/2 so back-to-back flashes restart the animation; 0 = idle. */
  const [flash, setFlash] = useState<{ n: 0 | 1 | 2; kind: Flash }>({ n: 0, kind: 'hit' });
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const fresh = (cues ?? []).filter((c) => c.id > seen.current);
    if (fresh.length === 0) return;
    seen.current = fresh[fresh.length - 1].id;

    const made = fresh.map(toFloat).filter((f): f is Float => f !== null);
    // Cues that land together (a multi-hit, damage plus a debuff) rise one after another, and
    // successive floats rotate through lanes so they do not cover each other.
    made.forEach((f, i) => {
      f.delay = i * 110;
      f.dx = LANES[lane.current++ % LANES.length];
    });
    if (made.length > 0) {
      setFloats((cur) => [...cur, ...made]);
      const keys = new Set(made.map((f) => f.key));
      const t = setTimeout(
        () => {
          timers.current.delete(t);
          setFloats((cur) => cur.filter((f) => !keys.has(f.key)));
        },
        made[made.length - 1].delay + FLOAT_MS + 50,
      );
      timers.current.add(t);
    }

    const kind = flashFor(fresh);
    if (kind) {
      setFlash((f) => ({ n: f.n === 1 ? 2 : 1, kind }));
      clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash((f) => ({ ...f, n: 0 })), FLASH_MS);
    }
  }, [cues]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      clearTimeout(flashTimer.current);
      pending.forEach(clearTimeout);
    };
  }, []);
  return { floats, flash };
}

export function Creature({
  name,
  icon,
  portrait,
  hp,
  maxHp,
  block,
  statuses,
  variant,
  intent,
  targetable,
  cues,
  motion,
  motionKey,
  aimed,
  onClick,
  onHover,
}: Props) {
  const { floats, flash } = useCues(cues);
  const dead = hp <= 0;
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // An attack's reach is measured before the first frame paints and handed to the keyframes
  // as --reach-x / --reach-y (the CSS defaults cover a failed measurement).
  useLayoutEffect(() => {
    const root = rootRef.current;
    const body = bodyRef.current;
    if (motion !== 'attack' || !root || !body) return;
    const reach = strikeReach(root, variant === 'player');
    if (!reach) return;
    body.style.setProperty('--reach-x', `${reach.x}px`);
    body.style.setProperty('--reach-y', `${reach.y}px`);
  }, [motion, motionKey, variant]);
  const classes = [
    styles.creature,
    styles[variant],
    targetable && !dead && styles.targetable,
    dead && styles.dead,
    motion && styles.acting,
  ]
    .filter(Boolean)
    .join(' ');
  const flashClass = flash.n === 0 ? '' : styles[`${flash.kind}${flash.n === 1 ? 'A' : 'B'}`];
  const motionClass =
    motion === 'attack'
      ? variant === 'player'
        ? styles.jab
        : styles.lunge
      : motion === 'cast'
        ? styles.hop
        : '';

  return (
    <div
      ref={rootRef}
      className={classes}
      data-combatant={variant === 'player' ? 'player' : 'enemy'}
      data-aimed={aimed ? 'true' : undefined}
      data-dead={dead ? 'true' : undefined}
      onClick={targetable && !dead ? onClick : undefined}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      {variant !== 'player' && (
        <div className={styles.intent}>{!dead && <IntentBadges intent={intent ?? null} />}</div>
      )}
      <div key={motionKey} ref={bodyRef} className={`${styles.body} ${motionClass}`}>
        <div
          className={`${styles.portrait} ${portrait ? styles.hasArt : ''} ${flashClass}`}
          data-portrait
          aria-hidden
        >
          {portrait ? (
            <img className={styles.art} src={portrait} alt="" draggable={false} />
          ) : dead ? (
            '✝️'
          ) : (
            icon
          )}
        </div>
      </div>
      <div className={styles.floats} aria-hidden>
        {floats.map((f) => (
          <div
            key={f.key}
            className={`${styles.float} ${styles[f.tone]}`}
            style={
              {
                animationDelay: `${f.delay}ms`,
                '--dx': `${f.dx}px`,
              } as CSSProperties
            }
          >
            <span className={styles.floatMain}>
              {f.icon && (
                <Icon src={f.icon} size={f.tone === 'buff' || f.tone === 'debuff' ? 16 : 24} />
              )}
              {f.text}
            </span>
            {f.sub && <span className={styles.floatSub}>{f.sub}</span>}
          </div>
        ))}
      </div>
      <div className={styles.name}>{name}</div>
      <HpBar hp={hp} maxHp={maxHp} block={block} />
      <StatusBadges statuses={statuses} />
    </div>
  );
}
