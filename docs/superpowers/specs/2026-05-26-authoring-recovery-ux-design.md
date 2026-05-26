# Widget Authoring — In-Flight Job Recovery UX

**Date:** 2026-05-26
**Status:** Design approved; ready for implementation plan
**Scope:** Recovery experience for a widget-authoring job that is parked waiting on
the user (summary gate / clarifying / needs_input) when the backend restarts.

## Problem

A widget-authoring job lives as a durable JSON file in `.switchboard/jobs/<id>.json`,
but the **live handshake is in-memory**. The agent's SDK turn is a running process,
and `JobRunner` holds the Proceed/answer Promises in `answerResolvers` /
`gateResolvers` Maps (`lib/authoring/job-runner.ts`). On a backend restart those Maps
are empty and the agent turn is gone, so:

1. **Parked jobs become zombies.** `resumeInterrupted()` only re-spawns the agent for
   jobs in `building` (via the persisted `sessionId`). A job parked at `summary`,
   `clarifying`, or `needs_input` is left alone — and with no live turn awaiting a
   resolver, `answer`/`proceed`/`feedback` hit an empty Map and `throw "no pending
   question…"`, so the POST 409s and the click does nothing.
2. **The serial queue wedges permanently.** `findActive()` counts a parked job as
   active (non-queued, non-terminal), so no new widget can build until the file is
   hand-deleted.
3. **The UI offers no action.** The build dock renders the job with no working
   control — a zombie row.

The parked states are recoverable in principle: `sessionId`, `pendingQuestion`, and
`summary` all survive on disk. Nothing reattaches them, and there is no escape hatch.

## Decisions

These were settled during brainstorming and drive the design:

| Decision | Choice | Rationale |
|---|---|---|
| Recovery model | **Invisible lazy reattach** | No background process; re-spawn the agent only when the user acts. Recovery "just works" on the next action. |
| Queue semantics | **Strictly serial** | One authoring session at a time. The anti-wedge guarantee is that a parked job is always *resumable or discardable*, so the slot can always be cleared. |
| Escape hatch | **Discard button only** | Deletes the job file + staged package and frees the slot. No auto-expire, no Refine. |
| Resume failure | **Fail legibly + Discard** | If the SDK can't resume the session, transition to `failed` with a clear reason. No retry, no silent restart-from-intent. |
| Surfaces | **One collapsible authoring surface** | Merge the intake panel + build dock into a single surface for the one in-flight job. The dock becomes the *collapsed state*, not a separate element. (DESIGN.md change — see below.) |

## Architecture

Three layers, all independent of each other:

- **Server — lazy reattach** (`lib/authoring/job-runner.ts`): make
  `answer`/`proceed`/`feedback` work when no live resolver exists by re-spawning the
  agent from the persisted `sessionId`.
- **Server — Discard** (`runner.discard` + `JobStore.delete` + a `DELETE` route): the
  escape hatch that settles any live waiter, deletes durable state, and serves the
  queue.
- **Client — one collapsible surface** (`AuthoringSurface`, hosted by
  `AddWidgetButton`): a single surface bound to the current job; recovery is its
  default behavior, not a special path.

The server work is identical regardless of the surface count, so the UI decision was
made independently and costs nothing on the hard part.

### Layer 1 — Server: lazy reattach (resolver-or-resume)

Each of `answer` / `proceed` / `feedback` gains one branch:

- **Live resolver present** (happy path, no restart): resolve the Promise exactly as
  today. **Unchanged** — this is the regression-guarded path.
- **No resolver** (post-restart cold path): the persisted job holds everything needed
  (`sessionId`, `pendingQuestion`, `summary`). Apply the state transition, then start
  a **fresh continuation** that re-spawns the agent via
  `runTurn(jobId, <input-as-prompt>, sessionId)` and runs to the next durable stop.

To make the continuation re-enterable from any parked state, extract the gate/build
tail of `drive()` into two reusable helpers (also used by `drive` and
`resumeInterrupted`; this collapses the current `driveFeedbackThenBuild`
duplication):

- `awaitGateThenContinue(jobId)` — set the gate resolver, await the decision;
  `proceed` → `runBuild`; `feedback` → re-summarize turn → recurse.
- `runBuild(jobId, prompt)` — `runTurn(resume)` → `finishBuild`.

Cold-path dispatch by persisted state:

| Action | Parked state | Continuation |
|---|---|---|
| `answer` | `clarifying` | resume turn w/ answer → ends at `summary` → `awaitGateThenContinue` |
| `answer` | `needs_input` | resume turn w/ answer → `finishBuild` |
| `proceed` | `summary` | `runBuild(jobId, "PROCEED")` |
| `feedback` | `summary` | re-summarize turn → `awaitGateThenContinue` |

The cold path claims the serial slot (`running = true`) and, like `resumeInterrupted`,
wraps in `.catch(failSafe).finally(() => { running = false; pump(); })`. A second
concurrent POST while a cold resume is in flight gets a 409 (slot held).

**Resume failure.** If the resumed `runTurn` throws or returns `result.error`, the
existing `failSafe(jobId, …)` fires → state `failed` with reason ≈ `"couldn't resume
session after restart"`. `findActive()` excludes `failed`, so the slot frees
immediately and the surface shows the failure + Discard.

**Known risk (must be verified in implementation).** A job parked at
`clarifying`/`needs_input` died *mid-`AskUserQuestion`* — a tool-use awaiting its
tool_result. Resuming that session and injecting the answer is the uncertain part: the
SDK may or may not accept a transcript with a dangling tool_use. The `summary` gate is
clean (the agent emitted `[[summary]]` as completed text, so resuming with `"PROCEED"`
is well-formed). For the question case, "fail legibly" is the safety net. **Pinning
real SDK resume behavior is the #1 verification target**, and may push us toward
formatting the resume as a self-contained prompt (`"The user answered <Q>: <A>.
Continue."`) rather than a bare continuation.

### Layer 2 — Server: Discard (the escape hatch)

New endpoint: `DELETE /api/widgets/[id]` → `runner.discard(id)` (a dedicated REST verb
on a new `app/api/widgets/[id]/route.ts`, not an overload of the `answer` POST —
discard is a lifecycle action, not an authoring input).

`runner.discard(jobId)`, in order:

1. **Settle any live waiter.** Change the resolver Maps from bare `resolve` fns to
   `{ resolve, reject }` settlers. Discard **rejects** the live settler with a
   `DiscardError`. That rejection unwinds `runTurn` → the `drive()` try/catch →
   `failSafe`, which already no-ops once the job file is gone (it re-reads the job and
   guards on existence). The agent subprocess stops because its `canUseTool`/gate
   Promise rejected. Settling is essential: an un-settled gate Promise would hang
   forever and re-wedge the slot.
2. **Delete durable state.** New `JobStore.delete(id)` removes
   `.switchboard/jobs/<id>.json`; discard also removes the staging dir
   `.switchboard/staging/<id>/`. Clear the job's entries from
   `answerResolvers` / `gateResolvers` / `pendingDone` / `mutex`.
3. **Free + serve the queue.** If the discarded job held the slot, `running = false`,
   then `pump()` so the next `queued` widget starts.

Discard is **idempotent and uniform** across `clarifying` / `summary` / `needs_input` /
`failed` / `queued`. It is **not** offered on `building` (no live-build abort in scope)
or `done` (already on the grid).

**Events route on a deleted job.** `app/api/widgets/[id]/events/route.ts` already
tolerates `null` (`job ?? null`). Add: when a previously-seen job becomes `undefined`,
emit one final `data: null` and `controller.close()` so any *other* open stream stops
cleanly. The clicking client does not depend on this — it drops the job from local
state optimistically on the `DELETE` 200.

### Layer 3 — Client: one collapsible authoring surface

Merge `IntakePanel` + `BuildDock` into a single `AuthoringSurface` bound to the one
current job (`AddWidgetButton` stays the host). One `EventSource`, one component owning
the whole lifecycle. Two presentation modes:

- **Expanded** — the focal right sidebar (today's panel): intent entry, conversation,
  decisions.
- **Collapsed** — the small bottom-right chip (today's `⠿` dock affordance): ignorable
  build status.

A collapse/expand control toggles them (DESIGN.md "short" ease transition). Default
mode is driven by whether the state needs the user; a manual toggle is respected until
the state changes:

| State | Default mode | Shows |
|---|---|---|
| (none) | closed | just the **+ Add widget** button |
| `clarifying` | expanded | shared question component |
| `summary` | expanded | `SummaryMarkdown` + Proceed / Give feedback |
| `queued`, `building` | collapsed chip | phase / "queued" (expand to watch) |
| `needs_input` | auto-expands | shared question component (the build needs you) |
| `failed` | expanded | reason + Discard |
| `done` | closes | surface clears; widget joins the grid |

**The "current job"** = the single non-terminal job if one exists, else the
most-recent undiscarded `failed` job. A failure therefore occupies the surface
(expanded, rose, Discard) until cleared — never a hidden zombie.

**Add-Widget button.** Shown & enabled **only when there is no current job**. Once a
job exists, the surface itself is the entry point, so there is no second-job affordance
to reconcile and strictly-serial falls out for free. No "Resume authoring" button: the
surface is already on screen in its correct mode.

**Recovery is the default behavior, not a special path.** On load, `AddWidgetButton`
binds the surface to the current job (from server-rendered `initialJobs`) and presents
it per the table. Reload after a restart → the surface is simply *there*, expanded if
it needs the user, a chip if it's mid-build. Same code runs with no restart at all.

**Discard** lives in the surface for any state except `building` / `done` →
`DELETE /api/widgets/[id]`; the surface clears (revealing the next lingering failure if
any, else the button). Styled as an understated ink/stone-500 underlined link.

**Shared question component.** `clarifying` and `needs_input` both render a
`pendingQuestion` (suggested options + free-text escape hatch). It becomes one internal
piece of the surface — no cross-surface duplication.

**What this removes vs. a panel+dock design:** the panel↔dock handoff, auto-launch
dispatch, the "+ Add widget vs Resume" branching, and cross-surface component
duplication.

## DESIGN.md impact

Update the **"Add-Widget — Intake Panel & Build Dock"** section to describe **one
collapsible authoring surface** — the build dock becomes its *collapsed state*, not a
separate element. Keep the established affordances: Fraunces conversation/summary,
Geist eyebrows, amber question / rose failed state colors, emerald Proceed, ink
underlined Discard (saturation stays reserved for verdict-band status). Add a
Decisions-Log entry dated 2026-05-26. Flag for `/design-review` in the gauntlet.

## Acceptance Criteria

Given/When/Then at **stable boundaries** (the HTTP API + the on-disk job file + the
rendered surface), never internal functions. These become **Phase 0** of the plan:
each lands as a `test.todo`/skipped test that compiles but stays red; Phases 1…N green
named subsets via TDD. "Restart" is modeled as **a fresh `JobRunner`/singleton with
empty in-memory handshake state over the same on-disk job** (the store re-reads disk).

**Recovery / server (boundary: API + `.switchboard/` on disk):**

- **AC1 — Proceed after restart (summary gate).** *Given* a fresh runner and a job
  persisted in `summary` with a `sessionId`, *When* `POST /api/widgets/{id}`
  `{kind:"proceed"}`, *Then* the build runs and the job file reaches `done` with the
  package landed under `widgets/<name>/` and appended to `dashboard.layout.json`.
- **AC2 — Answer after restart (clarifying).** *Given* a fresh runner and a job in
  `clarifying` with `pendingQuestion` + `sessionId`, *When* `POST …/answer
  {kind:"answer",answers}`, *Then* `pendingQuestion` clears and the job advances toward
  `summary`.
- **AC3 — Answer after restart (needs_input).** *Given* a fresh runner and a job in
  `needs_input` + `sessionId`, *When* answered, *Then* the build continues and the job
  reaches `done` (landed).
- **AC4 — Resume failure fails legibly.** *Given* a parked job whose session cannot be
  resumed, *When* the user acts, *Then* the job reaches `failed` with reason ≈
  *"couldn't resume session after restart"* and `findActive()` is empty (slot freed) —
  no retry, no silent restart-from-intent.
- **AC5 — Queue no longer wedged.** *Given* a parked job holding the slot and a second
  `queued` job, *When* the parked job reaches a terminal state (resumed-to-done/failed
  **or** discarded), *Then* the queued job leaves `queued` and begins.
- **AC6 — Discard frees the slot + cleans up.** *Given* a parked job and a `queued`
  job, *When* `DELETE /api/widgets/{id}`, *Then* `.switchboard/jobs/{id}.json` and
  `.switchboard/staging/{id}/` are gone and the queued job starts.

**Surface / UI (boundary: rendered page given `initialJobs`):**

- **AC7 — Surface rehydrates on load.** *Given* the page renders with a job persisted
  in state X, *Then* the surface shows: expanded question for `clarifying`/`needs_input`;
  expanded summary + Proceed/feedback for `summary`; expanded reason + Discard for
  `failed`; collapsed chip for `queued`/`building`.
- **AC8 — Add-Widget gating.** *Given* a current job exists (non-terminal or
  undiscarded `failed`), *Then* **+ Add widget** is not actionable; *given* none, it is
  enabled and opens intent entry.
- **AC9 — Discard from the surface clears it.** *Given* the current job is shown
  (parked/failed), *When* Discard, *Then* the surface clears (revealing the next
  lingering failure if any, else the button) and the job is deleted.

**Regression guard:** the existing authoring AC1–9 (happy path, no restart) must stay
green — the resolver-present branch is untouched.

## Testing approach

Mapped to the test strategy's tiers
(`docs/superpowers/specs/2026-05-22-switchboard-test-strategy-design.md`):

- **AC1–6** — integration tests driving the real `JobRunner` + real `JobStore` on a
  temp dir with the existing **FakeRunner** agent, extended to (a) resume from a parked
  state and (b) a "resume throws" mode for AC4. Restart = instantiate a second fresh
  runner over the same temp dir.
- **AC7–9** — component tests (RTL) rendering `AuthoringSurface` / `AddWidgetButton`
  from `initialJobs` fixtures with mocked `fetch` / `EventSource`.
- **Real-transport verification (the fake can't prove this):** resuming a session that
  died **mid-`AskUserQuestion`** (`clarifying`/`needs_input`). Use a gated eval
  (`SWITCHBOARD_RUN_EVAL`) or the Tier-4 stub-MCP harness to confirm the SDK accepts the
  resumed transcript and to settle the resume-prompt format. The `summary` path (AC1) is
  well-formed and lower-risk.
- **Pre-release gauntlet** (per CLAUDE.md): full PR gate + `/design-review` (the
  one-surface DESIGN.md change) + `/qa` + **live smoke** (kill the server at `summary`,
  `clarifying`, and `needs_input`; reload; confirm reattach-and-continue + Discard each
  free the queue) + acceptance review vs this spec.

## Out of scope (YAGNI)

- Auto-expire / TTL on parked jobs.
- A "Refine" action that reopens intake with the prior intent prefilled.
- Aborting a live `building` job (Discard is not offered on `building`).
- Concurrent / parallel builds (the surface and queue remain strictly serial).
