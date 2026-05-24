import { describe, expect, it } from "vitest";
import { CasesSchema } from "./cases";
import { givenToPipelineInput } from "./given-loader";

describe("golden cases schema + given-loader", () => {
  it("accepts a data case and feeds given straight through as queries", () => {
    const parsed = CasesSchema.parse({
      schemaVersion: "1.0",
      cases: [{ name: "happy", given: { merged: [{ id: "1" }], open: [] }, then: { state: "ok" } }],
    });
    const dataCase = parsed.cases[0];
    if (!("given" in dataCase)) throw new Error("expected data case");
    expect(givenToPipelineInput(dataCase.given)).toEqual({ queries: { merged: [{ id: "1" }], open: [] } });
  });
  it("accepts a fault case", () => {
    const parsed = CasesSchema.parse({
      schemaVersion: "1.0",
      cases: [{ name: "tool-error", fault: "tool_error", then: { state: "error" } }],
    });
    expect(parsed.cases[0]).toMatchObject({ name: "tool-error", fault: "tool_error" });
  });
});
