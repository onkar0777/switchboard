"use client";
import { useState } from "react";
import type { Job } from "@/lib/authoring/job-types";
import { IntakePanel } from "./IntakePanel";
import { BuildDock } from "./BuildDock";

export function AddWidgetButton({ initialJobs }: { initialJobs: Job[] }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  return (
    <>
      <button onClick={() => setPanelOpen(true)} className="border border-stone-900 px-3 py-1.5 text-sm">+ Add widget</button>
      {panelOpen && (
        <IntakePanel
          onClose={() => setPanelOpen(false)}
          onBuilding={(id) => setJobs((prev) => (prev.some((j) => j.id === id) ? prev : [...prev, { id } as Job]))}
        />
      )}
      <BuildDock initialJobs={jobs} />
    </>
  );
}
