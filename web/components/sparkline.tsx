// Pure inline-SVG sparkline. No chart library, no client state — safe to render
// on the server. Draws a single polyline (plus a soft filled area beneath it)
// scaled to fit the viewBox. For all-zero / empty input it renders a flat
// baseline so the card still reads as "a trend, currently flat" rather than
// breaking. The SVG scales responsively via `preserveAspectRatio="none"` +
// width:100% so it fills its container on mobile.

interface SparklineProps {
  values: number[];
  /** Intrinsic viewBox width (the rendered width is responsive via CSS). */
  width?: number;
  /** Intrinsic viewBox height. */
  height?: number;
  /** Applied to the line + area <g>; use a text-* color util to set stroke. */
  className?: string;
}

export function Sparkline({
  values,
  width = 240,
  height = 48,
  className,
}: SparklineProps) {
  const data = Array.isArray(values) ? values.filter((v) => Number.isFinite(v)) : [];
  const n = data.length;
  const max = data.reduce((m, v) => Math.max(m, v), 0);

  // Vertical padding keeps the stroke off the top/bottom edges.
  const padY = 3;
  const usableH = height - padY * 2;

  // X positions evenly spaced across the full width; a single point sits centered.
  const x = (i: number) => (n <= 1 ? width / 2 : (i / (n - 1)) * width);
  // Higher value = higher on screen (smaller y). All-zero → flat at the baseline.
  const y = (v: number) =>
    max === 0 ? height - padY : padY + (1 - v / max) * usableH;

  const points =
    n === 0
      ? // Empty: a flat baseline across the full width.
        `0,${height - padY} ${width},${height - padY}`
      : n === 1
        ? `0,${y(data[0])} ${width},${y(data[0])}`
        : data.map((v, i) => `${x(i)},${y(v)}`).join(" ");

  // Area polygon: close the line down to the bottom edge.
  const firstX = n <= 1 ? 0 : x(0);
  const lastX = n <= 1 ? width : x(n - 1);
  const areaPoints = `${firstX},${height} ${points} ${lastX},${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label="14-day views trend"
      style={{ display: "block" }}
    >
      <polygon points={areaPoints} fill="currentColor" opacity={0.1} stroke="none" />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
