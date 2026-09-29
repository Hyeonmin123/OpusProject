import { useEffect, useRef, useState } from 'react';
import { ENEMIES } from '../../data/enemies';
import {
  BLACKOUT_DAMAGE,
  BLACKOUT_ENEMY_DAMAGE_BONUS,
  REVEAL_WAX_COST,
  canPlayCard,
  canRevealIntents,
  candleDrainPerTurn,
  cardNeedsTarget,
  describeIntent,
  energyPerTurn,
  getCardDef,
  lightLevel,
  type DescribeView,
} from '../../engine';
import { useGame } from '../../store/gameStore';
import type { CardInstance, CombatFx, RunState } from '../../types';
import { ICONS, PORTRAITS } from '../art';
import { CandleGauge } from '../components/CandleGauge';
import { CardView } from '../components/CardView';
import { Creature } from '../components/Creature';
import { DeckModal } from '../components/DeckModal';
import { Icon } from '../components/Icon';
import { replayView } from '../replay';
import styles from './CombatScreen.module.css';

type PileView = 'draw' | 'discard' | 'exhaust' | null;

const NO_CUES: CombatFx[] = [];

export function CombatScreen({ run: live }: { run: RunState }) {
  const playCard = useGame((s) => s.playCard);
  const endTurn = useGame((s) => s.endTurn);
  const finishCombat = useGame((s) => s.finishCombat);
  const revealIntents = useGame((s) => s.revealIntents);
  const replay = useGame((s) => s.replay);
  const advanceReplay = useGame((s) => s.advanceReplay);
  // While the enemy turn plays back, draw its snapshots; `live` already holds the result.
  const beat = replay ? replayView(replay) : null;
  const run = beat?.run.combat ? beat.run : live;
  const combat = run.combat!;
  const light = lightLevel(run.player);
  const anyHidden = combat.enemies.some((e) => e.hp > 0 && e.intentHidden);
  const revealCheck = canRevealIntents(run);

  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [hoverEnemy, setHoverEnemy] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pileView, setPileView] = useState<PileView>(null);
  const [jab, setJab] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  const living = combat.enemies.map((e, i) => ({ e, i })).filter(({ e }) => e.hp > 0);
  const playerTurn = !beat && combat.phase === 'player';
  const cues = combat.fx ?? NO_CUES;
  // Derived so a stale selection (card left hand / fight ended) is simply ignored.
  const selected = (playerTurn && combat.hand.find((c) => c.uid === selectedUid)) || null;

  function handleEndTurn() {
    setSelectedUid(null);
    endTurn();
  }

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 1600);
    return () => clearTimeout(t);
  }, [message]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [combat.logCounter]);

  // Step the enemy-turn playback one beat at a time.
  const beatMs = beat?.ms;
  useEffect(() => {
    if (beatMs === undefined) return;
    const t = setTimeout(advanceReplay, beatMs);
    return () => clearTimeout(t);
  }, [replay, beatMs, advanceReplay]);

  function play(card: CardInstance, target?: number) {
    if (getCardDef(card.defId).type === 'attack') setJab((n) => n + 1);
    playCard(card.uid, target);
  }

  function onCardClick(card: CardInstance) {
    if (!playerTurn) return;
    const check = canPlayCard(run, card);
    if (!check.ok) {
      setMessage(check.reason ?? '사용할 수 없습니다.');
      return;
    }
    // A targeted card is only armed by the first click, even when there is a single enemy:
    // the play resolves on a second, deliberate action (clicking the enemy, or Enter when
    // there is only one target), so looking at a card never spends it by accident. Clicking
    // the armed card again disarms it.
    if (cardNeedsTarget(card)) {
      setSelectedUid(selected?.uid === card.uid ? null : card.uid);
      return;
    }
    setSelectedUid(null);
    play(card);
  }

  function onEnemyClick(index: number) {
    if (!selected) return;
    play(selected, index);
    setSelectedUid(null);
  }

  // Keyboard: E = end turn, Esc = cancel targeting, 1-9 = pick card, Enter = play the armed
  // card on the only enemy.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (pileView || e.target instanceof HTMLInputElement) return;
      if (e.key === 'Escape') setSelectedUid(null);
      else if (e.key === 'Enter' && selected && living.length === 1) {
        // Capture phase + stopPropagation: the focused card would otherwise take the Enter as
        // a click and disarm itself.
        e.preventDefault();
        e.stopPropagation();
        onEnemyClick(living[0].i);
      } else if ((e.key === 'e' || e.key === 'E') && playerTurn) handleEndTurn();
      else if ((e.key === 'r' || e.key === 'R') && playerTurn && revealCheck.ok) revealIntents();
      else if (/^[1-9]$/.test(e.key)) {
        const card = combat.hand[Number(e.key) - 1];
        if (card) onCardClick(card);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const targetForText =
    hoverEnemy !== null && combat.enemies[hoverEnemy]?.hp > 0
      ? combat.enemies[hoverEnemy]
      : living.length === 1
        ? living[0].e
        : undefined;
  const view: DescribeView = {
    playerStatuses: combat.player.statuses,
    playerBlock: combat.player.block,
    targetStatuses: targetForText?.statuses,
  };

  const pileCards: Record<Exclude<PileView, null>, { title: string; cards: CardInstance[] }> = {
    // Draw pile is shown sorted so its order is not revealed.
    draw: { title: '뽑을 카드 더미', cards: combat.drawPile },
    discard: { title: '버린 카드 더미', cards: combat.discardPile },
    exhaust: { title: '소멸된 카드', cards: combat.exhaustPile },
  };

  return (
    <div
      className={`${styles.screen} ${styles[`light-${light}`]}`}
      data-light={light}
      onContextMenu={(e) => {
        if (selected) {
          e.preventDefault();
          setSelectedUid(null);
        }
      }}
    >
      <section className={styles.field}>
        {playerTurn && (
          <div key={combat.turn} className={styles.turnFlash} aria-hidden>
            <span>{combat.turn}턴</span>
          </div>
        )}
        {light === 'dark' && playerTurn && (
          <div className={styles.blackoutBanner} data-testid="blackout-banner">
            <Icon src={ICONS.blackout} size={16} /> 암전 — 턴마다 체력 {BLACKOUT_DAMAGE} 잃음 · 적
            공격 피해 +{BLACKOUT_ENEMY_DAMAGE_BONUS}%
          </div>
        )}
        <div className={styles.playerSide}>
          <Creature
            name={run.player.className}
            icon="🛡️"
            portrait={PORTRAITS.warrior}
            hp={run.player.hp}
            maxHp={run.player.maxHp}
            block={combat.player.block}
            statuses={combat.player.statuses}
            variant="player"
            cues={cuesFor(cues, 'player')}
            motion={jab > 0 ? 'attack' : null}
            motionKey={jab}
          />
          <div className={styles.candlePanel}>
            <CandleGauge
              candle={run.player.candle}
              maxCandle={run.player.maxCandle}
              drain={candleDrainPerTurn(run)}
            />
            {anyHidden && (
              <button
                className={`btn ${styles.revealBtn}`}
                onClick={revealIntents}
                disabled={!playerTurn || !revealCheck.ok}
                title={
                  revealCheck.ok
                    ? `촛농 ${REVEAL_WAX_COST}을 태워 가려진 적의 의도를 모두 드러냅니다 (단축키: R)`
                    : revealCheck.reason
                }
                data-testid="reveal-intents"
              >
                <Icon src={ICONS.reveal} size={16} /> 심지 돋우기{' '}
                <span className={styles.revealCost}>촛농 -{REVEAL_WAX_COST}</span>
              </button>
            )}
          </div>
        </div>
        <div className={styles.enemies}>
          {combat.enemies.map((enemy, i) => (
            <Creature
              key={enemy.uid}
              name={enemy.name}
              icon={ENEMIES[enemy.defId]?.icon ?? '👹'}
              portrait={PORTRAITS[enemy.defId]}
              hp={enemy.hp}
              maxHp={enemy.maxHp}
              block={enemy.block}
              statuses={enemy.statuses}
              variant={combat.tier === 'normal' ? 'normal' : combat.tier}
              intent={describeIntent(run, i)}
              targetable={!!selected}
              cues={cuesFor(cues, i)}
              motion={beat?.actor === i ? beat.motion : null}
              onClick={() => onEnemyClick(i)}
              onHover={(h) => setHoverEnemy(h ? i : null)}
            />
          ))}
        </div>
      </section>

      <aside className={`${styles.log} panel`}>
        <h3>전투 기록</h3>
        <div className={styles.logList} ref={logRef}>
          {combat.log.map((entry) => (
            <div key={entry.id} className={styles[`log${entry.side}`]}>
              {entry.text}
            </div>
          ))}
        </div>
      </aside>

      <section className={styles.handArea}>
        {(message || selected) && (
          <div className={styles.hintBar}>
            {message ??
              (living.length === 1
                ? '적을 클릭해 사용하세요 (Enter: 사용 · 우클릭/Esc: 취소)'
                : '대상을 선택하세요 (우클릭/Esc: 취소)')}
          </div>
        )}
        <div className={styles.leftCluster}>
          <div
            className={`${styles.energy} ${combat.energy === 0 ? styles.energyEmpty : ''}`}
            title="에너지"
          >
            <Icon src={ICONS.energy} size={22} className={styles.energyIcon} />
            <span>
              {combat.energy}/{energyPerTurn(run)}
            </span>
          </div>
          <button className={`btn ${styles.pile}`} onClick={() => setPileView('draw')}>
            뽑기 {combat.drawPile.length}
          </button>
        </div>

        <div className={styles.hand}>
          {combat.hand.map((card) => {
            const playable = playerTurn && canPlayCard(run, card).ok;
            return (
              <CardView
                key={card.uid}
                card={card}
                energy={combat.energy}
                view={view}
                selected={card.uid === selected?.uid}
                disabled={!playable}
                onClick={() => onCardClick(card)}
              />
            );
          })}
        </div>

        <div className={styles.rightCluster}>
          <button
            className={`btn btn-primary ${styles.endTurn}`}
            onClick={handleEndTurn}
            disabled={!playerTurn}
            title="단축키: E"
          >
            턴 종료
          </button>
          <button className={`btn ${styles.pile}`} onClick={() => setPileView('discard')}>
            버림 {combat.discardPile.length}
          </button>
          {combat.exhaustPile.length > 0 && (
            <button className={`btn ${styles.pile}`} onClick={() => setPileView('exhaust')}>
              소멸 {combat.exhaustPile.length}
            </button>
          )}
        </div>
      </section>

      {pileView && (
        <DeckModal
          title={pileCards[pileView].title}
          subtitle={`${pileCards[pileView].cards.length}장`}
          cards={pileCards[pileView].cards}
          keepOrder={pileView !== 'draw'}
          onClose={() => setPileView(null)}
        />
      )}

      {!beat && combat.phase !== 'player' && (
        <div className={styles.overlay}>
          <div className={`${styles.banner} panel`}>
            {combat.phase === 'won' ? (
              <>
                <div className={styles.bannerIcon}>
                  <Icon src={ICONS.reward} size={64} />
                </div>
                <h2 className={styles.victory}>승리</h2>
                <div className={styles.bannerText}>
                  {combat.tier === 'boss'
                    ? '지하실의 주인이 쓰러졌다.'
                    : combat.tier === 'elite'
                      ? '강력한 적을 물리쳤다.'
                      : '적을 모두 물리쳤다.'}
                </div>
                <button className="btn btn-primary btn-large" onClick={finishCombat}>
                  보상 확인
                </button>
              </>
            ) : (
              <>
                <div className={styles.bannerIcon}>
                  <Icon src={ICONS.defeat} size={64} />
                </div>
                <h2 className={styles.defeat}>쓰러졌다</h2>
                <div className={styles.bannerText}>지하실의 어둠이 당신을 삼켰다…</div>
                <button className="btn btn-large" onClick={finishCombat}>
                  결과 보기
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** The cues for one combatant, memoised per source list so unchanged props stay equal. */
const cueCache = new WeakMap<CombatFx[], Map<'player' | number, CombatFx[]>>();
function cuesFor(all: CombatFx[], who: 'player' | number): CombatFx[] {
  let byWho = cueCache.get(all);
  if (!byWho) cueCache.set(all, (byWho = new Map()));
  let list = byWho.get(who);
  if (!list) byWho.set(who, (list = all.filter((c) => c.who === who)));
  return list;
}
