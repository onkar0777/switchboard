import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { WidgetSpecSchema, type WidgetSpec } from "@/lib/widgets/spec";
import { CasesSchema, REQUIRED_CASE_NAMES } from "@/lib/widgets/cases";
import { givenToPipelineInput } from "@/lib/widgets/given-loader";
import { parsePipeline } from "@/lib/widgets/dsl";
import { buildContext } from "@/lib/widgets/ctx";
import { execute } from "@/lib/widgets/runtime";
import { loadWidget } from "@/lib/widgets/load-widget";
import { startStubMcpServer, registerGithubStub } from "@/lib/mcp/testkit/stub-mcp-server";
import { openRunner } from "@/lib/mcp/client-manager";

export type ValidateResult =
  | { ok: true; spec: WidgetSpec }
  | { ok: false; reason: string };

// Validates a staged package the way the locked suites would: schema parse,
// required-case-set present, every data case's `then` matches in-memory
// execution, and the happy case replays state=ok over the real stub-MCP
// transport (the save-time dry-run). Returns a legible reason on the first
// failure — that string becomes the job's failureReason (AC8).
export async function validateStagedPackage(stageDir: string, now: Date): Promise<ValidateResult> {
  let spec: WidgetSpec;
  try {
    spec = WidgetSpecSchema.parse(JSON.parse(await readFile(join(stageDir, "spec.json"), "utf8")));
  } catch (e) {
    return { ok: false, reason: `spec.json invalid: ${(e as Error).message}` };
  }

  let cases;
  try {
    cases = CasesSchema.parse(JSON.parse(await readFile(join(stageDir, "golden", "cases.json"), "utf8")));
  } catch (e) {
    return { ok: false, reason: `golden/cases.json invalid: ${(e as Error).message}` };
  }

  const names = cases.cases.map((c) => c.name);
  for (const required of REQUIRED_CASE_NAMES) {
    if (!names.includes(required)) return { ok: false, reason: `missing required case "${required}"` };
  }

  // In-memory golden: every data case's then must match execution.
  const ctx = buildContext(spec, now);
  const pipeline = parsePipeline(spec.verdict.pipeline);
  for (const c of cases.cases) {
    if (!("given" in c)) continue;
    const out = execute({ verdict: { pipeline }, deeplink: spec.deeplink, render: spec.render }, givenToPipelineInput(c.given), ctx);
    if (c.then.state !== undefined && out.state !== c.then.state) return { ok: false, reason: `golden "${c.name}": state ${out.state} ≠ ${c.then.state}` };
    if (c.then.verdict !== undefined && out.verdict !== c.then.verdict) return { ok: false, reason: `golden "${c.name}": verdict mismatch` };
    if (c.then.value !== undefined && out.value !== c.then.value) return { ok: false, reason: `golden "${c.name}": value mismatch` };
    if (c.then.status !== undefined && out.status !== c.then.status) return { ok: false, reason: `golden "${c.name}": status mismatch` };
  }

  // Dry-run: replay the happy given over the real stub transport (github only;
  // other servers fall back to in-memory-only until a stub exists).
  const happy = cases.cases.find((c) => c.name === "happy");
  if (happy && "given" in happy && spec.mcp.server === "github") {
    const stub = await startStubMcpServer(registerGithubStub({ merged: happy.given.merged ?? [], open: happy.given.open ?? [] }));
    const runner = await openRunner(stub.config);
    try {
      const widget = await loadWidget(spec, now, { runner });
      if (widget.output.state !== "ok") return { ok: false, reason: `dry-run over real transport produced state="${widget.output.state}": ${widget.errorMessage ?? ""}` };
    } finally {
      await runner.close();
      await stub.close();
    }
  }

  return { ok: true, spec };
}
