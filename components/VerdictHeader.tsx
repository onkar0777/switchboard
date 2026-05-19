import type { Verdict } from "@/lib/verdicts/types";
import { STATUS_TONE, EYEBROW } from "@/lib/design-tokens";

export function VerdictHeader({ verdict }: { verdict: Verdict }) {
  return (
    <header className="border-b border-stone-200 pb-8">
      <p className={EYEBROW} id="northstar-label">North Star</p>
      <h1 className="mt-2 text-base font-normal text-stone-600">{verdict.goal.label}</h1>
      <p
        className={`mt-5 font-serif text-[40px] leading-[1.1] font-semibold tracking-[-0.01em] ${STATUS_TONE[verdict.status]}`}
        aria-labelledby="northstar-label"
      >
        {verdict.headline}
      </p>
    </header>
  );
}
