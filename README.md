# 끝없는 지하실 (The Endless Cellar)

A browser-based, turn-based roguelike deckbuilder in the style of _Slay the Spire_, set in a
dark-fantasy dungeon. You play the **Warrior (전사)**: pick a path down a branching map, fight
monsters with a deck of cards, collect cards and relics, and try to survive three acts and their
bosses.

What sets it apart from a straight _Slay the Spire_ clone is the **candle (촛불)**: a second
resource, next to energy, that burns down every combat turn and lasts for the whole run. Let it
run low and the dark hides what the enemies are about to do. Let it go out and you fight in
**blackout (암전)**. Cards split into **light** cards that feed the candle and **shadow** cards
that hit harder but burn it (see [The candle system](#the-candle-촛불-system)).

> Status: **first playable scaffold.** A full run (Act 1 → Act 3 → victory/defeat summary) can be
> played start-to-finish. Portraits, key art, gameplay and status icons, scene backgrounds, the
> stone-and-gilt UI chrome and the card frame ornaments are palette-locked pixel art (see
> [Art pipeline](#art-pipeline)), and all text is set in the Galmuri pixel font
> ([Typography](#typography)). Some relic and node glyphs are still emoji. UI text is Korean.

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
   `E` ends the turn, `R` raises the wick (reveals hidden intents).
   The **candle gauge** under your character burns 1 wax per turn. When it runs low, some intents
   show as `???`. Pay 3 wax with **🔍 심지 돋우기** (raise the wick) to reveal them.
4. **Rewards**: gold, sometimes a relic, and a choice of 1 of 3 cards (or skip).
5. **Rest site**: heal 30% of max HP, **rekindle the candle** (+50% of max wax), or upgrade a
   card. **Shop**: buy cards or relics, a **candle** (+20 wax, once per visit), or pay to remove a
   card. **Events**: text choices with trade-offs (some restore or spend wax).
6. Beat the Act 3 boss to win. Dying ends the run and shows a summary.

## Architecture

```
src/
├── types/        Pure TypeScript data models (no logic)
│   ├── card.ts       CardDef, CardInstance, CardStats (+ upgrade overrides, resonance, wax)
│   ├── effect.ts     Declarative Effect union shared by cards, enemy moves and relics
│   ├── status.ts     StatusId, StatusMap, StatusEffectDef (Vulnerable, Weak, Strength, …)
│   ├── enemy.ts      EnemyDef (move pool + AI function), EnemyState, EncounterDef
│   ├── relic.ts      RelicDef with declarative triggers
│   ├── map.ts        MapNode, ActMap
│   ├── combat.ts     CombatState (piles, energy, phase, log)
│   ├── event.ts      EventDef / EventOption / EventOutcome
│   └── run.ts        RunState: everything that is saved (player incl. candle, map, screen, …)
├── data/         Game content as plain data (easy to extend)
│   ├── cards.ts      Warrior card pool (21 neutral + 6 light + 6 shadow + 2 status), starter deck
│   ├── enemies.ts    5 normal enemies, 2 elites, 3 bosses, with their AI
│   ├── acts.ts       Encounter pools and per-act scaling
│   ├── relics.ts     16 relics (starter / common / boss), 4 of them candle-related
│   ├── events.ts     6 events
│   └── statuses.ts   Status effect names, icons and rules text
├── engine/       Game rules. Pure functions: (RunState, …args) => new RunState
│   ├── combat.ts     Turn loop, effect interpreter, damage/block, intents, darkness, win/lose
│   ├── candle.ts     Candle tuning constants and light-level helpers
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
│   ├── components/   CardView, Creature, HpBar, CandleGauge, status/intent badges, DeckModal, TopBar
│   └── screens/      MainMenu, Map, Combat, Reward, Event, Shop, Rest, Summary
└── styles/global.css Theme tokens (colors, fonts) and shared button/panel styles
```

## The candle (촛불) system

The candle is the game's core twist. It ties into the theme: you are descending a cellar with only
a candle for light.

**A second resource that lasts the whole run.** `player.candle` (0–60 wax) lives on the persistent
`PlayerState`, not in combat, so it carries from fight to fight and is saved with the run.
Managing it across the whole run matters, not only within one fight.

| Rule                         | Value                                                                  |
| ---------------------------- | ---------------------------------------------------------------------- |
| Starting / max wax           | 60                                                                     |
| Passive burn                 | 1 wax at the start of every combat turn (the _Black Candle_ relic: +1) |
| Dim light (어스름)           | below 30% (under 18 wax): each intent hidden at 50%, at least one      |
| Blackout (암전)              | 0 wax: lose 3 HP each turn, enemy attacks +25%, every intent hidden    |
| Raise the wick (심지 돋우기) | in-combat action: pay 3 wax to reveal all hidden intents this turn     |
| Rest site: rekindle          | +50% of max wax (costs the rest-site action instead of heal/upgrade)   |
| Shop candle                  | +20 wax for 35 gold (+5 per act), once per shop                        |
| Next act                     | restores 50% of the _missing_ wax                                      |

- **Blackout is pressure, not a second death trigger.** You still only die at 0 HP. But the HP
  drain, the harder enemy hits and full blindness snowball quickly, so letting the candle go out is
  a downward spiral. Any wax restored mid-fight (for example from a light card) ends it at once.
- **Hidden intents hide real information.** The engine still picks and executes each enemy's move.
  `EnemyState.intentHidden` only affects `describeIntent()`, the single player-facing view of
  intents. A hidden one returns `???` with no move name, damage or effects, so neither the UI nor
  the test bot can see through the dark. Intents are re-rolled for darkness at the start of every
  turn. Any change that makes the light bright again reveals everything immediately.
- **Paying for information.** Reveal intents with the _raise the wick_ action (3 wax), the shadow
  card _어둠 응시_ (Gaze into the Dark), or the _올빼미의 눈_ (Owl's Eye) relic on turn 1.
- **Enemies fight the light.** Cave bats' screech burns 1 wax, the Bone Queen's curse 3, and the
  Abyssal Eye's gaze 4. These show up in their intents as `촛농 -N`.

**Light / shadow cards.** `CardDef.resonance` is `'light' | 'shadow'` (omitted = neutral: every
original card). `CardStats.candle` is a wax change paid on play, before the effects, like energy.
Light cards restore wax and are slightly weaker per energy than neutral cards. Shadow cards are
clearly stronger but burn wax. If there isn't enough wax, the shortfall is paid in HP. Cards show
a gold (light) or violet (shadow) frame and a `🕯️±N` wax pill.

| Card                   | Type   | Resonance | Cost | Wax | Effect (upgrade)                           |
| ---------------------- | ------ | --------- | ---- | --- | ------------------------------------------ |
| 불씨 베기 Ember Strike | Attack | light     | 1    | +1  | 6 damage (9, +2 wax)                       |
| 수호의 불꽃 Warding    | Skill  | light     | 1    | +2  | 6 block (9)                                |
| 심지 다듬기 Tend Wick  | Skill  | light     | 0    | +4  | Draw 1. Exhaust (+6 wax)                   |
| 광휘의 일격 Radiant    | Attack | light     | 2    | +2  | 11 damage, Weak 2 (14, +3 wax)             |
| 성역의 등불 Sanctuary  | Power  | light     | 1    | +1  | Kindle 1: restore 1 wax each turn (cost 0) |
| 새벽의 서약 Dawn Vow   | Skill  | light     | 1    | +8  | 10 block. Exhaust (14 block, +10 wax)      |
| 그림자 베기 Shadow     | Attack | shadow    | 1    | −2  | 10 damage (14)                             |
| 어스름 장막 Dusk Veil  | Skill  | shadow    | 1    | −2  | 10 block (13)                              |
| 어둠 응시 Gaze         | Skill  | shadow    | 0    | −2  | Reveal all hidden intents, draw 1 (draw 2) |
| 밤의 추적자 Stalker    | Attack | shadow    | 1    | −2  | 7 damage; in the dark, 7 more (9 + 9)      |
| 삼키는 어둠 Devouring  | Attack | shadow    | 2    | −4  | 14 damage to all enemies (19)              |
| 그늘의 형상 Umbral     | Power  | shadow    | 1    | −5  | +3 Strength (4)                            |

"In the dark" (`ifDark` effect) means below the dim threshold. A shadow card's own wax cost can
tip you into the dark and trigger its bonus.

**Candle relics and events.** _밀랍 봉인_ (Wax Seal, +3 wax per won fight), _은촛대_ (Silver
Candlestick, +15 max wax), _올빼미의 눈_ (Owl's Eye, turn-1 intents always visible), and the boss
relic _검은 양초_ (Black Candle, +1 energy per turn but the candle burns twice as fast). The new
event _양초장이의 작업실_ (Chandler's Workshop) trades wax for HP or a shadow card. The forge
event can rekindle the candle.

**Tuning.** The numbers were tuned with the bot simulation. The bot spends about 40 turns per act.
A candle that is never refilled lasts until about late Act 2, so a run needs to refill it 2–4
times. The pacing test in `simulation.test.ts` pits a candle-aware bot against one that ignores
the candle:

- The aware bot spends about 91% of its turns in bright light, 7% dim, and 2% in blackout.
- It still sees dim light in about half of its runs.
- The careless bot dies in blackout about three times as often (14 vs. 4 of 40 runs).

The test asserts bands around these numbers, so later balance changes that make the candle
irrelevant or impossible to sustain fail CI.

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
  CSS Modules. All art is registered in `ui/art.ts`: icons, portraits, key art and the full-bleed
  scene backgrounds (`SCENES`, drawn by `components/Backdrop` behind each screen). The shared
  chrome (`.panel` stone slabs with a gilt 9-slice frame, `.btn` plaques, the room-panel crest)
  lives in `global.css` and uses the pixel-art `assets/ui/*.png`.

### Art pipeline

The pixel art starts as Gemini image exports, kept unprocessed in `art-src/gemini/`.
`python3 scripts/pixelart/process.py [name ...]` (Pillow + numpy) rebuilds the PNGs in
`src/assets/` from them:

1. repaints Gemini's sparkle watermark from the surrounding pixels,
2. for sprites, removes the checkerboard "transparency" baked into the exports and crops to the
   subject,
3. applies the per-asset fixes (recolours, and the hand-built redraws in
   `scripts/pixelart/redraw.py`),
4. reduces to a real pixel grid (per-cell palette mode that keeps 1px outlines), and
5. snaps every pixel to the locked 24-colour palette in `scripts/pixelart/pxlib.py` (the slime gets
   two extra sage steps; scenes also use midpoints between neighbouring palette steps so
   stonework keeps its texture), then exports the grid upscaled 4× with nearest-neighbour.

Grids are chosen so pixels land on whole CSS pixels: portraits 52px and boss portraits 66px (2× in
their frames), icons and status icons 32px, scenes 256×144. The UI draws them with
`image-rendering: pixelated` wherever they are shown larger than their grid.

The UI chrome has no source image: `python3 scripts/pixelart/chrome.py` draws it directly on its
final grid, in the same locked palette (the primary button's bronze is one of the scene
palette's midpoints), and exports it at 2×, so it is shown 1:1:

- 9-slice `border-image` frames: the `.panel` stone slab with chamfered corners and gilt corner
  caps (`ui/panel-frame.png`), a compact slab for small panels and banners (`ui/panel-small.png`,
  the global `.panel-sm` class), the targeting reticle, the button plaques (default, hover,
  pressed; primary, danger and the violet reveal button) and the HP / candle gauge troughs.
- Sprites: the room-panel crest, the block shield, relic sockets, the energy orb, cost gem and
  candle-flame medallions, the top bar's gilt edge tile and the large buttons' diamonds.
- Card corner ornaments (`art/frame-{light,shadow}[-small].png`): full overlays of the card's
  inner box at both card sizes, gilt brackets and sparkles for light cards, a violet thorn vine
  for shadow cards.

Soft CSS effects around the chrome follow the same rule: shadows and glows are hard 2–6px
offsets or rings, gauge fills are flat bands with 2px notches, and hover and pressed states
move whole pixels (cards lift without scaling).

### Typography

All text is set in [Galmuri](https://github.com/quiple/galmuri) (Lee Minseo, SIL Open Font
License 1.1; the licence ships next to the fonts as `src/assets/fonts/OFL.txt`), a Korean bitmap
font with all 11,172 Hangul syllables. The fonts are self-hosted: nothing is loaded from a CDN.
`scripts/fonts/subset_galmuri.py` rebuilds the WOFF2 files in `src/assets/fonts/` from the npm
release (`galmuri@2.40.3`), keeping Latin, punctuation and all of Hangul and dropping the
kana/kanji and the monochrome dingbats (about 150 KB per face).

A bitmap font is only sharp at whole multiples of its pixel grid, so every `font-size` in the UI
is one of these (the families are the `--font-px9/11/14` tokens in `global.css`):

| Face           | Sizes            | Used for                                                            |
| -------------- | ---------------- | ------------------------------------------------------------------- |
| Galmuri14      | 15px             | body copy (the root size)                                           |
| Galmuri11      | 12px             | card rules text, logs, hints, secondary lines                       |
| Galmuri11 Bold | 12px, 24/36/48px | names, buttons, labels and numbers; headings and titles             |
| Galmuri9       | 10px, 20px       | tiny labels (card type line, small gauge); large buttons, cost gems |

`font-synthesis: none` keeps the browser from smearing a fake bold onto the faces without a bold
cut, letter-spacing is whole pixels, and text shadows are hard 1–3px offsets rather than blurs.

### Tests

`npm test` runs:

- `combat.test.ts`: damage and block math, Vulnerable/Weak timing, Ritual, energy checks, multi-target,
  powers, and win/lose detection. It also covers the candle: per-turn drain and persistence,
  blackout (HP loss, enemy bonus, death attribution), dim/blackout intent hiding, hidden intents
  being withheld from `describeIntent` but still executed, the reveal action and card, light and
  shadow wax (including the HP shortfall), `ifDark`, Kindle, and enemy wax attacks.
- `map.test.ts`: graph validity for several seeds (reachability, no crossing edges, row rules).
- `run.test.ts`: act transition, final victory, rest, event, and shop flows, plus the candle
  across the run: rekindle, shop candle, act refill, events and candle relics.
- `simulation.test.ts`: a greedy bot plays 40 complete seeded runs through the public API,
  checking invariants after every action, verifying that no state gets stuck, and confirming that
  saves survive a JSON round-trip. The bot sees intents only through `describeIntent`, so the
  darkness really blinds it. It pays wax to reveal intents, budgets its shadow cards, and rekindles
  at rest sites. A second, candle-ignoring policy powers the pacing test.
  (`SIM_DEBUG=1 npm test` prints where each run ended and its candle trace.)

## Current scope

**Implemented**

- One class (Warrior) with a 10-card starter deck (4 Strike, 4 Defend, Bash, Iron Wave) and the
  Burning Blood starter relic.
- The candle system: a run-long wax resource, dim light and blackout, hidden enemy intents, and
  a paid reveal. Candle gauges appear in combat and in the top bar.
- 33 player cards with upgrades: 21 neutral, 6 light and 6 shadow. Plus 2 status cards (Slimed,
  Wound).
- 9 status effects: Strength, Dexterity, Vulnerable, Weak, Frail, Ritual, Metallicize, Thorns,
  Kindle.
- Act 1 content: 5 normal enemies, 2 elite encounters, and the boss _썩은 골렘 (Rotting Golem)_.
- A procedural branching map for each act, with combat, elite, event, shop, rest, and boss nodes.
- Rewards (gold, 1-of-3 cards, relics), shop (cards, relics, card removal, candle), rest site
  (heal, rekindle or upgrade), and 6 events.
- 3 acts, each ending in a boss, then a victory or defeat summary screen, then a new run.
- Save and resume through localStorage, with seeded runs.

**Intentionally stubbed / left for later**

- **Acts 2 and 3 content depth**: they reuse the Act 1 monster roster with more HP and starting
  Strength. Only their bosses (_뼈의 여왕_, _심연의 눈_) are unique.
- **Art, animation and sound**: relics, map-node and a few UI glyphs are still emoji, and the map
  chart, map-node medallions, portrait and room-icon niches and buff/debuff intent glyphs are
  still Figma vector art or CSS rather than pixel art. Animation is
  limited to small CSS transitions (hits, intents, card hover/deal-in, targeting, turn change).
  There is no sound.
- **Balance**: the numbers are a first pass. The greedy test bot reaches Act 2 in roughly a quarter
  of runs. It is a weak player (it picks the first card reward and plays cards greedily), so its
  win rate is a regression signal, not a difficulty target.
- **Candle stretch ideas**: "corruption" (shadow cards permanently darkening other cards) is not
  implemented.
- **Meta-progression and unlocks**: only lifetime counters are stored. There are no card unlocks,
  ascension levels or extra classes yet.
- **Other features**: potions, treasure rooms, card rarity visuals, a relic pool beyond 12, and
  settings (such as animation speed or language) are not implemented.
