import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DashboardGrid, type GridWidget } from "@/components/DashboardGrid";
import { AddWidgetButton } from "@/components/AddWidgetButton";
import { loadFounderWidgetLive, loadWidget } from "@/lib/widgets/load-widget";
import { WidgetSpecSchema } from "@/lib/widgets/spec";
import { readLayout } from "@/lib/authoring/layout";
import { JobStore } from "@/lib/authoring/job-store";

export const dynamic = "force-dynamic";

function frozenNow(): Date {
  const v = process.env.SWITCHBOARD_FROZEN_NOW;
  return v ? new Date(v) : new Date();
}
function formatFetchedAt(d: Date): string {
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}

async function loadAuthoredWidgets(): Promise<GridWidget[]> {
  const layout = await readLayout(join(process.cwd(), "dashboard.layout.json"));
  const widgets: GridWidget[] = [];
  for (const id of layout.widgets) {
    try {
      const spec = WidgetSpecSchema.parse(JSON.parse(await readFile(join(process.cwd(), "widgets", id, "spec.json"), "utf8")));
      widgets.push(await loadWidget(spec, frozenNow()));
    } catch {
      // A malformed/absent package is skipped, not fatal to the page.
    }
  }
  return widgets;
}

export default async function Page() {
  const fetchedAt = new Date();
  const [hero, authored, jobs] = await Promise.all([
    loadFounderWidgetLive(frozenNow()),
    loadAuthoredWidgets(),
    new JobStore(join(process.cwd(), ".switchboard", "jobs")).list(),
  ]);

  return (
    <main className="mx-auto max-w-[1280px] space-y-10 p-4 md:p-8">
      <div className="flex justify-end">
        <AddWidgetButton initialJobs={jobs.filter((j) => j.state !== "done")} />
      </div>
      <DashboardGrid widgets={[hero, ...authored]} />
      <footer className="border-t border-stone-200 pt-6 text-xs text-stone-500">
        Switchboard · fetched {formatFetchedAt(fetchedAt)} · read-only · localhost
      </footer>
    </main>
  );
}
