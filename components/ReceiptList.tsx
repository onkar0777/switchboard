import type { Receipt } from "@/lib/verdicts/types";
import { EYEBROW } from "@/lib/design-tokens";

function formatMerged(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function ReceiptList({ receipts }: { receipts: Receipt[] }) {
  if (receipts.length === 0) {
    return (
      <section className="border-b border-stone-200 pb-8" aria-labelledby="receipts-label">
        <p className={EYEBROW} id="receipts-label">Receipts</p>
        <p className="mt-4 border border-dashed border-stone-300 px-4 py-3 text-sm text-stone-500">
          No merged PRs this week yet.
        </p>
      </section>
    );
  }
  return (
    <section className="border-b border-stone-200 pb-8" aria-labelledby="receipts-label">
      <p className={EYEBROW} id="receipts-label">Receipts</p>
      <ul className="mt-3 divide-y divide-stone-100">
        {receipts.map((r) => (
          <li key={r.id}>
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col gap-1 py-3 hover:bg-stone-50 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
            >
              <span className="font-serif text-[17px] font-medium leading-snug text-stone-900">
                {r.title}
              </span>
              <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-stone-500">
                {r.repo}#{r.prNumber} · {formatMerged(r.mergedAt)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
