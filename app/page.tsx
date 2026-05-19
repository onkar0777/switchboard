import type { GoalConfig } from "@/lib/verdicts/types";
import config from "@/lib/config";
import { fetchVerdict } from "@/lib/verdicts/fetchVerdict";
import { VerdictHeader } from "@/components/VerdictHeader";
import { GoalRow } from "@/components/GoalRow";
import { ReceiptList } from "@/components/ReceiptList";
import { DragCard } from "@/components/DragCard";
import { MomentumSparkline } from "@/components/MomentumSparkline";
import { MondayMoveCard } from "@/components/MondayMoveCard";
import { EYEBROW } from "@/lib/design-tokens";

export const dynamic = "force-dynamic";

function formatFetchedAt(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export default async function Page() {
  const fetchedAt = new Date();
  const result = await fetchVerdict();
  const goal = config.goals[0];

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-4 md:p-8">
      {result.ok ? (
        <>
          <VerdictHeader verdict={result.verdict} />
          <MondayMoveCard move={result.verdict.mondayMove} />
          <GoalRow verdict={result.verdict} />
          <ReceiptList receipts={result.verdict.receipts} />
          <DragCard drag={result.verdict.drag} />
          <MomentumSparkline counts={result.verdict.momentum} />
        </>
      ) : (
        <FallbackHeader
          goal={goal}
          code={result.code}
          message={result.message}
          retryAfterSeconds={result.retryAfterSeconds}
        />
      )}
      <footer className="pt-6 text-xs text-stone-500">
        Switchboard · fetched {formatFetchedAt(fetchedAt)} · read-only · localhost
      </footer>
    </main>
  );
}

function FallbackHeader({
  goal,
  code,
  message,
  retryAfterSeconds,
}: {
  goal?: GoalConfig;
  code: string;
  message: string;
  retryAfterSeconds?: number;
}) {
  return (
    <header className="border-b border-stone-200 pb-8">
      <p className={EYEBROW} id="northstar-label">North Star</p>
      <h1 className="mt-2 text-base font-normal text-stone-600">
        {goal?.label ?? "Switchboard"}
      </h1>
      <div className="mt-5">
        <InlineErrorPanel code={code} message={message} retryAfterSeconds={retryAfterSeconds} />
      </div>
    </header>
  );
}

function InlineErrorPanel({
  code,
  message,
  retryAfterSeconds,
}: {
  code: string;
  message: string;
  retryAfterSeconds?: number;
}) {
  let body: React.ReactNode;
  switch (code) {
    case "auth_failed":
      body = (
        <>
          <p className="font-serif text-2xl font-semibold text-rose-700">
            Switchboard couldn{"'"}t reach GitHub.
          </p>
          <p className="mt-2 text-sm text-stone-700">
            Check that <code className="font-mono text-xs">GITHUB_TOKEN</code> is set with{" "}
            <code className="font-mono text-xs">read:user</code> +{" "}
            <code className="font-mono text-xs">public_repo</code> scopes.
          </p>
        </>
      );
      break;
    case "rate_limited":
      body = (
        <>
          <p className="font-serif text-2xl font-semibold text-rose-700">
            GitHub rate limit hit.
          </p>
          {retryAfterSeconds ? (
            <p className="mt-2 text-sm text-stone-700">
              Try again in ~{Math.ceil(retryAfterSeconds / 60)}m.
            </p>
          ) : null}
        </>
      );
      break;
    case "network":
      body = (
        <>
          <p className="font-serif text-2xl font-semibold text-rose-700">
            Can{"'"}t reach GitHub right now.
          </p>
          <p className="mt-2 text-sm text-stone-700">Refresh to retry.</p>
        </>
      );
      break;
    case "no_goal":
    case "invalid_target":
      body = (
        <>
          <p className="font-serif text-2xl font-semibold text-rose-700">
            Switchboard isn{"'"}t configured yet.
          </p>
          <p className="mt-2 text-sm text-stone-700">
            Edit <code className="font-mono text-xs">switchboard.config.ts</code> with at least one goal.
          </p>
        </>
      );
      break;
    default:
      body = (
        <>
          <p className="font-serif text-2xl font-semibold text-rose-700">
            Something went wrong.
          </p>
          <p className="mt-2 font-mono text-xs text-stone-600">{message}</p>
        </>
      );
  }
  return (
    <div className="border-l-2 border-rose-700 bg-rose-50 px-5 py-4">
      {body}
    </div>
  );
}
