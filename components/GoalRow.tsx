import type { Verdict } from "@/lib/verdicts/types";
import { pluralize } from "@/lib/format";
import { EYEBROW } from "@/lib/design-tokens";

export function GoalRow({ verdict }: { verdict: Verdict }) {
  const ratio = Math.min(1, verdict.actual / verdict.target);
  const pct = Math.round(ratio * 100);
  const remaining = Math.max(0, verdict.target - verdict.actual);
  const unit = pluralize(verdict.target, verdict.goal.unit);
  return (
    <section
      className="border-b border-stone-200 pb-8"
      aria-labelledby="goal-label"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <p className={EYEBROW} id="goal-label">Goal</p>
      <p className="mt-3 font-mono text-[56px] leading-none font-medium tabular-nums text-stone-900">
        {verdict.actual}
        <span className="text-stone-300">/{verdict.target}</span>
        <span className="ml-3 font-sans text-base font-normal text-stone-600">{unit}</span>
      </p>
      <div className="mt-5 h-0.5 w-full bg-stone-200">
        <div
          className="h-full bg-emerald-700 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-stone-600">
        {remaining === 0 ? "Goal hit." : `${remaining} ${pluralize(remaining, verdict.goal.unit)} to go.`}
      </p>
    </section>
  );
}
