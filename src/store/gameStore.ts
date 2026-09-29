import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as engine from '../engine';
import type { RunState } from '../types';

/** Lightweight meta-progression / lifetime stats kept across runs. */
export interface MetaStats {
  runsStarted: number;
  victories: number;
  bestFloor: number;
}

type View = 'menu' | 'game';

export interface Replay {
  frames: engine.EnemyTurnFrame[];
  /** Beat index: 0 = the player's turn ending, then a wind-up and an impact per enemy action. */
  beat: number;
}

interface GameStore {
  run: RunState | null;
  meta: MetaStats;
  /** Not persisted: the app always opens on the main menu. */
  view: View;
  /**
   * Not persisted: the enemy turn being replayed on the combat screen (see `ui/replay.ts`).
   * `run` already holds the result; this only drives what is shown meanwhile.
   */
  replay: Replay | null;
  /** Moves the replay on one beat, clearing it after the last. */
  advanceReplay: () => void;

  newRun: (seed?: number) => void;
  continueRun: () => void;
  goToMenu: () => void;
  /** Clears a finished run and records it in meta stats. */
  closeRun: () => void;
  abandonRun: () => void;

  selectNode: (nodeId: string) => void;

  playCard: (cardUid: string, targetIndex?: number) => void;
  /**
   * Ends the turn. The run jumps straight to the next player turn (that is what is saved),
   * and `replay` gets the frames the combat screen plays the enemy turn back from.
   */
  endTurn: () => void;
  /** Spend candle wax to reveal intents hidden by darkness. */
  revealIntents: () => void;
  finishCombat: () => void;

  claimRewardGold: () => void;
  claimRewardRelic: () => void;
  pickRewardCard: (index: number) => void;
  skipRewardCard: () => void;
  leaveReward: () => void;

  chooseEventOption: (index: number) => void;
  resolveEventPick: (cardUid: string) => void;
  leaveEvent: () => void;

  buyShopCard: (index: number) => void;
  buyShopRelic: (index: number) => void;
  shopRemoveCard: (cardUid: string) => void;
  buyShopCandle: () => void;
  leaveShop: () => void;

  restHeal: () => void;
  restRekindle: () => void;
  restUpgrade: (cardUid: string) => void;
  leaveRest: () => void;
}

const SAVE_KEY = 'endless-cellar/save';

export const useGame = create<GameStore>()(
  persist(
    (set, get) => {
      /** Wraps a pure engine action so it applies to the current run. */
      const act =
        <A extends unknown[]>(fn: (run: RunState, ...args: A) => RunState) =>
        (...args: A) => {
          const run = get().run;
          if (!run) return;
          const next = fn(run, ...args);
          // Any other action also ends an enemy-turn replay that might still be showing.
          if (next !== run) set({ run: next, replay: null });
        };

      return {
        run: null,
        meta: { runsStarted: 0, victories: 0, bestFloor: 0 },
        view: 'menu',
        replay: null,

        newRun: (seed) =>
          set((s) => ({
            run: engine.createRun(seed),
            view: 'game',
            replay: null,
            meta: { ...s.meta, runsStarted: s.meta.runsStarted + 1 },
          })),
        continueRun: () => {
          if (get().run) set({ view: 'game' });
        },
        goToMenu: () => set({ view: 'menu' }),
        closeRun: () =>
          set((s) => {
            const run = s.run;
            if (!run) return { view: 'menu' };
            return {
              run: null,
              view: 'menu',
              meta: {
                ...s.meta,
                victories: s.meta.victories + (run.result === 'victory' ? 1 : 0),
                bestFloor: Math.max(s.meta.bestFloor, run.floor),
              },
            };
          }),
        abandonRun: act(engine.abandonRun),

        selectNode: act(engine.selectNode),

        playCard: act(engine.playCard),
        endTurn: () => {
          const run = get().run;
          if (!run) return;
          const { run: next, frames } = engine.endTurnWithFrames(run);
          if (next !== run)
            set({ run: next, replay: frames.length > 0 ? { frames, beat: 0 } : null });
        },
        advanceReplay: () =>
          set((s) => {
            if (!s.replay) return {};
            const last = 2 * (s.replay.frames.length - 1);
            return {
              replay: s.replay.beat >= last ? null : { ...s.replay, beat: s.replay.beat + 1 },
            };
          }),
        revealIntents: act(engine.revealIntents),
        finishCombat: act(engine.finishCombat),

        claimRewardGold: act(engine.claimRewardGold),
        claimRewardRelic: act(engine.claimRewardRelic),
        pickRewardCard: act(engine.pickRewardCard),
        skipRewardCard: act(engine.skipRewardCard),
        leaveReward: act(engine.leaveReward),

        chooseEventOption: act(engine.chooseEventOption),
        resolveEventPick: act(engine.resolveEventPick),
        leaveEvent: act(engine.leaveEvent),

        buyShopCard: act(engine.buyShopCard),
        buyShopRelic: act(engine.buyShopRelic),
        shopRemoveCard: act(engine.shopRemoveCard),
        buyShopCandle: act(engine.buyShopCandle),
        leaveShop: act(engine.leaveShop),

        restHeal: act(engine.restHeal),
        restRekindle: act(engine.restRekindle),
        restUpgrade: act(engine.restUpgrade),
        leaveRest: act(engine.leaveRest),
      };
    },
    {
      name: SAVE_KEY,
      version: engine.SAVE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ run: s.run, meta: s.meta }),
      // Incompatible save format: keep meta stats, drop the in-progress run.
      migrate: (persisted) => {
        const old = (persisted ?? {}) as { meta?: MetaStats };
        return { run: null, meta: old.meta ?? { runsStarted: 0, victories: 0, bestFloor: 0 } };
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Pick<GameStore, 'run' | 'meta'>>;
        const run = p.run && p.run.version === engine.SAVE_VERSION ? p.run : null;
        return { ...current, run, meta: p.meta ?? current.meta };
      },
    },
  ),
);
