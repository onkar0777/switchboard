import type { RuntimeOutput } from "@/lib/widgets/runtime";
import type { Receipt } from "@/lib/verdicts/types";
import { STATUS_TEXT } from "@/lib/widgets/status-tokens";
import { EYEBROW } from "@/lib/design-tokens";
import { ReceiptList } from "@/components/ReceiptList";
import { DragCard } from "@/components/DragCard";
import { MomentumSparkline } from "@/components/MomentumSparkline";
import { MondayMoveCard } from "@/components/MondayMoveCard";

export interface VerdictCardOutput extends RuntimeOutput {
  title: string;
}

// Maps a runtime row (which carries `deeplink`) to the Receipt shape v1's
// sub-components expect (which read `url`).
function toReceipts(rows: unknown): Receipt[] {
  if (!Array.isArray(rows)) return [];
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id ?? ""),
    title: String(r.title ?? ""),
    url: String(r.deeplink ?? r.url ?? ""),
    repo: String(r.repo ?? ""),
    prNumber: Number(r.prNumber ?? 0),
    mergedAt: r.mergedAt as string | undefined,
    openedAt: String(r.openedAt ?? ""),
    hoursSinceUpdate: r.hoursSinceUpdate as number | undefined,
  }));
}

export function VerdictCardTemplate({ output }: { output: VerdictCardOutput }) {
  const colored = output.state === "ok";
  const headlineColor = colored ? STATUS_TEXT[output.status] : "text-stone-900";
  const verdict = (output.slots.verdict as string | undefined) ?? output.verdict;
  const action = (output.slots.action as string | undefined) ?? null;
  const receipts = toReceipts(output.slots.receipts);
  const drag = toReceipts(output.slots.drag);
  const momentum = (output.slots.momentum as number[] | undefined) ?? output.momentum ?? [];

  return (
    <article className="space-y-8">
      <header className="border-b border-stone-200 pb-8">
        <p className={EYEBROW} id="verdict-card-label">{output.title}</p>
        <p
          className={`mt-5 font-serif text-[40px] leading-[1.1] font-semibold tracking-[-0.01em] ${headlineColor}`}
          aria-labelledby="verdict-card-label"
        >
          {verdict}
        </p>
      </header>
      {action ? <MondayMoveCard move={action} /> : null}
      <ReceiptList receipts={receipts} />
      <DragCard drag={drag} />
      {momentum.length > 0 ? <MomentumSparkline counts={momentum} /> : null}
    </article>
  );
}
