/**
 * Art registry: every Figma-exported asset the UI uses, keyed by what it depicts.
 * Source file: "끝없는 지하실 — Art Assets" (https://www.figma.com/design/SP8IxP7Nwge0zkGVkRNB8C).
 * Components fall back to the emoji in `data/` when an entry is missing.
 */
import keyArt from '../assets/art/keyart.svg';
import candle from '../assets/icons/candle.svg';
import candleOut from '../assets/icons/candle-out.svg';
import energy from '../assets/icons/energy.svg';
import intentBuff from '../assets/icons/intent-buff.svg';
import intentDebuff from '../assets/icons/intent-debuff.svg';
import light from '../assets/icons/light.svg';
import power from '../assets/icons/power.svg';
import shadow from '../assets/icons/shadow.svg';
import shield from '../assets/icons/shield.svg';
import status from '../assets/icons/status.svg';
import sword from '../assets/icons/sword.svg';
import abyssalEye from '../assets/portraits/abyssalEye.svg';
import bat from '../assets/portraits/bat.svg';
import boneQueen from '../assets/portraits/boneQueen.svg';
import cultist from '../assets/portraits/cultist.svg';
import fallenKnight from '../assets/portraits/fallenKnight.svg';
import gargoyle from '../assets/portraits/gargoyle.svg';
import rat from '../assets/portraits/rat.svg';
import rottingGolem from '../assets/portraits/rottingGolem.svg';
import skeleton from '../assets/portraits/skeleton.svg';
import slime from '../assets/portraits/slime.svg';
import warrior from '../assets/portraits/warrior.svg';
import dexterity from '../assets/status/dexterity.svg';
import frail from '../assets/status/frail.svg';
import kindle from '../assets/status/kindle.svg';
import metallicize from '../assets/status/metallicize.svg';
import ritual from '../assets/status/ritual.svg';
import strength from '../assets/status/strength.svg';
import thorns from '../assets/status/thorns.svg';
import vulnerable from '../assets/status/vulnerable.svg';
import weak from '../assets/status/weak.svg';
import type { CardType, StatusId } from '../types';

export const KEY_ART = keyArt;

/** Core UI icons (24×24 grid, readable at 14–32px). */
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

/** Portraits by player class / enemy def id. Variants (e.g. 동굴 박쥐 A/B) share one. */
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
