import { useEffect } from 'react';
import { useGame } from './store/gameStore';
import type { RunState } from './types';
import { type SceneId, combatScene } from './ui/art';
import { Backdrop } from './ui/components/Backdrop';
import { TopBar } from './ui/components/TopBar';
import { CombatScreen } from './ui/screens/CombatScreen';
import { EventScreen } from './ui/screens/EventScreen';
import { MainMenu } from './ui/screens/MainMenu';
import { MapScreen } from './ui/screens/MapScreen';
import { RestScreen } from './ui/screens/RestScreen';
import { RewardScreen } from './ui/screens/RewardScreen';
import { ShopScreen } from './ui/screens/ShopScreen';
import { SummaryScreen } from './ui/screens/SummaryScreen';

function ScreenFor({ run }: { run: RunState }) {
  switch (run.screen) {
    case 'map':
      return <MapScreen run={run} />;
    case 'combat':
      return run.combat ? <CombatScreen run={run} /> : null;
    case 'reward':
      return run.reward ? <RewardScreen run={run} /> : null;
    case 'event':
      return run.event ? <EventScreen run={run} /> : null;
    case 'shop':
      return run.shop ? <ShopScreen run={run} /> : null;
    case 'rest':
      return run.rest ? <RestScreen run={run} /> : null;
    case 'summary':
      return <SummaryScreen run={run} />;
  }
}

/** Which scene art sits behind each screen. */
function sceneFor(run: RunState): SceneId {
  switch (run.screen) {
    case 'combat':
      return combatScene(run.act);
    case 'shop':
      return 'shop';
    case 'rest':
      return 'rest';
    case 'event':
      return 'event';
    default:
      return 'wall';
  }
}

export default function App() {
  const run = useGame((s) => s.run);
  const view = useGame((s) => s.view);
  const goToMenu = useGame((s) => s.goToMenu);

  // If the saved run disappears (e.g. storage cleared), fall back to the menu.
  useEffect(() => {
    if (view === 'game' && !run) goToMenu();
  }, [view, run, goToMenu]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [run?.screen]);

  if (view === 'menu' || !run)
    return (
      <>
        <Backdrop scene="menu" />
        <MainMenu />
      </>
    );

  return (
    <>
      <Backdrop scene={sceneFor(run)} />
      <TopBar run={run} />
      <main>
        <ScreenFor run={run} />
      </main>
    </>
  );
}
