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

# Switchboard reads your PR activity through GitHub's official remote MCP server
# (https://api.githubcopilot.com/mcp/). Supply a GitHub Personal Access Token —
# it's the only secret you provide. Generate one with the LEAST scopes you need:
#   public_repo + read:user   (personal use, public repos)
#   repo + read:user          (if scanning private repos)
cp .env.example .env.local
$EDITOR .env.local            # set GITHUB_PAT=ghp_xxx  (.env.local is gitignored)

# Edit your goals:
$EDITOR switchboard.config.ts

npm run dev
# open http://localhost:8000
```

The token is interpolated into the `Authorization: Bearer` header defined in
`mcp/github.json` at request time. If `GITHUB_PAT` is unset, the dashboard widget
reports "Can't reach the github MCP server" instead of rendering — set the token,
or use the mock path below.

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

For personal use without touching the committed default, copy
`switchboard.config.ts` to `switchboard.config.local.ts` — it's gitignored, and
the runtime prefers it when present.

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

- `GITHUB_PAT` is read from the environment only (via `.env.local` or your shell).
  Never written to disk by the app, never logged, never sent anywhere except as
  the `Authorization` header to the GitHub MCP server.
- No telemetry. No analytics. No remote calls except to `api.githubcopilot.com`.
- All data is computed in-process. No persistence in v1.
- Server runs on `localhost`. No public binding by default.
- All operations are read-only.

## Architecture

- `lib/widgets/dsl/` + `lib/widgets/runtime.ts` — the verdict pipeline DSL
  (declared per widget in `spec.json`) and the pure runtime that evaluates it
  into a verdict/status/slots output. Shared helpers: `lib/widgets/week.ts`
  (week boundaries), `lib/format.ts` (`pluralize`).
- `lib/mcp/adapter.ts` — `MCPAdapter` interface. `MockAdapter` backs the
  `SWITCHBOARD_FORCE_MOCK=1` data path. Live data flows through a
  real MCP server: `lib/mcp/client-manager.ts` (transport, timeout, retry,
  concurrency cap) feeding `lib/widgets/mcp-data.ts`, configured per
  `mcp/<server>.json`.
- `lib/widgets/load-widget.ts` — loads a widget server-side (spec → MCP data →
  pure runtime), deriving the widget `state`.
- `app/page.tsx` — renders widgets through the runtime into the dashboard grid.

## Non-goals (v1)

- No historical archive. v1 always shows the current week.
- No multi-goal config. Exactly one goal.
- No notifications. No email, no Slack DM, no push.
- No team or multi-user mode.

## License

MIT — see [LICENSE](./LICENSE).
