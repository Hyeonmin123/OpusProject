import { SCENES, type SceneId } from '../art';
import styles from './Backdrop.module.css';

/**
 * Fixed, full-bleed scene art painted behind the current screen (see `SCENES` in `ui/art.ts`).
 * Keyed by scene so moving to a new room fades the new backdrop in.
 */
export function Backdrop({ scene }: { scene: SceneId }) {
  return (
    <div
      key={scene}
      className={styles.backdrop}
      style={{ backgroundImage: `url("${SCENES[scene]}")` }}
      data-scene={scene}
      aria-hidden
    />
  );
}
