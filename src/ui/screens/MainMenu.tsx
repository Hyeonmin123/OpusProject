import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import styles from './MainMenu.module.css';

export function MainMenu() {
  const run = useGame((s) => s.run);
  const meta = useGame((s) => s.meta);
  const newRun = useGame((s) => s.newRun);
  const continueRun = useGame((s) => s.continueRun);
  const [showSeed, setShowSeed] = useState(false);
  const [seedText, setSeedText] = useState('');

  const inProgress = run && !run.result;

  const start = (seed?: number) => {
    if (inProgress && !window.confirm('진행 중인 탐험이 사라집니다. 새로 시작하시겠습니까?'))
      return;
    newRun(seed);
  };

  const startWithSeed = () => {
    const n = Number.parseInt(seedText, 10);
    start(Number.isFinite(n) ? n >>> 0 : undefined);
  };

  return (
    <div className={styles.screen}>
      <div className={`${styles.box} fade-in`}>
        <div className={styles.sigil} aria-hidden>
          🕯️
        </div>
        <h1 className={styles.title}>끝없는 지하실</h1>
        <div className={styles.subtitle}>The Endless Cellar — 덱빌딩 로그라이크</div>

        <div className={styles.buttons}>
          {run && (
            <button className="btn btn-primary btn-large" onClick={continueRun}>
              {inProgress ? '이어하기' : '결과 보기'}
            </button>
          )}
          <button className={`btn btn-large ${run ? '' : 'btn-primary'}`} onClick={() => start()}>
            새 탐험
          </button>
        </div>
        {inProgress && (
          <div className={styles.runInfo}>
            진행 중: {run.act}막 {run.floor}층 · 체력 {run.player.hp}/{run.player.maxHp} · 촛농{' '}
            {run.player.candle}/{run.player.maxCandle}
          </div>
        )}

        {showSeed ? (
          <div className={styles.seedRow}>
            <input
              inputMode="numeric"
              placeholder="시드 (숫자)"
              value={seedText}
              onChange={(e) => setSeedText(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && startWithSeed()}
            />
            <button className="btn" onClick={startWithSeed} disabled={!seedText}>
              시작
            </button>
          </div>
        ) : (
          <button className={styles.linkish} onClick={() => setShowSeed(true)}>
            시드를 지정해 시작
          </button>
        )}

        <div className={styles.meta}>
          탐험 {meta.runsStarted}회 · 승리 {meta.victories}회 · 최고 {meta.bestFloor}층
        </div>
      </div>
    </div>
  );
}
