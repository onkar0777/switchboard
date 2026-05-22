import { DashboardGrid } from "@/components/DashboardGrid";
import { loadFounderWidget } from "@/lib/widgets/load-widget";

export const dynamic = "force-dynamic";

function frozenNow(): Date {
  const v = process.env.SWITCHBOARD_FROZEN_NOW;
  return v ? new Date(v) : new Date();
}

function formatFetchedAt(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
}

export default async function Page() {
  const fetchedAt = new Date();
  const widget = await loadFounderWidget(frozenNow());

  return (
    <main className="mx-auto max-w-[1280px] space-y-10 p-4 md:p-8">
      <DashboardGrid widgets={[widget]} />
      <footer className="border-t border-stone-200 pt-6 text-xs text-stone-500">
        Switchboard · fetched {formatFetchedAt(fetchedAt)} · read-only · localhost
      </footer>
    </main>
  );
}
