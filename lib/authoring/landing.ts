import { cp, rename, access, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { appendWidgetId } from "./layout";

export interface LandInput {
  root: string; // repo root (process.cwd() in production)
  stageDir: string; // .switchboard/staging/<jobId>
  widgetName: string;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// Atomically lands a validated staged package: copy staging into a sibling temp
// dir under widgets/, rename it into place (atomic), then append to the layout.
// Refuses to clobber an existing widget. The package appears on the grid only
// after both the rename and the layout append succeed.
export async function landPackage({ root, stageDir, widgetName }: LandInput): Promise<void> {
  const dest = join(root, "widgets", widgetName);
  if (await exists(dest)) throw new Error(`widget "${widgetName}" already exists`);

  const tmpDest = join(root, "widgets", `.landing-${widgetName}-${Date.now()}`);
  await mkdir(join(root, "widgets"), { recursive: true });
  await cp(stageDir, tmpDest, { recursive: true });
  await rename(tmpDest, dest); // atomic publish of the package directory

  await appendWidgetId(join(root, "dashboard.layout.json"), widgetName);
}
