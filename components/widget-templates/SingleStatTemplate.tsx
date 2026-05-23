import type { WidgetOutput } from "./types";
import { STATUS_TEXT } from "@/lib/widgets/status-tokens";
import { EYEBROW } from "@/lib/design-tokens";

// One hero numeral + a one-line verdict caption (DESIGN.md hero stat / compact
// verdict). Status colors the caption only when state === "ok".
export function SingleStatTemplate({ output }: { output: WidgetOutput }) {
  const colored = output.state === "ok";
  const value = (output.slots.value as number | string | undefined) ?? output.value ?? "—";
  const label = (output.slots.label as string | undefined) ?? output.title;
  const verdict = (output.slots.verdict as string | undefined) ?? output.verdict;
  const verdictColor = colored ? STATUS_TEXT[output.status] : "text-stone-600";

  return (
    <article className="space-y-3" aria-label={output.title}>
      <p className={EYEBROW}>{label}</p>
      <p className="font-mono text-[32px] leading-none tabular-nums text-stone-900">{value}</p>
      <p className={`font-serif text-[15px] leading-[1.35] ${verdictColor}`}>{verdict}</p>
    </article>
  );
}
