import { Octokit } from "@octokit/rest";
import type {
  AdapterError,
  AdapterResult,
  ListMergedPRsArgs,
  ListOpenPRsArgs,
  MCPAdapter,
} from "./adapter";
import type { Receipt } from "@/lib/verdicts/types";

const RESULT_CAP = 100;

interface BuildQueryArgs {
  repos: string[];
  author: string;
  kind: "merged" | "open";
  since?: string;
  until?: string;
}

export function buildSearchQuery(args: BuildQueryArgs): string {
  const parts: string[] = ["is:pr"];
  parts.push(args.kind === "merged" ? "is:merged" : "is:open");
  parts.push(`author:${args.author}`);
  for (const repo of args.repos) parts.push(`repo:${repo}`);
  if (args.kind === "merged" && args.since && args.until) {
    const sinceDay = args.since.slice(0, 10);
    const untilDay = args.until.slice(0, 10);
    parts.push(`merged:${sinceDay}..${untilDay}`);
  }
  return parts.join(" ");
}

export function mapSearchItemToReceipt(item: any, now: Date): Receipt {
  const repoUrl: string = item.repository_url ?? "";
  const repo = repoUrl.split("/repos/").pop() ?? "";
  const updatedAt = new Date(item.updated_at);
  const hoursSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
  return {
    id: item.node_id,
    prNumber: item.number,
    title: item.title,
    url: item.html_url,
    repo,
    openedAt: item.created_at,
    mergedAt: item.pull_request?.merged_at ?? undefined,
    hoursSinceUpdate,
  };
}

function classifyError(err: unknown): AdapterError {
  const e = err as { status?: number; message?: string; response?: { headers?: Record<string, string> } };
  if (e?.status === 401 || e?.status === 403) {
    if (e?.response?.headers?.["x-ratelimit-remaining"] === "0") {
      const reset = Number(e.response.headers["x-ratelimit-reset"]);
      const retry = Number.isFinite(reset)
        ? Math.max(0, Math.round(reset - Date.now() / 1000))
        : undefined;
      return { code: "rate_limited", message: "GitHub rate limit hit", retryAfterSeconds: retry };
    }
    return { code: "auth_failed", message: e?.message ?? "auth failed" };
  }
  if (e?.status === 404) return { code: "not_found", message: e?.message ?? "not found" };
  if (e instanceof Error && /fetch|network|ENOT|ECONN/i.test(e.message)) {
    return { code: "network", message: e.message };
  }
  return { code: "unknown", message: e?.message ?? "unknown error" };
}

export class OctokitGitHubAdapter implements MCPAdapter {
  private readonly octokit: Octokit;
  private readonly now: () => Date;

  constructor(opts: { token: string; now?: () => Date }) {
    this.octokit = new Octokit({ auth: opts.token });
    this.now = opts.now ?? (() => new Date());
  }

  async listMergedPRs(args: ListMergedPRsArgs): Promise<AdapterResult<Receipt[]>> {
    const q = buildSearchQuery({
      repos: args.repos,
      author: args.author,
      kind: "merged",
      since: args.since,
      until: args.until,
    });
    return this.search(q);
  }

  async listOpenPRs(args: ListOpenPRsArgs): Promise<AdapterResult<Receipt[]>> {
    const q = buildSearchQuery({
      repos: args.repos,
      author: args.author,
      kind: "open",
    });
    return this.search(q);
  }

  private async search(q: string): Promise<AdapterResult<Receipt[]>> {
    try {
      const res = await this.octokit.rest.search.issuesAndPullRequests({
        q,
        per_page: RESULT_CAP,
      });
      const now = this.now();
      const data = res.data.items.map((i) => mapSearchItemToReceipt(i, now));
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: classifyError(err) };
    }
  }
}
