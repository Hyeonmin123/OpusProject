import { STATUSES } from '../../data/statuses';
import { type IntentKind, type IntentView, listStatuses } from '../../engine';
import type { StatusMap } from '../../types';
import { ICONS, STATUS_ICONS } from '../art';
import styles from './Badges.module.css';
import { Icon } from './Icon';

export function StatusBadges({ statuses }: { statuses: StatusMap }) {
  const list = listStatuses(statuses);
  return (
    <div className={styles.row}>
      {list.map(({ id, amount }) => {
        const def = STATUSES[id];
        const kind = def.kind === 'debuff' || amount < 0 ? styles.debuff : styles.buff;
        return (
          <span
            key={id}
            className={`${styles.status} ${kind}`}
            title={`${def.name} ${amount}: ${def.describe(amount)}`}
          >
            <Icon src={STATUS_ICONS[id]} size={16} />
            {amount}
          </span>
        );
      })}
    </div>
  );
}

/** Icon per intent kind. */
const INTENT_ART: Record<IntentKind, string> = {
  attack: ICONS.attack,
  defend: ICONS.block,
  buff: ICONS.intentBuff,
  debuff: ICONS.intentDebuff,
  special: ICONS.special,
  hidden: ICONS.hidden,
};

function IntentIcon({ kind }: { kind: IntentKind }) {
  return <Icon src={INTENT_ART[kind]} size={20} />;
}

const INTENT_HINT: Record<IntentKind, string> = {
  attack: '공격 예정',
  defend: '방어 예정',
  buff: '강화 예정',
  debuff: '약화 부여 예정',
  special: '특수 행동',
  hidden: '어둠에 가려 무엇을 할지 알 수 없습니다',
};

export function IntentBadges({ intent }: { intent: IntentView | null }) {
  if (!intent) return null;
  if (intent.hidden) {
    return (
      <span
        className={`${styles.intent} ${styles['intent-hidden']}`}
        title={`${INTENT_HINT.hidden} (심지를 돋우거나 '어둠 응시'로 드러낼 수 있습니다)`}
        data-testid="intent-hidden"
      >
        <IntentIcon kind="hidden" />
        ???
      </span>
    );
  }
  return (
    <>
      {intent.parts.map((part, i) => (
        <span
          key={i}
          className={`${styles.intent} ${styles[`intent-${part.kind}`]}`}
          title={`${intent.moveName} — ${INTENT_HINT[part.kind]}`}
        >
          <IntentIcon kind={part.kind} />
          {part.label}
        </span>
      ))}
    </>
  );
}
