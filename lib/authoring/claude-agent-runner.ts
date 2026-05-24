import { query } from "@anthropic-ai/claude-agent-sdk";
import type { AgentEvents, AgentResult, AgentRunInput, AgentRunner } from "./agent-runner";
import { parseMarkers } from "./agent-runner";

// Real runner: drives a headless Claude Code session. canUseTool intercepts
// AskUserQuestion and injects the user's answers (the only in-app interaction
// channel). Auth is inherited from the local Claude Code login — no API key,
// no Anthropic client (AC9). Skills load from the filesystem via settingSources.
export class ClaudeAgentRunner implements AgentRunner {
  async run(input: AgentRunInput, events: AgentEvents): Promise<AgentResult> {
    let sessionId: string | undefined;
    let error: string | undefined;

    try {
      for await (const message of query({
        prompt: input.prompt,
        options: {
          cwd: input.cwd,
          settingSources: ["user", "project"],
          skills: "all",
          permissionMode: "default",
          resume: input.resume,
          // Allow the orchestrator to author files, run tests, dispatch subagents,
          // and ask questions. The skill frontmatter tool list is ignored in the
          // SDK, so the gate is here.
          allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Agent", "AskUserQuestion"],
          // canUseTool signature requires a third `options` argument (AbortSignal + metadata).
          // SDK type: CanUseTool = (toolName: string, input: Record<string, unknown>,
          //   options: { signal: AbortSignal; suggestions?: ...; toolUseID: string; ... })
          //   => Promise<PermissionResult>
          canUseTool: async (toolName, toolInput, _options) => {
            if (toolName === "AskUserQuestion") {
              const qi = toolInput as {
                questions: Array<{ question: string; header: string; options: Array<{ label: string; description: string }>; multiSelect: boolean }>;
              };
              const answers = await events.onQuestion({
                toolUseId: `q-${Date.now()}`,
                questions: qi.questions,
              });
              return { behavior: "allow", updatedInput: { ...toolInput, answers } };
            }
            return { behavior: "allow", updatedInput: toolInput };
          },
        },
      })) {
        // Capture session id from the init system message (durable resume).
        // SDKSystemMessage has type: 'system' and subtype: 'init' with session_id: string.
        if (message.type === "system" && (message as { subtype?: string }).subtype === "init") {
          sessionId = (message as { session_id: string }).session_id;
          events.onSession(sessionId);
        }
        // Progress + markers from assistant text. (If the spike found
        // includePartialMessages stream_event deltas more granular, prefer those.)
        if (message.type === "assistant") {
          const blocks = (message as { message: { content: Array<{ type: string; text?: string }> } }).message.content;
          for (const b of blocks) {
            if (b.type === "text" && b.text) {
              events.onProgress(b.text);
              for (const marker of parseMarkers(b.text)) events.onMarker(marker);
            }
          }
        }
        // SDKResultError has `errors: string[]`; SDKResultSuccess has `result: string`.
        // The plan's `r.result` cast works for success; for error subtypes we fall back
        // to `r.errors[0]` (SDKResultError) or a generic message.
        if (message.type === "result") {
          const r = message as {
            subtype: string;
            result?: string;
            errors?: string[];
          };
          if (r.subtype !== "success") {
            error = r.result ?? r.errors?.[0] ?? `agent ended: ${r.subtype}`;
          }
        }
      }
    } catch (e) {
      error = (e as Error).message;
    }

    return { sessionId, endedTurn: true, error };
  }
}
