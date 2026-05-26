import { describe, it } from "vitest";

// Phase 0 placeholders. Real tests + the AuthoringSurface/AddWidgetButton rewrite
// land in Phase 4. Boundary: the rendered page given initialJobs.
describe("AddWidgetButton — recovery surface (Phase 4)", () => {
  it.todo("AC7: rehydrates the surface per persisted state (expanded question/summary/failed; collapsed chip)");
  it.todo("AC8: + Add widget is hidden when a current job exists, shown when none");
  it.todo("AC9: Discard clears the surface (revealing next failure or the button) and DELETEs the job");
});
