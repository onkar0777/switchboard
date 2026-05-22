import type { WidgetOutput } from "./types";
import { STATUS_TEXT } from "@/lib/widgets/status-tokens";
import { EYEBROW } from "@/lib/design-tokens";

interface ListRow {
  id: string | number;
  title: string;
  deeplink?: string;
  meta?: unknown;
  [k: string]: unknown;
}

// Ranked deeplinked rows under a one-line verdict. Rows come from the deeplinked
// runtime output.rows (preferred) or slots.rows. Newspaper hairline divides;
// links are understated ink underlines (DESIGN.md), status color on the verdict.
export function ListTemplate({ output }: { output: WidgetOutput }) {
  const colored = output.state === "ok";
  const verdict = (output.slots.verdict as string | undefined) ?? output.verdict;
  const headlineColor = colored ? STATUS_TEXT[output.status] : "text-stone-900";
  const rows = (output.rows.length > 0 ? output.rows : (output.slots.rows as ListRow[] | undefined) ?? []) as ListRow[];

  return (
    <article className="space-y-5" aria-label={output.title}>
      <header>
        <p className={EYEBROW}>{output.title}</p>
        <p className={`mt-3 font-serif text-[22px] leading-[1.2] ${headlineColor}`}>{verdict}</p>
      </header>
      {rows.length === 0 ? (
        <p className="border border-dashed border-stone-300 px-4 py-3 text-sm text-stone-500">Nothing to show.</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {rows.map((r) => (
            <li key={String(r.id)}>
              <a
                href={r.deeplink ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="flex items-baseline justify-between gap-4 py-3 hover:bg-stone-50"
              >
                <span className="font-serif text-[17px] font-medium leading-snug text-stone-900 underline decoration-stone-300 underline-offset-2">
                  {r.title}
                </span>
                {r.meta != null ? (
                  <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-stone-500">
                    {String(r.meta)}
                  </span>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
