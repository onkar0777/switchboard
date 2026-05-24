import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { WidgetSpecSchema } from "@/lib/widgets/spec";
import { loadWidget } from "@/lib/widgets/load-widget";

export const dynamic = "force-dynamic";

// Serves a single widget's refreshed output (on_view). Reads the package spec
// and runs the live data path through the generic loader.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const specPath = join(process.cwd(), "widgets", params.id, "spec.json");
    const spec = WidgetSpecSchema.parse(JSON.parse(await readFile(specPath, "utf8")));
    const widget = await loadWidget(spec);
    return NextResponse.json({ widget });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
