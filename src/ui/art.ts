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
 * The remaining SVGs (intent buff/debuff and generic status glyphs, the map chart) come from
 * the project's Figma file "끝없는 지하실 — Art Assets"
 * (https://www.figma.com/design/SP8IxP7Nwge0zkGVkRNB8C).
 * Components fall back to the emoji in `data/` when an entry is missing.
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
import candle from '../assets/icons/candle.png';
import candleOut from '../assets/icons/candle-out.png';
import energy from '../assets/icons/energy.png';
import hidden from '../assets/icons/hidden.png';
import intentBuff from '../assets/icons/intent-buff.svg';
import intentDebuff from '../assets/icons/intent-debuff.svg';
import light from '../assets/icons/light.png';
import power from '../assets/icons/power.png';
import shadow from '../assets/icons/shadow.png';
import shield from '../assets/icons/shield.png';
import status from '../assets/icons/status.svg';
import sword from '../assets/icons/sword.png';
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
import dexterity from '../assets/status/dexterity.png';
import frail from '../assets/status/frail.png';
import kindle from '../assets/status/kindle.png';
import metallicize from '../assets/status/metallicize.png';
import ritual from '../assets/status/ritual.png';
import strength from '../assets/status/strength.png';
import thorns from '../assets/status/thorns.png';
import vulnerable from '../assets/status/vulnerable.png';
import weak from '../assets/status/weak.png';
import type { CardType, StatusId } from '../types';

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
  intentBuff,
  intentDebuff,
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
