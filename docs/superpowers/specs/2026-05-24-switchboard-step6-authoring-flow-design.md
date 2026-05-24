# Step 6 — Widget Authoring Flow

**Date:** 2026-05-24
**Status:** Design (via `/superpowers:brainstorming`). The authoring half of Step 6;
the test-architecture half is locked in
`2026-05-23-switchboard-golden-widget-test-architecture.md`. They meet at the
**widget-package contract** (`widgets/<name>/{spec.json, golden/cases.json}`).
**Supersedes** parts of the v1.2 design doc's Step 6 (see *Supersedes* below) — the
in-app Anthropic client, the bespoke forced-tool-use route, the in-memory session
Map, and the SSE-feed-as-headline are replaced by driving the user's own Claude Code.

## Why

Step 6 is the demo headline: a knowledge worker turns a natural-language intent into a
live, source-linked widget on their dashboard. The product is **authorship leverage** —
encoding "what should I care about" into a verdict without writing integration code.

The v1.2 design doc proposed building this in-app: read Claude Code credentials, build
an Anthropic SDK client, force tool use, stream prose over SSE, hold session state in a
`Map`. That re-implements — worse and from scratch — the agentic loop, clarifying-question
flow, and test-first convergence that the **superpowers** workflow already does well, and
that this repo already uses for its own engineering. Authoring widgets *consistently*
(correct DSL, the required case set, the package shape) is hard without dedicated
authoring discipline. So Step 6 **reuses superpowers as the engine** and keeps the user
entirely in the webapp. Superpowers is a hard prerequisite — a replaceable bootstrap
until/unless a bespoke authoring skill is warranted.

## Decisions locked (brainstorm outcomes)

1. **One cohesive spec** for the whole authoring flow (this document).
2. **No approval/review gates.** No "review this plan" or "approve these tests" step.
   The single human touchpoint after intake is a plain-language **build summary** with
   **Proceed / Give feedback**.
3. **Clarifying questions are first-class** — deep intent elicitation is *the* meaning
   of taking input, and questions may recur even during the build. What is rejected is
   PR-review-style config/test-plan approval, not questions.
4. **The user only ever interacts with the webapp.** Authoring is driven headlessly;
   superpowers' questions surface as in-app forms.
5. **Engine = superpowers, verbatim sub-skills**, sequenced by a thin `author-widget`
   orchestrator that swaps the heavy gates for the one light summary gate.
6. **Self-heal convergence:** golden cases written red (Phase 0), greened by subagent TDD.
7. **During-build UX = build dock** (grid stays clean; widget joins the grid when done).
8. **Serial builds** — one active at a time; the rest queue.

## Architecture — the bridge

The Next.js backend runs a headless Claude Code session via the **Claude Agent SDK**
(`@anthropic-ai/claude-agent-sdk`, `query()`), not a subprocess. Verified against the
Claude Code docs:

- **Question bridge:** the SDK's **`canUseTool` callback intercepts `AskUserQuestion`**.
  The callback pauses the session, ships `{question, options, multiSelect}` to the
  browser, and on the user's reply returns `PermissionResultAllow` with `updated_input`
  carrying `answers`. This is the *only* in-app interaction channel.
- **Progress:** `includePartialMessages: true` emits tool-call / text-delta events that
  drive the build dock.
- **Auth:** a headless session **inherits the user's local Claude Code login
  automatically**. We do not read credentials or build an Anthropic client. (`ANTHROPIC_API_KEY`
  / `CLAUDE_CODE_OAUTH_TOKEN` remain an optional, deferred BYOK fallback.)
- **Durability:** sessions resume by `session_id`, so a multi-hour job survives a
  backend restart.

**Constraint that shapes the design:** *subagents cannot call `AskUserQuestion`.* Since
subagent-driven TDD is the execution model, a worker that hits a genuine ambiguity
**returns a "needs clarification" result** to the main orchestrator, which asks the user
(main session → `canUseTool` → dock), then re-dispatches. Mid-build questions therefore
route through the orchestrator, never the worker.

**Headless note:** `/command` syntax does not work headless; the orchestrator invokes
superpowers sub-skills by instruction, not `/brainstorming`.

```
BROWSER (dashboard · intake panel · build dock)
  │  intent · answers        ▲  questions · progress · result
  ▼  (SSE / WebSocket)        │
NEXT.JS BACKEND — job runner
  │  query() @anthropic-ai/claude-agent-sdk
  │   • includePartialMessages → progress → dock
  │   • canUseTool intercepts AskUserQuestion → pause → ask browser → inject → resume
  │   • resume: session_id (durable job store)   • auth: inherits local CC login
  ▼
SKILL author-widget (thin orchestrator, .claude/skills)
  ├─ brainstorming (verbatim) → intent Qs        [main session — can ask]
  ├─ build summary → Proceed / Feedback          [light gate]
  └─ writing-plans + subagent TDD execution      [background, hours]
       worker ambiguity → "needs clarification" → orchestrator asks → re-dispatch
  ▼
DISK widgets/<name>/{spec.json, golden/cases.json} + dashboard.layout.json (atomic)
  ▼  dashboard reads package → widget joins grid
```

## The `author-widget` orchestrator skill

A thin skill in `.claude/skills` that reuses superpowers techniques but is tuned for
autonomous, gate-light authoring:

1. Run **brainstorming** to elicit intent (questions surface in-app).
2. Emit a one-paragraph **build summary** → Proceed / Feedback. Feedback loops back to
   questions; Proceed advances. This *replaces* brainstorming's design-approval and
   writing-plans' plan-approval gates.
3. On Proceed: **writing-plans** with **Phase 0 = `golden/cases.json`** (the required
   case set, written red), then implementation phases.
4. **Subagent-driven execution** — TDD until golden greens *in-process*, then **dry-run
   the spec against the real MCP** (the transport smoke, at authoring time).
5. Emit `widgets/<name>/{spec.json, golden/cases.json}` and **atomically append** the id
   to `dashboard.layout.json`.

The required case set (per the locked test-arch spec): empty / happy / boundary /
over-target / tool-error / unauthorized.

## Job lifecycle

Each "Add Widget" creates a **durable job** at `.switchboard/jobs/<id>.json`
holding `{intent, state, session_id, timestamps, pendingQuestion?, failureReason?,
widgetName?}`. State machine:

```
queued → clarifying → summary ─(feedback)─▶ clarifying
                          │ proceed
                          ▼
                       building ──▶ needs_input ─(answer)─▶ building
                          ├──▶ done    (package written + layout appended → grid)
                          └──▶ failed  (reason + Refine / Discard)
```

- **Durable** because a build can run hours and must survive a backend restart (resume
  the SDK session by id, reattach the dock). This replaces the design doc's in-memory
  session Map and its "session lost — re-issue" UX. If a session genuinely cannot
  resume, the job goes `failed` with a clear message.
- **Serial:** one active build; additional submissions sit in `queued`.
- **Atomic landing:** the package + layout append are written tmp-then-rename, only on
  success. A crash mid-build cannot corrupt `dashboard.layout.json` or leave a partial
  widget on the grid.

## Intake surface + summary gate

Interactive intake (minutes) lives in a focused panel opened by the top-right **Add
Widget** button — separate from the dock, which owns only the background phase.

1. **Intent** — a single free-text prompt ("What should this widget track?").
2. **Clarifying questions** — brainstorming's questions, one at a time, rendered as
   in-app option forms (sourced via `canUseTool`); answering resumes the session.
3. **Build summary** — a plain-language paragraph of what will be built (source MCP +
   tool, the verdict shape, the status rule) with **Proceed / Give feedback**. Not a
   plan review. Proceed drops the job into the dock and closes the panel.

## Build dock UX (model B)

A collapsible dock (`⠿ BUILDS (n)`) tracks in-flight jobs; the grid stays clean until a
widget is done.

- **building** — phase + elapsed (`planning → implementing → testing(golden) →
  dry-run`).
- **needs_input** — amber alert with an **Answer** affordance that surfaces the
  orchestrator's question inline.
- **queued** — waiting for the serial slot.
- **done** — the widget joins the grid; the row leaves the dock.
- **failed** — human-readable reason + **Refine** (re-open intake carrying context) /
  **Discard**.

## Persistence & integration with the locked golden test architecture

- Output is exactly the locked package shape: `widgets/<name>/{spec.json,
  golden/cases.json}`. `dashboard.layout.json` is the ordered id list (authored order,
  per DESIGN.md v1.2); append is atomic.
- **`cases.json` = writing-plans Phase 0** — the ATDD seam the test-arch spec described,
  now produced by the real machinery.
- The locked **generic `structure` / `golden` / `transport-smoke` suites** are
  parametrized over `widgets/*`, so a new package is covered automatically (and the
  min-widget-count guard trips if it is malformed/missing).
- **Self-heal vs CI:** the self-heal loop runs golden *in-process* during the build; the
  same cases run at the PR gate — same cases, two moments. The **save-time dry-run is the
  per-widget transport smoke**, run before the package lands.
- **Render:** the dashboard reads `dashboard.layout.json`, loads each package via the
  existing generic `loadWidget`, and renders the grid. A per-widget **`/[id]/data`**
  route serves `on_view` refresh.

## Testing strategy (two-gate)

- **Fast gate (deterministic seams, fake Agent SDK):** job runner, state machine, durable
  job store, restart→resume, atomic write (lands only on success), layout append, and the
  **question bridge** — feed a canned event stream + a scripted
  `canUseTool(AskUserQuestion)` prompt; assert the question reaches the UI, the injected
  answer resumes the session, progress drives the dock, and `failed` yields a reason +
  Refine/Discard. No network, no real agent.
- **Slow/gated eval (acceptance, not prose-grading):** run representative intents
  end-to-end and assert the **emitted package passes the locked `structure` + `golden` +
  `transport-smoke` suites** (dry-run vs the stub-MCP). Authoring's bar: *given intent X,
  the produced package is valid and its golden greens.* Nightly/gated, not per-PR.

## Acceptance Criteria

Stated at stable boundaries (intake panel, dock, job-runner observable state, emitted
package, rendered grid) — never internal functions. → plan Phase 0.

- **AC1 (intent → questions → summary):** Given a free-text intent submitted in the
  intake panel, When the session runs, Then the user is asked the orchestrator's
  clarifying questions in-app (via the `canUseTool` bridge) one at a time, and on
  answering reaches a build summary with Proceed / Give feedback.
- **AC2 (feedback loop):** Given the build summary, When the user chooses Give feedback,
  Then the session returns to clarifying and re-summarizes; no plan/test approval is ever
  shown.
- **AC3 (proceed → dock, grid clean):** Given the user chooses Proceed, When the build
  starts, Then the intake panel closes, the job appears in the build dock as `building`,
  and the grid is unchanged until completion.
- **AC4 (durable, serial):** Given a build is running and the backend restarts, When it
  comes back, Then the job resumes from its `session_id` and the dock reflects its state;
  and a second submission sits in `queued` while the first is active.
- **AC5 (mid-build question bubble-up):** Given a worker subagent reports a needed
  clarification, When the orchestrator receives it, Then the job enters `needs_input`,
  the dock shows an Answer affordance, and answering resumes the build.
- **AC6 (success landing):** Given a build converges, When it completes, Then
  `widgets/<name>/{spec.json, golden/cases.json}` exists, the id is appended to
  `dashboard.layout.json` atomically, the dock row clears, and the widget renders on the
  grid.
- **AC7 (emitted package is valid by construction):** Given a completed build, When the
  locked `structure` + `golden` + `transport-smoke` suites run over `widgets/*`, Then the
  new package passes all three (golden greens in-process during build; dry-run vs the real
  MCP succeeds before landing).
- **AC8 (failure is legible):** Given a build cannot converge within the self-heal cap or
  the MCP is unreachable, When it stops, Then the job is `failed` with a human-readable
  reason, no partial package is written, and the dock offers Refine / Discard.
- **AC9 (no credential plumbing):** Given the user is logged into Claude Code locally,
  When a build runs, Then it authenticates by inheriting that login — no `cc-creds`
  reader or hand-built Anthropic client.

## Supersedes

From the v1.2 design doc's Step 6 and DESIGN.md:

- In-app Anthropic client + `cc-creds` reader → **Agent SDK driving the user's
  authenticated Claude Code** (auth inherited).
- Bespoke forced-tool-use route → **the superpowers authoring workflow** emitting the
  package; "forced tool use" is no longer the mechanism.
- In-memory session `Map` + "session lost — re-issue" UX → **durable on-disk jobs with
  session resume**.
- SSE "Building your widget…" feed as the headline → **intake panel + build dock**;
  SSE/WebSocket remains the progress/question transport.
- DESIGN.md "Add-Widget panel": the top-right button stays; its behavior becomes the
  intake flow + dock. **DESIGN.md needs a small update** to reflect this.

## NOT in scope

- BYOK as a ship gate (optional deferred fallback only).
- Parallel builds (serial chosen).
- Re-authoring the demo widgets against real GitHub MCP for the demo — **Step 7**.
- Reactive emphasis engine — **v1.3**.
- Multi-user, scheduled refresh, in-app "Add MCP", full post-creation widget editing
  (Refine-on-failure is a light re-author carrying intent context, not an editor).

## Risks & the early spike

- **Make-or-break spike (do first in the plan):** confirm superpowers skills load and run
  under the Agent SDK headlessly, and that brainstorming's `AskUserQuestion` surfaces via
  `canUseTool` as documented. Everything else depends on this; prove it before building
  the rest.
- **Cost/quota & wall-clock:** multi-hour sessions consume the user's Claude Code quota
  and laptop resources; the self-heal cap and serial queue bound this.
- **Skill triggering headless:** since `/command` is unavailable, verify the orchestrator
  reliably invokes superpowers sub-skills by instruction.
- **Hard prerequisite:** superpowers plugin must be installed; the README documents it.
