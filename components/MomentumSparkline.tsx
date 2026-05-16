export function MomentumSparkline({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts);
  const w = 140;
  const h = 40;
  const stepX = w / Math.max(1, counts.length - 1);
  const points = counts.map((c, i) => {
    const x = i * stepX;
    const y = h - (c / max) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const lastIndex = counts.length - 1;
  const lastX = lastIndex * stepX;
  const lastY = h - (counts[lastIndex] / max) * (h - 4) - 2;

  return (
    <section className="rounded-lg border border-stone-200 p-5">
      <p className="text-xs uppercase tracking-wider text-stone-500">Momentum (4 weeks)</p>
      <div className="mt-3 flex items-end gap-4">
        <svg width={w} height={h} className="text-stone-700" aria-label="4-week momentum sparkline">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points.join(" ")}
          />
          {/* current week dot — slightly transparent because partial */}
          <circle cx={lastX} cy={lastY} r={3.5} fill="currentColor" opacity={0.5} />
        </svg>
        <p className="font-mono text-xs text-stone-500 tabular-nums">
          {counts.join(" · ")}
        </p>
      </div>
    </section>
  );
}
