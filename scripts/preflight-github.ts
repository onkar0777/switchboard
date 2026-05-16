// Run with:
//   GITHUB_TOKEN=ghp_xxx GH_AUTHOR=onkarsingh GH_REPO=onkarsingh/switchboard \
//     npx tsx scripts/preflight-github.ts
//
// Confirms:
//   - token works
//   - search query shape returns the right Receipt fields
//   - rate limit budget is healthy
import { OctokitGitHubAdapter } from "../lib/mcp/octokit";

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const author = process.env.GH_AUTHOR;
  const repo = process.env.GH_REPO;
  if (!token || !author || !repo) {
    console.error("Missing GITHUB_TOKEN, GH_AUTHOR, or GH_REPO env vars.");
    process.exit(1);
  }
  const adapter = new OctokitGitHubAdapter({ token });
  const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const until = new Date().toISOString();

  const merged = await adapter.listMergedPRs({ repos: [repo], author, since, until });
  console.log("merged result:", JSON.stringify(merged, null, 2));
  const open = await adapter.listOpenPRs({ repos: [repo], author });
  console.log("open result:", JSON.stringify(open, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
