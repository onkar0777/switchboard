import type { Receipt } from "@/lib/verdicts/types";

export function DragCard({ drag }: { drag: Receipt[] }) {
  if (drag.length === 0) return null;
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
      <p className="text-xs uppercase tracking-wider text-amber-800">Drag</p>
      <ul className="mt-3 space-y-2">
        {drag.map((r) => {
          const hours = Math.round(r.hoursSinceUpdate ?? 0);
          return (
            <li key={r.id} className="flex items-baseline justify-between gap-4">
              <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-stone-900 hover:underline">
                {r.title}
              </a>
              <span className="shrink-0 font-mono text-xs text-amber-800">
                {r.repo}#{r.prNumber} · stale {hours}h
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
