import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";

export const LayoutSchema = z.object({
  schemaVersion: z.literal("1.0"),
  widgets: z.array(z.string()), // ordered widget ids (authored order, per DESIGN.md v1.2)
});
export type Layout = z.infer<typeof LayoutSchema>;

const EMPTY: Layout = { schemaVersion: "1.0", widgets: [] };

export async function readLayout(file: string): Promise<Layout> {
  try {
    return LayoutSchema.parse(JSON.parse(await readFile(file, "utf8")));
  } catch {
    return { ...EMPTY };
  }
}

// Appends an id in authored order (idempotent) via tmp-then-rename, so a crash
// never leaves a half-written layout.
export async function appendWidgetId(file: string, id: string): Promise<Layout> {
  const layout = await readLayout(file);
  if (!layout.widgets.includes(id)) layout.widgets.push(id);
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${randomUUID()}`;
  await writeFile(tmp, JSON.stringify(layout, null, 2), "utf8");
  await rename(tmp, file);
  return layout;
}
