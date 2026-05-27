"use client";
import { useState } from "react";
import type { Job } from "@/lib/authoring/job-types";
import { AuthoringSurface } from "./AuthoringSurface";

// The single non-terminal job if one exists, else the most-recent undiscarded
// failed job (a failure occupies the surface until cleared — never a hidden
// zombie). `initialJobs` is already filtered to exclude `done` by the page.
function currentJobOf(jobs: Job[]): Job | null {
  const live = jobs.find((j) => j.state !== "done" && j.state !== "failed");
  if (live) return live;
  const failed = jobs.filter((j) => j.state === "failed").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return failed[0] ?? null;
}

export function AddWidgetButton({ initialJobs }: { initialJobs: Job[] }) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [draftOpen, setDraftOpen] = useState(false);
  const current = currentJobOf(jobs);

  const upsert = (job: Job) => setJobs((prev) => (prev.some((j) => j.id === job.id) ? prev.map((j) => (j.id === job.id ? job : j)) : [...prev, job]));
  const remove = (id: string) => setJobs((prev) => prev.filter((j) => j.id !== id));

  // A current job exists → the surface IS the entry point (strictly serial falls
  // out: no second-job affordance). Otherwise show the surface in draft mode if
  // the user opened it, else just the + Add widget button.
  if (current) {
    return (
      <AuthoringSurface
        job={current}
        onCreated={upsert}
        onUpdate={(j) => (j.state === "done" ? remove(j.id) : upsert(j))}
        onGone={remove}
        onCloseDraft={() => setDraftOpen(false)}
      />
    );
  }
  if (draftOpen) {
    return (
      <AuthoringSurface
        job={null}
        onCreated={(j) => { setDraftOpen(false); upsert(j); }}
        onUpdate={upsert}
        onGone={remove}
        onCloseDraft={() => setDraftOpen(false)}
      />
    );
  }
  return (
    <button onClick={() => setDraftOpen(true)} className="border border-stone-900 px-3 py-1.5 text-sm">+ Add widget</button>
  );
}
