import type { Receipt } from "@/lib/verdicts/types";

// Fixture date base: 2026-05-06 (Wednesday).
// Week of "now": Mon 2026-05-04 -> Sun 2026-05-10 (system TZ; UTC in tests).
// Trailing 4 weeks (oldest -> current):
//   W0: 2026-04-13..2026-04-19  (3 merged)
//   W1: 2026-04-20..2026-04-26  (5 merged)
//   W2: 2026-04-27..2026-05-03  (4 merged)
//   W3: 2026-05-04..2026-05-10  (4 merged + 2 open of which 1 stale)
export const MOCK_PRS: Receipt[] = [
  // --- W0 ---
  pr({ id: "W0_1", num: 100, repo: "onkarsingh/switchboard", title: "Bootstrap repo",            opened: "2026-04-13T09:00:00Z", merged: "2026-04-14T17:00:00Z" }),
  pr({ id: "W0_2", num: 101, repo: "onkarsingh/switchboard", title: "Add MIT license",           opened: "2026-04-14T10:00:00Z", merged: "2026-04-15T11:00:00Z" }),
  pr({ id: "W0_3", num: 102, repo: "onkarsingh/other-repo",  title: "Type-safe config loader",   opened: "2026-04-16T08:00:00Z", merged: "2026-04-19T14:00:00Z" }),
  // --- W1 ---
  pr({ id: "W1_1", num: 103, repo: "onkarsingh/switchboard", title: "Sketch verdict types",      opened: "2026-04-20T09:00:00Z", merged: "2026-04-20T16:00:00Z" }),
  pr({ id: "W1_2", num: 104, repo: "onkarsingh/switchboard", title: "Adapter interface",         opened: "2026-04-21T08:00:00Z", merged: "2026-04-21T18:00:00Z" }),
  pr({ id: "W1_3", num: 105, repo: "onkarsingh/switchboard", title: "Mock fixtures",             opened: "2026-04-22T11:00:00Z", merged: "2026-04-22T20:00:00Z" }),
  pr({ id: "W1_4", num: 106, repo: "onkarsingh/other-repo",  title: "Fix broken link",           opened: "2026-04-24T12:00:00Z", merged: "2026-04-24T13:00:00Z" }),
  pr({ id: "W1_5", num: 107, repo: "onkarsingh/switchboard", title: "Engine status bands",       opened: "2026-04-25T09:00:00Z", merged: "2026-04-26T19:00:00Z" }),
  // --- W2 ---
  pr({ id: "W2_1", num: 108, repo: "onkarsingh/switchboard", title: "Octokit adapter",           opened: "2026-04-27T08:00:00Z", merged: "2026-04-27T18:30:00Z" }),
  pr({ id: "W2_2", num: 109, repo: "onkarsingh/switchboard", title: "API route /api/verdict",    opened: "2026-04-28T08:00:00Z", merged: "2026-04-29T17:00:00Z" }),
  pr({ id: "W2_3", num: 110, repo: "onkarsingh/switchboard", title: "Sparkline component",       opened: "2026-04-30T09:00:00Z", merged: "2026-05-01T15:00:00Z" }),
  pr({ id: "W2_4", num: 111, repo: "onkarsingh/other-repo",  title: "Refactor logger",           opened: "2026-05-02T11:00:00Z", merged: "2026-05-03T10:00:00Z" }),
  // --- W3 (current week, partial) ---
  pr({ id: "W3_1", num: 112, repo: "onkarsingh/switchboard", title: "Wire mock adapter end-to-end", opened: "2026-05-04T08:00:00Z", merged: "2026-05-04T16:00:00Z" }),
  pr({ id: "W3_2", num: 113, repo: "onkarsingh/switchboard", title: "Verdict header polish",     opened: "2026-05-04T19:00:00Z", merged: "2026-05-05T11:00:00Z" }),
  pr({ id: "W3_3", num: 114, repo: "onkarsingh/switchboard", title: "Drag card layout",          opened: "2026-05-05T09:00:00Z", merged: "2026-05-05T20:00:00Z" }),
  pr({ id: "W3_4", num: 115, repo: "onkarsingh/other-repo",  title: "Bump deps",                 opened: "2026-05-06T08:00:00Z", merged: "2026-05-06T09:30:00Z" }),
  // open, stale: last update 2026-05-04 (>24h before 2026-05-06T12:00 mock-now)
  pr({ id: "W3_O1", num: 116, repo: "onkarsingh/switchboard", title: "Refactor verdict engine internals", opened: "2026-05-04T10:00:00Z", hoursSinceUpdate: 50 }),
  // open, fresh: updated 6h ago
  pr({ id: "W3_O2", num: 117, repo: "onkarsingh/switchboard", title: "Tighten Tailwind palette",          opened: "2026-05-06T06:00:00Z", hoursSinceUpdate: 6 }),
];

function pr(p: {
  id: string;
  num: number;
  repo: string;
  title: string;
  opened: string;
  merged?: string;
  hoursSinceUpdate?: number;
}): Receipt {
  return {
    id: p.id,
    prNumber: p.num,
    repo: p.repo,
    title: p.title,
    url: `https://github.com/${p.repo}/pull/${p.num}`,
    openedAt: p.opened,
    mergedAt: p.merged,
    hoursSinceUpdate: p.hoursSinceUpdate,
  };
}
