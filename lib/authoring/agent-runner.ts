import type { BuildPhase, PendingQuestion } from "./job-types";

// Markers the orchestrator skill emits in plain text; the driver parses them
// into structured events (the skill↔driver contract).
export type Marker =
  | { kind: "phase"; phase: BuildPhase }
  | { kind: "summary"; text: string }
  | { kind: "done"; widgetName: string }
  | { kind: "failed"; reason: string };

const PHASE_RE = /\[\[phase:(planning|implementing|testing|dry-run)\]\]/g;
const SUMMARY_RE = /\[\[summary\]\]([\s\S]*?)\[\[\/summary\]\]/g;
const DONE_RE = /\[\[done:([^\]]+)\]\]/g;
const FAILED_RE = /\[\[failed:([^\]]+)\]\]/g;

export function parseMarkers(text: string): Marker[] {
  const out: Marker[] = [];
  for (const m of text.matchAll(SUMMARY_RE)) out.push({ kind: "summary", text: m[1].trim() });
  for (const m of text.matchAll(PHASE_RE)) out.push({ kind: "phase", phase: m[1] as BuildPhase });
  for (const m of text.matchAll(DONE_RE)) out.push({ kind: "done", widgetName: m[1].trim() });
  for (const m of text.matchAll(FAILED_RE)) out.push({ kind: "failed", reason: m[1].trim() });
  return out;
}

// What the question bridge needs: the pending question and a resolver that
// yields the injected answers map ({ <questionText>: label | label[] }).
export type QuestionAnswers = Record<string, string | string[]>;

export interface AgentEvents {
  onSession(id: string): void;
  onProgress(text: string): void; // raw assistant text (drives the dock + marker parse)
  onMarker(marker: Marker): void;
  onQuestion(pending: PendingQuestion): Promise<QuestionAnswers>;
}

export interface AgentRunInput {
  prompt: string;
  cwd: string;
  resume?: string; // SDK session id to resume
}

export interface AgentResult {
  sessionId?: string;
  endedTurn: boolean; // true when the query() turn completed (result message)
  error?: string;
}

export interface AgentRunner {
  run(input: AgentRunInput, events: AgentEvents): Promise<AgentResult>;
}
