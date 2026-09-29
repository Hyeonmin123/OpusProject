/**
 * Art registry: every image asset the UI uses, keyed by what it depicts.
 *
 * Pixel art (portraits, key art, gameplay and status icons, scene backgrounds) is generated from
 * the Gemini exports in `art-src/gemini/` by `scripts/pixelart/process.py`: palette-locked,
 * reduced to a real low-res grid and exported nearest-neighbour upscaled. Render it with
 * `image-rendering: pixelated` wherever it is drawn larger than its grid.
 *
 * The UI chrome (button plaques and their dither tiles, panel slabs, card faces and ornaments,
 * gauge troughs and fills, medallions, the top bar, the scene scrims) is pixel art designed in
 * the Figma file "Endless Cellar — Pixel UI Kit"
 * (https://www.figma.com/design/m2OXVtN1pXojVj6c7EKelg) and exported into `assets/ui/` by
 * `scripts/pixelart/uikit.py`. It is referenced from the stylesheets (as `border-image`s and
 * background tiles) rather than from here.
 *
 * The map-node, relic and event icons are hand-built pixel art on the same 32px grid as the
 * gameplay icons (`scripts/pixelart/icons.py`), round-tripped through the kit's "Icons" page and
 * exported into `assets/nodes/`, `assets/relics/` and `assets/events/`, keyed by node type,
 * relic id and event id. So are the screen icons in `ICONS` (HP heart, reward trophy, victory
 * crown, defeat headstone, card removal, the rest site's sleep and upgrade, the blackout
 * eclipse, the raise-the-wick glass, the special intent, the buff and debuff intents and the
 * status-card glyph), exported into `assets/icons/`.
 *
 * The map chart is still vector art from the project's Figma file "끝없는 지하실 — Art Assets"
 * (https://www.figma.com/design/SP8IxP7Nwge0zkGVkRNB8C).
 * Status and enemy components fall back to the emoji in `data/` when an entry is missing.
 */
import keyArt from '../assets/art/keyart.png';
import bgAct1 from '../assets/bg/act1.png';
import bgAct2 from '../assets/bg/act2.png';
import bgAct3 from '../assets/bg/act3.png';
import bgEvent from '../assets/bg/event.png';
import mapChart from '../assets/bg/map-chart.svg';
import bgMap from '../assets/bg/map.png';
import bgMenu from '../assets/bg/menu.png';
import bgRest from '../assets/bg/rest.png';
import bgShop from '../assets/bg/shop.png';
import eventAltar from '../assets/events/altar.png';
import eventChandler from '../assets/events/chandler.png';
import eventCorpse from '../assets/events/corpse.png';
import eventForge from '../assets/events/forge.png';
import eventSpring from '../assets/events/spring.png';
import eventWhisper from '../assets/events/whisper.png';
import blackout from '../assets/icons/blackout.png';
import candle from '../assets/icons/candle.png';
import candleOut from '../assets/icons/candle-out.png';
import crown from '../assets/icons/crown.png';
import energy from '../assets/icons/energy.png';
import heart from '../assets/icons/heart.png';
import hidden from '../assets/icons/hidden.png';
import intentBuff from '../assets/icons/intent-buff.png';
import intentDebuff from '../assets/icons/intent-debuff.png';
import light from '../assets/icons/light.png';
import power from '../assets/icons/power.png';
import remove from '../assets/icons/remove.png';
import reveal from '../assets/icons/reveal.png';
import shadow from '../assets/icons/shadow.png';
import shield from '../assets/icons/shield.png';
import sleep from '../assets/icons/sleep.png';
import special from '../assets/icons/special.png';
import status from '../assets/icons/status.png';
import sword from '../assets/icons/sword.png';
import tombstone from '../assets/icons/tombstone.png';
import trophy from '../assets/icons/trophy.png';
import upgrade from '../assets/icons/upgrade.png';
import nodeBoss from '../assets/nodes/boss.png';
import nodeCombat from '../assets/nodes/combat.png';
import nodeElite from '../assets/nodes/elite.png';
import nodeEvent from '../assets/nodes/event.png';
import nodeRest from '../assets/nodes/rest.png';
import nodeShop from '../assets/nodes/shop.png';
import abyssalEye from '../assets/portraits/abyssalEye.png';
import bat from '../assets/portraits/bat.png';
import boneQueen from '../assets/portraits/boneQueen.png';
import cultist from '../assets/portraits/cultist.png';
import fallenKnight from '../assets/portraits/fallenKnight.png';
import gargoyle from '../assets/portraits/gargoyle.png';
import rat from '../assets/portraits/rat.png';
import rottingGolem from '../assets/portraits/rottingGolem.png';
import skeleton from '../assets/portraits/skeleton.png';
import slime from '../assets/portraits/slime.png';
import warrior from '../assets/portraits/warrior.png';
import anchor from '../assets/relics/anchor.png';
import bagOfMarbles from '../assets/relics/bagOfMarbles.png';
import blackCandle from '../assets/relics/blackCandle.png';
import bloodVial from '../assets/relics/bloodVial.png';
import bronzeScales from '../assets/relics/bronzeScales.png';
import burningBlood from '../assets/relics/burningBlood.png';
import cursedCrown from '../assets/relics/cursedCrown.png';
import eternalFlame from '../assets/relics/eternalFlame.png';
import goldenIdol from '../assets/relics/goldenIdol.png';
import ironHeart from '../assets/relics/ironHeart.png';
import lantern from '../assets/relics/lantern.png';
import owlEye from '../assets/relics/owlEye.png';
import silverCandlestick from '../assets/relics/silverCandlestick.png';
import vajra from '../assets/relics/vajra.png';
import waxSeal from '../assets/relics/waxSeal.png';
import wildBerry from '../assets/relics/wildBerry.png';
import dexterity from '../assets/status/dexterity.png';
import frail from '../assets/status/frail.png';
import kindle from '../assets/status/kindle.png';
import metallicize from '../assets/status/metallicize.png';
import ritual from '../assets/status/ritual.png';
import strength from '../assets/status/strength.png';
import thorns from '../assets/status/thorns.png';
import vulnerable from '../assets/status/vulnerable.png';
import weak from '../assets/status/weak.png';
import type { CardType, NodeType, StatusId } from '../types';

/** The main menu's candle, lifted out of the archway key art (the archway is `SCENES.menu`). */
export const KEY_ART = keyArt;

/**
 * Full-bleed scene backgrounds (256×144 pixel grid, 16:9), drawn by `components/Backdrop`
 * behind each screen with a darkening scrim so foreground UI stays readable.
 * The scrim that darkens their edges, the slab frames and the crest are UI-kit chrome referenced
 * from the stylesheets (assets/ui/*.png), like the card faces.
 */
export const SCENES = {
  /** Candle-lit archway; the menu sits in its dark doorway. */
  menu: bgMenu,
  /** Stone wall with candle sconces: map, rewards, run summary. */
  wall: bgMap,
  act1: bgAct1,
  act2: bgAct2,
  act3: bgAct3,
  shop: bgShop,
  rest: bgRest,
  event: bgEvent,
} as const;

export type SceneId = keyof typeof SCENES;

/** Combat backdrop per act (acts past 3 reuse the last one). */
export function combatScene(act: number): SceneId {
  return act <= 1 ? 'act1' : act === 2 ? 'act2' : 'act3';
}

/** Dark vellum chart the map's node graph is drawn on (2× of the 444×850 map). */
export const MAP_CHART = mapChart;

/** Core UI icons (32×32 pixel grid, readable at 14–32px). */
export const ICONS = {
  energy,
  candle,
  candleOut,
  block: shield,
  attack: sword,
  light,
  shadow,
  power,
  status,
  /** An enemy intent hidden by the dark. */
  hidden,
  /** A seen but unusual enemy move (special intent), unlike `hidden`. */
  special,
  intentBuff,
  intentDebuff,
  /** Player HP (top bar). */
  hp: heart,
  /** Screen headers (room niche): rewards, run won, run lost. Rest and shop use NODE_ICONS. */
  reward: trophy,
  victory: crown,
  defeat: tombstone,
  /** The shop's card removal. */
  removeCard: remove,
  /** Rest site choices: sleep (heal) and upgrade a card (rekindle uses `candle`). */
  restHeal: sleep,
  restUpgrade: upgrade,
  /** Combat: the blackout banner and the raise-the-wick (reveal intents) button. */
  blackout,
  reveal,
} as const;

export const STATUS_ICONS: Record<StatusId, string> = {
  strength,
  dexterity,
  vulnerable,
  weak,
  frail,
  ritual,
  metallicize,
  thorns,
  kindle,
};

/** Card-type glyph shown in the card's art box. */
export const CARD_TYPE_ICONS: Record<CardType, string> = {
  attack: sword,
  skill: shield,
  power,
  status,
};

/**
 * Portraits by player class / enemy def id (52×52 grid, bosses 66×66: 2× in their frames).
 * Variants (e.g. 동굴 박쥐 A/B) share one.
 */
export const PORTRAITS: Record<string, string> = {
  warrior,
  rat,
  bat,
  cultist,
  slime,
  skeleton,
  fallenKnight,
  gargoyle,
  rottingGolem,
  boneQueen,
  abyssalEye,
};

/** Map node icons by node type (32×32 grid: 1× on a map node, 2× on the boss node). */
export const NODE_ICONS: Record<NodeType, string> = {
  combat: nodeCombat,
  elite: nodeElite,
  event: nodeEvent,
  shop: nodeShop,
  rest: nodeRest,
  boss: nodeBoss,
};

/** Relic icons by relic id (32×32 grid). */
export const RELIC_ICONS: Record<string, string> = {
  burningBlood,
  anchor,
  vajra,
  bagOfMarbles,
  lantern,
  bloodVial,
  bronzeScales,
  wildBerry,
  goldenIdol,
  waxSeal,
  silverCandlestick,
  owlEye,
  cursedCrown,
  blackCandle,
  eternalFlame,
  ironHeart,
};

/** Event icons by event id (32×32 grid, shown 2× in the room niche). */
export const EVENT_ICONS: Record<string, string> = {
  altar: eventAltar,
  corpse: eventCorpse,
  spring: eventSpring,
  whisper: eventWhisper,
  forge: eventForge,
  chandler: eventChandler,
};
