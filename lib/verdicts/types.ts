export type GoalKind = "github_prs_merged";

export interface GoalConfig {
  kind: GoalKind;
  label: string;
  target: number;
  unit: string;
  repos: string[];
  author: string;
  timeWindow?: "this_week";
}

export interface Receipt {
  id: string;
  title: string;
  url: string;
  repo: string;
  prNumber: number;
  mergedAt?: string;
  openedAt: string;
  hoursSinceUpdate?: number;
}

export type VerdictStatus = "shipped" | "on_track" | "nearly_there" | "behind";

export interface Verdict {
  goal: GoalConfig;
  status: VerdictStatus;
  headline: string;
  actual: number;
  target: number;
  receipts: Receipt[];
  drag: Receipt[];
  momentum: number[];
  mondayMove: string | null;
}

export interface SwitchboardConfig {
  goals: GoalConfig[];
}
