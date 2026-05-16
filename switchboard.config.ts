import type { SwitchboardConfig } from "./lib/verdicts/types";

const config: SwitchboardConfig = {
  goals: [
    {
      kind: "github_prs_merged",
      label: "Ship 5 PRs this week",
      target: 5,
      unit: "PR",
      repos: ["onkarsingh/switchboard"],
      author: "onkarsingh",
    },
  ],
};

export default config;
