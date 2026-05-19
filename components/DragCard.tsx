import type { Receipt } from "@/lib/verdicts/types";
import { EYEBROW } from "@/lib/design-tokens";

export function DragCard({ drag }: { drag: Receipt[] }) {
  if (drag.length === 0) return null;
  return (
    <section className="border-l-2 border-amber-700 bg-amber-50 px-5 py-4" aria-labelledby="drag-label">
      <p className={`${EYEBROW} text-amber-800`} id="drag-label">Drag</p>
      <ul className="mt-2 divide-y divide-amber-200/60">
        {drag.map((r) => {
          const hours = Math.round(r.hoursSinceUpdate ?? 0);
          return (
            <li key={r.id}>
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col gap-1 py-2 hover:bg-amber-100/50 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <span className="font-serif text-[17px] font-medium leading-snug text-stone-900">
                  {r.title}
                </span>
                <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-amber-800">
                  {r.repo}#{r.prNumber} · stale {hours}h
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
