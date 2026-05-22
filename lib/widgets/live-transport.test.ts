// @vitest-environment node
import { describe, it } from "vitest";

// Tier 4 — stub-MCP-over-real-transport acceptance contract.
// Each todo is greened by a named phase (see plan). Stable boundaries only:
// the buildMcpData result, the loadWidget output, and the openRunner failure
// surface — never internal functions.
describe("Tier 4 — live transport acceptance", () => {
  it.todo("AC1: buildMcpData returns canned rows through openRunner over a real HTTP transport");
  it.todo("AC2: loadWidget over real transport yields state=ok and a 'Shipped: 5/5' verdict");
  it.todo("AC3: loadWidget over real transport with no data yields state=empty and no error");
  it.todo("AC4: an unreachable MCP url surfaces as 'Couldn't compute: fetch failed'");
});
