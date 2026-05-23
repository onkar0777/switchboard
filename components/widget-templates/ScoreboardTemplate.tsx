import type { WidgetOutput } from "./types";
import { STATUS_TEXT } from "@/lib/widgets/status-tokens";
import { EYEBROW } from "@/lib/design-tokens";

// Numeric headline + delta. Big mono numeral (DESIGN.md hero stat, 32px), Fraunces
// headline colored by status only when state === "ok".
export function ScoreboardTemplate({ output }: { output: WidgetOutput }) {
  const colored = output.state === "ok";
  const headline = (output.slots.headline as string | undefined) ?? output.verdict;
  const value = (output.slots.value as number | string | undefined) ?? output.value ?? "—";
  const deltaPct = output.slots.deltaPct as number | undefined;
  const headlineColor = colored ? STATUS_TEXT[output.status] : "text-stone-900";
  const deltaColor = deltaPct == null ? "" : deltaPct >= 0 ? "text-emerald-700" : "text-rose-700";
  const deltaArrow = deltaPct == null ? "" : deltaPct >= 0 ? "▲" : "▼";

  return (
    <article className="space-y-4" aria-label={output.title}>
      <p className={EYEBROW}>{output.title}</p>
      <p className="font-mono text-[32px] leading-none tabular-nums text-stone-900">
        {value}
        {deltaPct != null ? (
          <span className={`ml-3 font-mono text-[18px] tabular-nums ${deltaColor}`}>
            {deltaArrow} {Math.abs(deltaPct)}%
          </span>
        ) : null}
      </p>
      <p className={`font-serif text-[22px] leading-[1.2] ${headlineColor}`}>{headline}</p>
    </article>
  );
}
