// lib/authoring/runner-singleton.ts
import { JobStore } from "./job-store";
import { JobRunner } from "./job-runner";
import { ClaudeAgentRunner } from "./claude-agent-runner";
import { landPackage } from "./landing";
import { join } from "node:path";

declare global {
  // eslint-disable-next-line no-var
  var __sbRunner: JobRunner | undefined;
}

// One runner per server process (serial builds). Resumes any interrupted build
// on first construction. Hung off globalThis so Next.js dev hot-reload does not
// spawn duplicates.
export function getRunner(): JobRunner {
  if (!globalThis.__sbRunner) {
    const root = process.cwd();
    const runner = new JobRunner({
      store: new JobStore(join(root, ".switchboard", "jobs")),
      agent: new ClaudeAgentRunner(),
      root,
      land: landPackage,
    });
    void runner.resumeInterrupted();
    globalThis.__sbRunner = runner;
  }
  return globalThis.__sbRunner;
}
