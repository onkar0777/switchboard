"use client";
import { useEffect, useState } from "react";
import type { Job } from "@/lib/authoring/job-types";
import { EYEBROW } from "@/lib/design-tokens";

// Collapsible dock tracking in-flight jobs (model B). The grid stays clean; a
// widget joins the grid only when its job is done (page reload picks it up from
// dashboard.layout.json). building → phase + elapsed; needs_input → amber Answer;
// queued → waiting; failed → reason + Refine/Discard.
export function BuildDock({ initialJobs }: { initialJobs: Job[] }) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const active = jobs.filter((j) => j.state !== "done" && j.state !== "failed");
    const streams = active.map((j) => {
      const es = new EventSource(`/api/widgets/${j.id}/events`);
      es.onmessage = (e) => {
        const next = JSON.parse(e.data) as Job | null;
        if (next) setJobs((prev) => prev.map((p) => (p.id === next.id ? next : p)));
      };
      return es;
    });
    return () => streams.forEach((es) => es.close());
  }, [jobs.map((j) => j.id + j.state).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const tracked = jobs.filter((j) => j.state !== "done");
  if (tracked.length === 0) return null;

  async function answer(job: Job, answers: Record<string, string | string[]>) {
    await fetch(`/api/widgets/${job.id}/answer`, { method: "POST", body: JSON.stringify({ kind: "answer", answers }) });
  }

  return (
    <div className="fixed bottom-0 right-0 z-40 m-4 w-80 border border-stone-200 bg-stone-50">
      <button onClick={() => setOpen((o) => !o)} className={`flex w-full items-center justify-between px-4 py-2 ${EYEBROW}`}>
        <span>⠿ Builds ({tracked.length})</span>
        <span>{open ? "–" : "+"}</span>
      </button>
      {open && (
        <ul className="divide-y divide-stone-200">
          {tracked.map((job) => (
            <li key={job.id} className="px-4 py-3 text-sm">
              <p className="truncate font-serif text-base">{job.intent}</p>
              {job.state === "building" && <p className="font-mono text-xs text-stone-500">{job.phase ?? "building"}…</p>}
              {job.state === "queued" && <p className="font-mono text-xs text-stone-500">queued</p>}
              {job.state === "needs_input" && job.pendingQuestion && (
                <NeedsInputQuestion
                  key={job.pendingQuestion.toolUseId}
                  question={job.pendingQuestion.questions[0]}
                  onAnswer={(value) => answer(job, { [job.pendingQuestion!.questions[0].question]: value })}
                />
              )}
              {job.state === "failed" && (
                <div className="mt-1">
                  <p className="text-rose-700">{job.failureReason}</p>
                  <p className="font-mono text-xs text-stone-500">Refine / Discard</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// A needs_input question in the dock: suggested options plus a free-text input,
// so the author isn't boxed into the offered choices. Own component to hold the
// custom-answer draft per job.
function NeedsInputQuestion({
  question,
  onAnswer,
}: {
  question: NonNullable<Job["pendingQuestion"]>["questions"][number];
  onAnswer: (value: string) => void;
}) {
  const [custom, setCustom] = useState("");
  return (
    <div className="mt-2 border-l-2 border-amber-600 bg-amber-50 p-2">
      <p className="text-amber-700">{question.question}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {question.options.map((o) => (
          <button key={o.label} onClick={() => onAnswer(o.label)}
            className="border border-amber-600 px-2 py-1 text-xs text-amber-700">{o.label}</button>
        ))}
      </div>
      <div className="mt-2 flex gap-1">
        <input value={custom} onChange={(e) => setCustom(e.target.value)}
          className="min-w-0 flex-1 border border-amber-600 bg-white px-2 py-1 font-mono text-xs"
          placeholder="Or type your own…"
          onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) onAnswer(custom.trim()); }} />
        <button onClick={() => onAnswer(custom.trim())} disabled={!custom.trim()}
          className="border border-amber-600 px-2 py-1 text-xs text-amber-700 disabled:opacity-40">Send</button>
      </div>
    </div>
  );
}
