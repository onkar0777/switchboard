import { fetchVerdict } from "@/lib/verdicts/fetchVerdict";
import { VerdictHeader } from "@/components/VerdictHeader";
import { GoalCard } from "@/components/GoalCard";
import { ReceiptList } from "@/components/ReceiptList";
import { DragCard } from "@/components/DragCard";
import { MomentumSparkline } from "@/components/MomentumSparkline";
import { MondayMoveCard } from "@/components/MondayMoveCard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const result = await fetchVerdict();

  if (!result.ok) {
    return <ErrorPanel code={result.code} message={result.message} retryAfterSeconds={result.retryAfterSeconds} />;
  }
  const v = result.verdict;
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <VerdictHeader verdict={v} />
      <GoalCard verdict={v} />
      <ReceiptList receipts={v.receipts} />
      <DragCard drag={v.drag} />
      <MomentumSparkline counts={v.momentum} />
      <MondayMoveCard move={v.mondayMove} />
      <footer className="pt-6 text-xs text-stone-400">
        Switchboard · {new Date().toLocaleString()} · read-only · localhost
      </footer>
    </main>
  );
}

function ErrorPanel({
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
          <p>Switchboard couldn{"'"}t reach GitHub.</p>
          <p className="mt-2 text-sm text-stone-600">
            Check that <code className="font-mono">GITHUB_TOKEN</code> is set with{" "}
            <code className="font-mono">read:user</code> + <code className="font-mono">public_repo</code> scopes.
          </p>
        </>
      );
      break;
    case "rate_limited":
      body = (
        <>
          <p>GitHub rate limit hit.</p>
          {retryAfterSeconds ? (
            <p className="mt-2 text-sm text-stone-600">
              Try again in ~{Math.ceil(retryAfterSeconds / 60)}m.
            </p>
          ) : null}
        </>
      );
      break;
    case "network":
      body = (
        <>
          <p>Can{"'"}t reach GitHub right now.</p>
          <p className="mt-2 text-sm text-stone-600">Refresh to retry.</p>
        </>
      );
      break;
    case "no_goal":
    case "invalid_target":
      body = (
        <>
          <p>Switchboard isn{"'"}t configured yet.</p>
          <p className="mt-2 text-sm text-stone-600">
            Edit <code className="font-mono">switchboard.config.ts</code> with at least one goal.
          </p>
        </>
      );
      break;
    default:
      body = (
        <>
          <p>Something went wrong.</p>
          <p className="mt-2 text-sm text-stone-600 font-mono">{message}</p>
        </>
      );
  }
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold text-stone-900">Switchboard</h1>
      <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-5 text-stone-900">
        {body}
      </div>
    </main>
  );
}
