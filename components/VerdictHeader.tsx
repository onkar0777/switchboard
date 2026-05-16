import type { Verdict } from "@/lib/verdicts/types";

const STATUS_TONE: Record<Verdict["status"], string> = {
  shipped: "text-emerald-700",
  on_track: "text-emerald-700",
  nearly_there: "text-amber-700",
  behind: "text-rose-700",
};

export function VerdictHeader({ verdict }: { verdict: Verdict }) {
  return (
    <header className="border-b border-stone-200 pb-6">
      <p className="text-xs uppercase tracking-wider text-stone-500">North Star</p>
      <h1 className="mt-1 text-2xl font-semibold text-stone-900">{verdict.goal.label}</h1>
      <p className={`mt-4 text-xl font-medium ${STATUS_TONE[verdict.status]}`}>
        {verdict.headline}
      </p>
    </header>
  );
}
