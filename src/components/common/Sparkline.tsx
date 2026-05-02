import { cn } from "@/lib/utils";

interface SparklineProps {
  /** Series points, oldest first. Single-point series renders a flat line. */
  values: number[];
  /** Tailwind stroke colour class (e.g. "stroke-foreground", "stroke-success"). */
  strokeClassName?: string;
  /**
   * Tailwind fill class for the area under the line. Pass a `/N`
   * opacity tint to keep it quiet (e.g. "fill-foreground/10").
   */
  fillClassName?: string;
  /** Outer wrapper sizing — controls the rendered width + height. */
  className?: string;
}

/**
 * Tiny inline area-line chart for the dashboard stat cards. No axes,
 * no labels, no tooltips — just the trend. Values are mapped to a
 * 100×30 viewBox so the SVG can scale to any container size with a
 * single `preserveAspectRatio="none"`.
 */
export function Sparkline({
  values,
  strokeClassName = "stroke-foreground",
  fillClassName = "fill-foreground/10",
  className,
}: SparklineProps) {
  if (values.length === 0) return null;

  const W = 100;
  const H = 30;
  const max = Math.max(...values);
  const min = Math.min(...values);
  // Avoid divide-by-zero on a flat series; pad the range so the line
  // sits in the middle of the box rather than collapsing to the floor.
  const range = max - min || 1;

  const stepX = values.length > 1 ? W / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = i * stepX;
    // Invert Y because SVG origin is top-left.
    const y = H - ((v - min) / range) * H;
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");

  // Close the line into an area by dropping to the baseline at both
  // ends. Used as the fill underneath the stroke.
  const areaPath = `${linePath} L${W} ${H} L0 ${H} Z`;

  return (
    <svg
      className={cn("w-full", className)}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={areaPath} className={cn("stroke-none", fillClassName)} />
      <path
        d={linePath}
        className={cn("fill-none", strokeClassName)}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
