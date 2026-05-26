"use client";
import { useEffect, useState } from "react";
import type { Job } from "@/lib/authoring/job-types";
import { EYEBROW } from "@/lib/design-tokens";
import { SummaryMarkdown } from "./SummaryMarkdown";

type Mode = "expanded" | "collapsed";

// States whose default is the focal expanded panel (they need the user). queued/
// building default to the ignorable collapsed chip.
function defaultMode(state: Job["state"]): Mode {
  return state === "queued" || state === "building" ? "collapsed" : "expanded";
}

// The single collapsible authoring surface bound to the one current job (or null
// for intent entry). Recovery is its default behavior: on load it simply renders
// the current job in the mode its state implies — expanded if it needs the user,
// a chip if it's mid-build. The same code runs with no restart at all.
export function AuthoringSurface({
  job,
  onCreated,
  onUpdate,
  onGone,
  onCloseDraft,
}: {
  job: Job | null;
  onCreated: (job: Job) => void;
  onUpdate: (job: Job) => void;
  onGone: (id: string) => void;
  onCloseDraft: () => void;
}) {
  const [intent, setIntent] = useState("");
  const [feedback, setFeedback] = useState("");
  // Manual override of the default mode, respected until the state changes.
  const [manual, setManual] = useState<Mode | null>(null);
  useEffect(() => setManual(null), [job?.state]);

  // One EventSource for the bound job. `data: null` means the job is gone.
  useEffect(() => {
    if (!job) return;
    const es = new EventSource(`/api/widgets/${job.id}/events`);
    es.onmessage = (e) => {
      const next = JSON.parse(e.data) as Job | null;
      if (next) onUpdate(next);
      else { onGone(job.id); es.close(); }
    };
    return () => es.close();
  }, [job?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitIntent() {
    const res = await fetch("/api/widgets", { method: "POST", body: JSON.stringify({ intent }) });
    const { job: created } = (await res.json()) as { job: Job };
    setIntent("");
    onCreated(created);
  }
  async function answer(answers: Record<string, string | string[]>) {
    await fetch(`/api/widgets/${job!.id}/answer`, { method: "POST", body: JSON.stringify({ kind: "answer", answers }) });
  }
  async function proceed() {
    await fetch(`/api/widgets/${job!.id}/answer`, { method: "POST", body: JSON.stringify({ kind: "proceed" }) });
  }
  async function giveFeedback() {
    await fetch(`/api/widgets/${job!.id}/answer`, { method: "POST", body: JSON.stringify({ kind: "feedback", text: feedback }) });
    setFeedback("");
  }
  async function discard() {
    await fetch(`/api/widgets/${job!.id}`, { method: "DELETE" });
    onGone(job!.id); // optimistic: drop locally on the 200
  }

  // --- Intent entry (no bound job) — expanded sidebar -----------------------
  if (!job) {
    return (
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-stone-200 bg-stone-50 p-8" role="dialog" aria-label="Add a widget">
        <div className="flex items-baseline justify-between">
          <p className={EYEBROW}>Add a widget</p>
          <button onClick={onCloseDraft} className="text-sm text-stone-500 underline">Close</button>
        </div>
        <div className="mt-6 space-y-3">
          <label className="block font-serif text-[22px] leading-snug">What should this widget track?</label>
          <textarea value={intent} onChange={(e) => setIntent(e.target.value)} rows={3}
            className="w-full border border-stone-300 bg-white p-3 font-mono text-sm" placeholder="e.g. How fresh are my team's Confluence docs?" />
          <button onClick={submitIntent} disabled={!intent.trim()}
            className="border border-stone-900 px-4 py-2 text-sm disabled:opacity-40">Start</button>
        </div>
      </div>
    );
  }

  const mode: Mode = manual ?? defaultMode(job.state);
  const canDiscard = job.state !== "building" && job.state !== "done";

  // --- Collapsed chip (bottom-right) ---------------------------------------
  if (mode === "collapsed") {
    return (
      <div className="fixed bottom-0 right-0 z-40 m-4 w-80 border border-stone-200 bg-stone-50">
        <button onClick={() => setManual("expanded")} className={`flex w-full items-center justify-between px-4 py-2 ${EYEBROW}`}>
          <span>⠿ {job.state === "queued" ? "Queued" : job.phase ?? "Building"}…</span>
          <span>+</span>
        </button>
        <div className="px-4 pb-3">
          <p className="truncate font-serif text-base">{job.intent}</p>
          {canDiscard && <button onClick={discard} className="mt-1 text-sm text-stone-500 underline">Discard</button>}
        </div>
      </div>
    );
  }

  // --- Expanded sidebar -----------------------------------------------------
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-stone-200 bg-stone-50 p-8" role="dialog" aria-label="Authoring">
      <div className="flex items-baseline justify-between">
        <p className={EYEBROW}>{job.state === "failed" ? "Build failed" : "Add a widget"}</p>
        <button onClick={() => setManual("collapsed")} className="text-sm text-stone-500 underline">Collapse</button>
      </div>

      <p className="mt-4 truncate font-serif text-base text-stone-500">{job.intent}</p>

      {(job.state === "clarifying" || job.state === "needs_input") && job.pendingQuestion && (
        <QuestionForm key={job.pendingQuestion.toolUseId} pending={job.pendingQuestion} onAnswer={answer} />
      )}
      {job.state === "clarifying" && !job.pendingQuestion && (
        <p className="mt-6 text-sm text-stone-500">Thinking…</p>
      )}

      {job.state === "summary" && (
        <div className="mt-6 space-y-4">
          <p className={EYEBROW}>Build summary</p>
          <SummaryMarkdown text={job.summary ?? ""} />
          <div className="flex gap-3">
            <button onClick={proceed} className="border border-emerald-700 px-4 py-2 text-sm text-emerald-700">Proceed</button>
          </div>
          <div className="space-y-2 border-t border-stone-200 pt-4">
            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2}
              className="w-full border border-stone-300 bg-white p-2 font-mono text-sm" placeholder="Give feedback instead…" />
            <button onClick={giveFeedback} disabled={!feedback.trim()} className="text-sm text-stone-700 underline disabled:opacity-40">Give feedback</button>
          </div>
        </div>
      )}

      {job.state === "failed" && (
        <div className="mt-6 space-y-3">
          <p className="font-serif text-[22px] leading-snug text-rose-700">{job.failureReason}</p>
        </div>
      )}

      {canDiscard && (
        <div className="mt-8 border-t border-stone-200 pt-4">
          <button onClick={discard} className="text-sm text-stone-500 underline">Discard</button>
        </div>
      )}
    </div>
  );
}

// Shared by clarifying + needs_input: suggested options plus a free-text escape
// hatch (the options are suggestions, not a closed set).
function QuestionForm({ pending, onAnswer }: { pending: NonNullable<Job["pendingQuestion"]>; onAnswer: (a: Record<string, string | string[]>) => void }) {
  const q = pending.questions[0];
  const [custom, setCustom] = useState("");
  return (
    <div className="mt-6 space-y-3">
      <p className={EYEBROW}>{q.header}</p>
      <p className="font-serif text-[22px] leading-snug">{q.question}</p>
      <div className="space-y-2">
        {q.options.map((o) => (
          <button key={o.label} onClick={() => onAnswer({ [q.question]: o.label })}
            className="block w-full border border-stone-300 bg-white p-3 text-left text-sm hover:border-stone-900">
            <span className="font-medium">{o.label}</span>
            {o.description && <span className="block text-stone-500">{o.description}</span>}
          </button>
        ))}
      </div>
      <div className="space-y-2 border-t border-stone-200 pt-3">
        <p className={EYEBROW}>Or answer in your own words</p>
        <textarea value={custom} onChange={(e) => setCustom(e.target.value)} rows={2}
          className="w-full border border-stone-300 bg-white p-2 font-mono text-sm"
          placeholder="Type a different answer…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && custom.trim()) onAnswer({ [q.question]: custom.trim() });
          }} />
        <button onClick={() => onAnswer({ [q.question]: custom.trim() })} disabled={!custom.trim()}
          className="text-sm text-stone-700 underline disabled:opacity-40">Submit answer</button>
      </div>
    </div>
  );
}
