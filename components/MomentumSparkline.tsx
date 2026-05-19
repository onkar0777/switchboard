import { EYEBROW } from "@/lib/design-tokens";

export function MomentumSparkline({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts);
  const w = 200;
  const h = 44;
  const padRight = 48;
  const usableW = w - padRight;
  const stepX = usableW / Math.max(1, counts.length - 1);
  const points = counts.map((c, i) => {
    const x = i * stepX;
    const y = h - (c / max) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const lastIndex = counts.length - 1;
  const lastX = lastIndex * stepX;
  const lastY = h - (counts[lastIndex] / max) * (h - 4) - 2;
  // Flip label above the dot when there's no room below (viewBox is h=44, text font-size 9).
  const labelY = lastY > h - 14 ? lastY - 4 : lastY + 11;
  const titleText = `Momentum: ${counts.join(", ")} PRs over ${counts.length} weeks. Current week is partial.`;

  return (
    <section className="pb-6" aria-labelledby="momentum-label">
      <p className={EYEBROW} id="momentum-label">Momentum · 4 weeks</p>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="mt-3 text-stone-700"
        role="img"
        aria-label="4-week momentum sparkline"
      >
        <title>{titleText}</title>
        <line
          x1={lastX}
          x2={lastX}
          y1={0}
          y2={h}
          stroke="currentColor"
          strokeWidth={0.5}
          strokeDasharray="2 2"
          opacity={0.4}
        />
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points.join(" ")}
        />
        <text
          x={lastX + 4}
          y={labelY}
          className="font-mono"
          fontSize={9}
          fill="currentColor"
          opacity={0.7}
        >
          this wk
        </text>
      </svg>
    </section>
  );
}
