import type { Receipt } from "@/lib/verdicts/types";

function formatMerged(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function ReceiptList({ receipts }: { receipts: Receipt[] }) {
  if (receipts.length === 0) {
    return (
      <section className="rounded-lg border border-stone-200 p-5">
        <p className="text-xs uppercase tracking-wider text-stone-500">Receipts</p>
        <p className="mt-3 text-sm text-stone-500">No merged PRs this week yet.</p>
      </section>
    );
  }
  return (
    <section className="rounded-lg border border-stone-200 p-5">
      <p className="text-xs uppercase tracking-wider text-stone-500">Receipts</p>
      <ul className="mt-3 divide-y divide-stone-100">
        {receipts.map((r) => (
          <li key={r.id} className="flex items-baseline justify-between gap-4 py-2">
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-stone-900 hover:underline"
            >
              {r.title}
            </a>
            <span className="shrink-0 font-mono text-xs text-stone-500">
              {r.repo}#{r.prNumber} · {formatMerged(r.mergedAt)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
