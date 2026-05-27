// scripts/spike-agent-sdk.mts
// MANUAL SPIKE — run with: npx tsx scripts/spike-agent-sdk.mts
// Confirms the three load-bearing assumptions before any feature code:
//   (a) a headless query() inherits the local Claude Code login,
//   (b) the author-widget skill (or any project skill) loads via settingSources,
//   (c) canUseTool intercepts AskUserQuestion and an injected answer resumes the turn.
// Requires a real local Claude Code login + network. NOT part of CI.
//
// ─── STATIC-INSPECTION FINDINGS (Task 2 Step 3) ─────────────────────────────
// Gathered from node_modules/@anthropic-ai/claude-agent-sdk/ — no live run.
//
// (1) INSTALLED SDK VERSION
//     0.3.150  (from node_modules/@anthropic-ai/claude-agent-sdk/package.json)
//
// (2) Options.includePartialMessages + emitted message type
//     The Options type (sdk.d.ts line 1483) declares:
//       includePartialMessages?: boolean;
//     When true, the SDK emits SDKPartialAssistantMessage events:
//       export declare type SDKPartialAssistantMessage = {
//         type: 'stream_event';
//         event: BetaRawMessageStreamEvent;
//         parent_tool_use_id: string | null;
//         uuid: UUID;
//         session_id: string;
//         ttft_ms?: number;
//       };
//     Stream-event type discriminant: message.type === 'stream_event'
//     (not 'partial_assistant' — use 'stream_event' in Task 10 to filter partials)
//
// (3) Init-message shape — session_id confirmed
//     SDKSystemMessage (sdk.d.ts line 3534):
//       export declare type SDKSystemMessage = {
//         type: 'system';
//         subtype: 'init';       ← subtype is literally 'init', NOT 'initialize'
//         session_id: string;    ← session_id is present on the init message
//         agents?: string[];
//         apiKeySource: ApiKeySource;
//         betas?: string[];
//         claude_code_version: string;
//         cwd: string;
//         tools: string[];
//         mcp_servers: { name: string; status: string; }[];
//         model: string;
//         permissionMode: PermissionMode;
//         slash_commands: string[];
//         output_style: string;
//         skills: string[];
//         plugins: { name: string; path: string; }[];
//         fast_mode_state?: FastModeState;
//         uuid: UUID;
//       };
//     Capture pattern: message.type === 'system' && message.subtype === 'init'
//     NOTE: the spike's cast uses (message as { subtype?: string }).subtype === 'init',
//     which is correct — but could also narrow via SDKSystemMessage type guard.
//
// (4) canUseTool return contract
//     PermissionResult (sdk.d.ts line 1953):
//       { behavior: 'allow'; updatedInput?: Record<string, unknown>; ... }
//       | { behavior: 'deny'; message: string; ... }
//     Key findings:
//     - updatedInput is camelCase ('updatedInput'), confirmed at sdk.d.ts lines 1955, 2098.
//     - permissionMode: 'default' — the SDKPermissionDeniedMessage docstring (line 3308)
//       states: "The 'ask' path surfaces via a can_use_tool control_request; this event
//       covers the 'deny' short-circuit in canUseTool so SDK hosts can render the denial."
//       The types do NOT explicitly declare that canUseTool is disabled under
//       bypassPermissions/dontAsk/auto, but the 'default' mode ("prompts for dangerous
//       operations") is where the can_use_tool control path is active. Using 'default'
//       is the correct safe choice; whether other modes also invoke canUseTool
//       REQUIRES MANUAL RUN TO CONFIRM.
//     - settingSources: loading skills via settingSources: ['user', 'project'] — that
//       REQUIRES MANUAL RUN TO CONFIRM (no static proof skill files are dispatched
//       through this code path without running the subprocess).
// ─────────────────────────────────────────────────────────────────────────────
// TSCONFIG NOTE: tsconfig.json uses include: ["**/*.ts", "**/*.tsx"] — the glob
// **/*.ts does NOT match .mts files, so this file is excluded from the project's
// tsc --noEmit check. npx tsx can still run it directly.
// ─────────────────────────────────────────────────────────────────────────────

import { query } from "@anthropic-ai/claude-agent-sdk";

async function main() {
  let sessionId: string | undefined;
  let sawQuestion = false;

  for await (const message of query({
    // Ask the model to use AskUserQuestion so we can prove the bridge fires.
    prompt:
      "Use the AskUserQuestion tool to ask me exactly one question: " +
      "'Pick a color' with options Red and Blue. Then tell me which I picked.",
    options: {
      cwd: process.cwd(),
      settingSources: ["user", "project"],
      skills: "all",
      permissionMode: "default",
      allowedTools: ["AskUserQuestion"],
      canUseTool: async (toolName, input) => {
        console.log("[canUseTool]", toolName);
        if (toolName === "AskUserQuestion") {
          sawQuestion = true;
          const q = (input as { questions: Array<{ question: string }> }).questions[0];
          // Inject a scripted answer — no human prompt in the spike.
          return {
            behavior: "allow",
            updatedInput: { ...input, answers: { [q.question]: "Blue" } },
          };
        }
        return { behavior: "allow", updatedInput: input };
      },
    },
  })) {
    if (message.type === "system" && (message as { subtype?: string }).subtype === "init") {
      sessionId = (message as { session_id: string }).session_id;
      console.log("[init] session", sessionId);
    }
    if (message.type === "result") {
      console.log("[result]", (message as { result?: string }).result);
    }
  }

  console.log("\nSPIKE RESULT:");
  console.log("  session captured:", Boolean(sessionId));
  console.log("  AskUserQuestion intercepted:", sawQuestion);
  if (!sessionId || !sawQuestion) process.exit(1);
}

main().catch((e) => {
  console.error("SPIKE FAILED:", e);
  process.exit(1);
});
