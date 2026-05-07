# Switchboard

The verdict layer for knowledge workers. A single page that reads from your existing
work tools and renders **factual** progress against goals you defined.

> Scoreboard, not coach.

v1 is a screenshot-worthy weekly Verdict Poster for GitHub PR activity. North Star,
Verdict, Receipts, Drag, Momentum, Monday Move.

## Quick start (localhost)

```bash
git clone https://github.com/onkarsingh/switchboard
cd switchboard
npm install

# Generate a GitHub token with the LEAST scopes you need:
#   public_repo + read:user   (personal use, public repos)
#   repo:read + read:user     (if scanning private repos)
export GITHUB_TOKEN=ghp_xxx

# Edit your goals:
$EDITOR switchboard.config.ts

npm run dev
# open http://localhost:8000
```

## Try it without a token (mock data)

```bash
SWITCHBOARD_FORCE_MOCK=1 npm run dev
```

## Configuration

`switchboard.config.ts` is your goals file. v1 supports exactly one goal of kind
`github_prs_merged`:

```ts
{
  kind: "github_prs_merged",
  label: "Ship 5 PRs this week",
  target: 5,
  unit: "PR",
  repos: ["owner/repo", "owner/other-repo"],
  author: "your-github-login",
}
```

## Verdict status bands

| Ratio (actual / target) | Headline prefix |
|---|---|
| ≥ 1.0 | Shipped |
| 0.8 – 1.0 | On track |
| 0.5 – 0.8 | Halfway |
| < 0.5 | Behind |

If any open PR has gone untouched for >24h, a Drag suffix appears
("1 PR is stale (waiting >24h)").

## Security model

- `GITHUB_TOKEN` is read from the environment only. Never written to disk, never
  logged, never sent off-host.
- No telemetry. No analytics. No remote calls except to `api.github.com`.
- All data is computed in-process. No persistence in v1.
- Server runs on `localhost`. No public binding by default.
- All operations are read-only.

## Architecture

- `lib/verdicts/engine.ts` — pure functions (`statusFor`, `headlineFor`,
  `pickMondayMove`, `bucketMomentum`, `computeVerdict`).
- `lib/mcp/adapter.ts` — `MCPAdapter` interface. v1 ships
  `OctokitGitHubAdapter` (REST search) and `MockAdapter`. v1.1 swaps in a real
  GitHub MCP server.
- `app/api/verdict/route.ts` — single GET endpoint, recomputes on every request.
- `app/page.tsx` — renders `Verdict` JSON into the poster.

## Non-goals (v1)

- No historical archive. v1 always shows the current week.
- No multi-goal config. Exactly one goal.
- No notifications. No email, no Slack DM, no push.
- No team or multi-user mode.

## License

MIT — see [LICENSE](./LICENSE).
