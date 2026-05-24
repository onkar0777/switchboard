"use client";
import { useEffect, useState } from "react";
import type { Job } from "@/lib/authoring/job-types";
import { EYEBROW } from "@/lib/design-tokens";

// The focused intake surface (DESIGN.md Add-Widget panel). Opens from the
// top-right button. Submits an intent, then renders the orchestrator's
// clarifying questions one at a time, then the plain-language build summary with
// Proceed / Give feedback. On Proceed it drops the job into the dock and closes.
export function IntakePanel({ onClose, onBuilding }: { onClose: () => void; onBuilding: (jobId: string) => void }) {
  const [intent, setIntent] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [feedback, setFeedback] = useState("");

  // Subscribe to the job's SSE stream once created.
  useEffect(() => {
    if (!job) return;
    const es = new EventSource(`/api/widgets/${job.id}/events`);
    es.onmessage = (e) => {
      const next = JSON.parse(e.data) as Job | null;
      if (!next) return;
      setJob(next);
      if (next.state === "building" || next.state === "needs_input") {
        onBuilding(next.id);
        es.close();
        onClose();
      }
    };
    return () => es.close();
  }, [job?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitIntent() {
    const res = await fetch("/api/widgets", { method: "POST", body: JSON.stringify({ intent }) });
    const { job: created } = (await res.json()) as { job: Job };
    setJob(created);
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

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-stone-200 bg-stone-50 p-8" role="dialog" aria-label="Add a widget">
      <div className="flex items-baseline justify-between">
        <p className={EYEBROW}>Add a widget</p>
        <button onClick={onClose} className="text-sm text-stone-500 underline">Close</button>
      </div>

      {!job && (
        <div className="mt-6 space-y-3">
          <label className="block font-serif text-[22px] leading-snug">What should this widget track?</label>
          <textarea value={intent} onChange={(e) => setIntent(e.target.value)} rows={3}
            className="w-full border border-stone-300 bg-white p-3 font-mono text-sm" placeholder="e.g. How fresh are my team's Confluence docs?" />
          <button onClick={submitIntent} disabled={!intent.trim()}
            className="border border-stone-900 px-4 py-2 text-sm disabled:opacity-40">Start</button>
        </div>
      )}

      {job?.state === "clarifying" && job.pendingQuestion && (
        <QuestionForm pending={job.pendingQuestion} onAnswer={answer} />
      )}
      {job?.state === "clarifying" && !job.pendingQuestion && (
        <p className="mt-6 text-sm text-stone-500">Thinking…</p>
      )}

      {job?.state === "summary" && (
        <div className="mt-6 space-y-4">
          <p className={EYEBROW}>Build summary</p>
          <p className="font-serif text-[22px] leading-snug">{job.summary}</p>
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
    </div>
  );
}

function QuestionForm({ pending, onAnswer }: { pending: NonNullable<Job["pendingQuestion"]>; onAnswer: (a: Record<string, string | string[]>) => void }) {
  const q = pending.questions[0];
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
    </div>
  );
}
