import type { Verdict } from "@/lib/verdicts/types";
import { pluralize } from "@/lib/verdicts/engine";

export function GoalCard({ verdict }: { verdict: Verdict }) {
  const ratio = Math.min(1, verdict.actual / verdict.target);
  const pct = Math.round(ratio * 100);
  const remaining = Math.max(0, verdict.target - verdict.actual);
  const unit = pluralize(verdict.target, verdict.goal.unit);
  return (
    <section className="rounded-lg border border-stone-200 p-5">
      <p className="text-xs uppercase tracking-wider text-stone-500">Goal</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-stone-900">
        {verdict.actual}<span className="text-stone-400">/{verdict.target}</span>
        <span className="ml-2 text-base font-normal text-stone-600">{unit}</span>
      </p>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-stone-200">
        <div
          className="h-full bg-emerald-600 transition-all"
          style={{ width: `${pct}%` }}
          aria-label={`${pct}% to goal`}
        />
      </div>
      <p className="mt-2 text-sm text-stone-600">
        {remaining === 0 ? "Goal hit." : `${remaining} ${pluralize(remaining, verdict.goal.unit)} to go.`}
      </p>
    </section>
  );
}
