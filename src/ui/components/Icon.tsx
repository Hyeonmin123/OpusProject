interface Props {
  src: string;
  /** Rendered width and height in px. */
  size?: number;
  className?: string;
  /** Accessible name; omit for decorative icons next to a text label. */
  label?: string;
}

/**
 * An icon rendered as an image (see `ui/art.ts`). Pixel-art icons are on a 32px grid: at 32px
 * and up they are scaled nearest-neighbour so the pixels stay hard; below that the browser's
 * smooth downscale averages the grid, which reads better than dropping rows.
 */
export function Icon({ src, size = 16, className, label }: Props) {
  return (
    <img
      src={src}
      width={size}
      height={size}
      className={className}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flex: 'none',
        imageRendering: size >= 32 ? 'pixelated' : undefined,
      }}
    />
  );
}
