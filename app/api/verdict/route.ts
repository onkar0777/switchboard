import { NextResponse } from "next/server";
import config from "@/switchboard.config";
import { computeVerdict } from "@/lib/verdicts/engine";
import type { MCPAdapter } from "@/lib/mcp/adapter";
import { MockAdapter } from "@/lib/mcp/mock";
import { OctokitGitHubAdapter } from "@/lib/mcp/octokit";

export const dynamic = "force-dynamic";

function pickAdapter(): MCPAdapter | { error: { code: string; message: string }; status: number } {
  if (process.env.SWITCHBOARD_FORCE_MOCK === "1") {
    return new MockAdapter();
  }
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return {
      error: { code: "auth_failed", message: "GITHUB_TOKEN not set" },
      status: 502,
    };
  }
  return new OctokitGitHubAdapter({ token });
}

function frozenNow(): Date {
  const v = process.env.SWITCHBOARD_FROZEN_NOW;
  return v ? new Date(v) : new Date();
}

export async function GET() {
  const goal = config.goals[0];
  if (!goal) {
    return NextResponse.json(
      { error: "No goal configured.", code: "no_goal" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const effectiveTarget =
    process.env.SWITCHBOARD_TEST_TARGET_ZERO === "1" ? 0 : goal.target;
  if (effectiveTarget <= 0) {
    return NextResponse.json(
      { error: "Goal target must be positive.", code: "invalid_target" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const adapter = pickAdapter();
  if (!("listMergedPRs" in adapter)) {
    return NextResponse.json(
      { error: adapter.error.message, code: adapter.error.code },
      { status: adapter.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await computeVerdict(adapter, { ...goal, target: effectiveTarget }, frozenNow());
  if (!result.ok) {
    const status = result.error.code === "auth_failed" ? 502 : result.error.code === "rate_limited" ? 502 : 502;
    return NextResponse.json(
      { error: result.error.message, code: result.error.code, retryAfterSeconds: result.error.retryAfterSeconds },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(result.data, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
