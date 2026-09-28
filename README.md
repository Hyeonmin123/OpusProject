# 끝없는 지하실 (The Endless Cellar)

A browser-based, turn-based roguelike deckbuilder in the style of _Slay the Spire_, set in a
dark-fantasy dungeon. You play the **Warrior (전사)**: pick a path down a branching map, fight
monsters with a deck of cards, collect cards and relics, and try to survive three acts and their
bosses.

> Status: **first playable scaffold.** A full run (Act 1 → Act 3 → victory/defeat summary) can be
> played start-to-finish. Art is placeholder (CSS + emoji). UI text is Korean.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script            | What it does                                               |
| ----------------- | ---------------------------------------------------------- |
| `npm run dev`     | Vite dev server with HMR                                   |
| `npm run build`   | Type-check (`tsc -b`) and build the static site to `dist/` |
| `npm run preview` | Serve the production build locally                         |
| `npm test`        | Engine unit tests + full-run bot simulation (Vitest)       |
| `npm run lint`    | Lint with oxlint                                           |
| `npm run format`  | Format with Prettier                                       |

The build output in `dist/` is a fully static site (relative asset paths, no backend), so it can be
dropped on GitHub Pages, Netlify, itch.io, or any static host.

## How to play

1. **Main menu**: start a new run (optionally with a numeric seed for a reproducible run), or
   continue a saved one. Progress is saved to `localStorage` automatically after every action, so
   refreshing the page never loses a run.
2. **Map**: start from any bottom node and climb toward the boss. Node types: ⚔️ combat,
   😈 elite (mid-boss, always drops a relic), ❓ event, 💰 shop, 🔥 rest site, 💀 boss.
3. **Combat**: you have **3 energy** and draw **5 cards** each turn. Click a card to play it. If it
   needs a target and there are several enemies, click an enemy (right-click or Esc cancels).
   Enemies show their **intent** (🗡️ attack for N, 🛡️ block, ⬆️ buff, 🌀 debuff) above their heads.
   Block expires at the start of your next turn. Shortcuts: `1`–`9` play the card in that slot,
   `E` ends the turn.
4. **Rewards**: gold, sometimes a relic, and a choice of 1 of 3 cards (or skip).
5. **Rest site**: heal 30% of max HP, or upgrade a card. **Shop**: buy cards or relics, or pay to
   remove a card. **Events**: text choices with trade-offs.
6. Beat the Act 3 boss to win. Dying ends the run and shows a summary.

## Architecture

```
src/
├── types/        Pure TypeScript data models (no logic)
│   ├── card.ts       CardDef, CardInstance, CardStats (+ upgrade overrides)
│   ├── effect.ts     Declarative Effect union shared by cards, enemy moves and relics
│   ├── status.ts     StatusId, StatusMap, StatusEffectDef (Vulnerable, Weak, Strength, …)
│   ├── enemy.ts      EnemyDef (move pool + AI function), EnemyState, EncounterDef
│   ├── relic.ts      RelicDef with declarative triggers
│   ├── map.ts        MapNode, ActMap
│   ├── combat.ts     CombatState (piles, energy, phase, log)
│   ├── event.ts      EventDef / EventOption / EventOutcome
│   └── run.ts        RunState: everything that is saved (player, map, current screen, …)
├── data/         Game content as plain data (easy to extend)
│   ├── cards.ts      Warrior card pool (21 cards + 2 status cards), starter deck
│   ├── enemies.ts    5 normal enemies, 2 elites, 3 bosses, with their AI
│   ├── acts.ts       Encounter pools and per-act scaling
│   ├── relics.ts     12 relics (starter / common / boss)
│   ├── events.ts     5 events
│   └── statuses.ts   Status effect names, icons and rules text
├── engine/       Game rules. Pure functions: (RunState, …args) => new RunState
│   ├── combat.ts     Turn loop, effect interpreter, damage/block, intents, win/lose
│   ├── run.ts        Run lifecycle: map travel, rewards, events, shop, rest, act transitions
│   ├── map.ts        Procedural branching map generator
│   ├── rewards.ts    Card/relic/gold rolls and shop stock
│   ├── cards.ts      Card stat lookup, upgrade handling, rules-text generation
│   ├── math.ts       Damage and block formulas
│   ├── statuses.ts   Status helpers (add, decay, list)
│   ├── rng.ts        Seeded PRNG (mulberry32) whose state is saved with the run
│   ├── context.ts    `transact()` helper that keeps public engine functions pure
│   └── *.test.ts     Vitest suites (see below)
├── store/
│   └── gameStore.ts  Zustand store: wraps engine actions + persists to localStorage
├── ui/
│   ├── components/   CardView, Creature, HpBar, status/intent badges, DeckModal, TopBar
│   └── screens/      MainMenu, Map, Combat, Reward, Event, Shop, Rest, Summary
└── styles/global.css Theme tokens (colors, fonts) and shared button/panel styles
```

### Key design decisions

- **Engine / UI split.** Every rule lives in `src/engine` as pure functions that take a `RunState`
  and return a new one (the input is never mutated; invalid actions return the same object).
  The Zustand store is just a thin wrapper, and the engine can be tested and simulated without a
  browser.
- **Content is data.** Cards, enemy moves and relics are made of a small declarative `Effect` union
  (`damage`, `block`, `applyStatus`, `draw`, `gainEnergy`, `addCard`, …) interpreted by one effect
  executor. To add a card you usually just add an entry to `data/cards.ts`, and its rules text is
  generated from its effects. Enemy AI is a small function per enemy that picks the next move id.
- **Deterministic runs.** All randomness goes through a seeded RNG whose state is stored in
  `RunState`, so the same seed and the same choices always give the same run, and a reload resumes
  exactly where you left off.
- **Status timing** follows Slay the Spire: duration debuffs (Vulnerable/Weak/Frail) tick down at
  the end of each round, and debuffs that enemies apply during their turn skip one tick so they
  actually affect your next turn.
- **Saves** are the whole `RunState`, stored as JSON under the `endless-cellar/save` localStorage
  key, together with small lifetime stats (runs, wins, best floor). `SAVE_VERSION` in
  `engine/run.ts` discards incompatible saves after breaking changes.
- **Theming.** All colors live as CSS custom properties in `styles/global.css`, and components use
  CSS Modules, so real art and a Figma palette can replace the placeholders screen by screen.

### Tests

`npm test` runs:

- `combat.test.ts`: damage and block math, Vulnerable/Weak timing, Ritual, energy checks, multi-target,
  powers, and win/lose detection.
- `map.test.ts`: graph validity for several seeds (reachability, no crossing edges, row rules).
- `run.test.ts`: act transition, final victory, rest, event, and shop flows.
- `simulation.test.ts`: a greedy bot plays 40 complete seeded runs through the public API,
  checking invariants after every action, verifying that no state gets stuck, and confirming that
  saves survive a JSON round-trip. (`SIM_DEBUG=1 npm test` prints where each run ended.)

## Current scope

**Implemented**

- One class (Warrior) with a 10-card starter deck (4 Strike, 4 Defend, Bash, Iron Wave) and the
  Burning Blood starter relic.
- 21 player cards (attacks, skills, powers) with upgrades, plus 2 status cards (Slimed, Wound).
- 8 status effects: Strength, Dexterity, Vulnerable, Weak, Frail, Ritual, Metallicize, Thorns.
- Act 1 content: 5 normal enemies, 2 elite encounters, and the boss _썩은 골렘 (Rotting Golem)_.
- A procedural branching map for each act, with combat, elite, event, shop, rest, and boss nodes.
- Rewards (gold, 1-of-3 cards, relics), shop (cards, relics, card removal), rest site (heal or
  upgrade), and 5 events.
- 3 acts, each ending in a boss, then a victory or defeat summary screen, then a new run.
- Save and resume through localStorage, with seeded runs.

**Intentionally stubbed / left for later**

- **Acts 2 and 3 content depth**: they reuse the Act 1 monster roster with more HP and starting
  Strength. Only their bosses (_뼈의 여왕_, _심연의 눈_) are unique.
- **Art, animation and sound**: placeholders are CSS shapes and emoji, with only minimal hit/intent
  animations. Real art will come from Figma.
- **Balance**: the numbers are a first pass. The greedy test bot beats the Act 1 boss about half the
  time.
- **Meta-progression and unlocks**: only lifetime counters are stored. There are no card unlocks,
  ascension levels or extra classes yet.
- **Other features**: potions, treasure rooms, card rarity visuals, a relic pool beyond 12, and
  settings (such as animation speed or language) are not implemented.
