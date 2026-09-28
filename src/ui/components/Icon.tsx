interface Props {
  src: string;
  /** Rendered width and height in px. */
  size?: number;
  className?: string;
  /** Accessible name; omit for decorative icons next to a text label. */
  label?: string;
}

/** A Figma-exported SVG icon rendered as an image (see `ui/art.ts`). */
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
      style={{ display: 'inline-block', verticalAlign: 'middle', flex: 'none' }}
    />
  );
}
