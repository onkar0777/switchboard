# Switchboard — Test Strategy & Cadence

**Date:** 2026-05-22
**Status:** Approved (brainstorm) → implementation pending
**Author:** onkar0777 + Claude

## Problem

The server runs and unit tests are green, yet the live page shows
`Couldn't compute: fetch failed`. Every one of the 167 existing tests runs against
a mock or an in-memory fake — **nothing boots the app, talks to a real MCP server
over a real transport, or renders `app/page.tsx` to HTML.** That blind spot is
exactly where the current bug lives.

This document defines the full taxonomy of test suites the product should have, the
cadence at which each runs, the governance that keeps the strategy from rotting, and
a two-loop (ATDD + TDD) model that guards against intent drift.

It is **not** a list of bugs to fix. The `fetch failed` bug is fixed separately,
test-first, once the harness that reproduces it (Tier 4) exists.

## Goals

Defend the whole stack against five named failure modes:

1. **Live path silently breaks** — unit tests green, real page broken (the current bug).
2. **Verdict logic goes wrong** — numbers/headline/status bands subtly incorrect.
3. **Design / visual drift** — code stops matching `DESIGN.md`.
4. **Scope creep / product drift** — features violate the v1 non-goals.
5. **Feature doesn't do what was planned** — built thing diverges from the high-level intent.

## Non-goals

- No pre-commit git hook (deliberately not chosen — fast tier runs at the PR gate).
- No nightly cron tier (live-GitHub smoke runs at the pre-release gauntlet + on demand).
  Revisit only if unattended drift alerting is ever wanted.
- This strategy does not replace human judgment at the pre-release gauntlet; it
  sequences it.

---

## Part A — The test taxonomy

A layered pyramid. Each tier is tagged with the failure mode it defends and the gate
it runs at (see Part B).

| Tier | Suite | Defends | Gate | Status |
|---|---|---|---|---|
| 0 | **Static** — `typecheck` + `lint` | all | PR | exists |
| 1 | **Pure-logic unit** — verdict engine, DSL, spec, status-tokens, runtime | Verdict logic | PR | exists (expand) |
| 2 | **Component render** — 4 templates + DashboardGrid (testing-library) | Render correctness | PR | exists |
| 3 | **In-process integration** — load-widget, mcp-data, parity oracle (fakes) | In-process wiring | PR | exists |
| 4 | **Stub-MCP over real transport** — real MCP server process, canned GitHub-shaped data, exercised through the real `client-manager` | **Live path breaks** ← reproduces current bug | PR | NEW |
| 5 | **Boot-and-browse E2E** — boot Next.js, headless browser asserts page renders, no FailureState, widgets present | Live path breaks at SSR/HTTP layer | PR | NEW |
| 6 | **Replay-fixture** — recorded real-GitHub responses replayed; verdict output snapshot | Real-data schema drift + verdict correctness on realistic data | PR | NEW |
| 7 | **Visual / DESIGN.md conformance** — screenshot diff + design audit | Design / visual drift | Pre-release (`/design-review`) | NEW |
| 8 | **Live smoke vs real GitHub** — hits real api.github.com with token | Live path real-fidelity | Pre-release + on-demand | NEW |
| 9 | **Acceptance + non-goals guard** — per-feature behavioral checks vs the plan's intent; deterministic asserts that scope creep is impossible | Feature-as-planned + scope creep | PR | NEW |

### Tier-by-tier notes

- **Tier 4 is the one that reproduces the current bug.** A boot-and-browse with
  `SWITCHBOARD_FORCE_MOCK=1` (Tier 5) would *not* — mock data bypasses the broken
  transport. Tier 4 points the real `client-manager` at a stub MCP server, so a
  transport break turns the test red. This is built first.
- **Tier 5** runs with mock data for determinism; it proves SSR + render + the
  no-error path, not live transport.
- **Tier 6** fixtures are captured once from real GitHub/MCP, committed, and
  refreshed periodically. They catch schema/shape drift in real data without a
  network call.
- **Tier 9 non-goals guard** is deterministic and cheap: assert the config schema
  rejects >1 goal, assert the token is never written to disk, assert no network
  egress except `api.github.com`. Scope creep becomes a failing test, not a code
  review opinion.

---

## Part B — Cadence (the two-gate model)

### Gate 1 — PR gate (CI, blocking on every PR + push to `main`)

Everything deterministic and secret-free: **Tiers 0, 1, 2, 3, 4, 5, 6, 9.**

If this is green: the live path is wired, the verdict math is correct, intent is
pinned, and scope creep is structurally blocked — with zero secrets.

### Gate 2 — Pre-release gauntlet (manual / agent-run before a version ships)

The full PR gate **plus** the flaky / expensive / judgment tiers:

- **Tier 7** — Visual + `DESIGN.md` conformance → `/design-review`
- **Tier 8** — Live smoke vs real GitHub (needs token, tolerates flakiness, never blocks)
- **Full QA pass** → `/qa`
- **Acceptance review vs plan intent** — confirm shipped behavior matches the spec's
  Acceptance Criteria section

---

## Part C — The two-loop model (intent-drift guard)

Intent drift is guarded by **acceptance-test-driven development (ATDD)**: two loops.

### Outer loop — written FIRST, the intent contract

Black-box behavioral tests at **stable boundaries** that do not churn regardless of
how the internals are built:

- the **rendered page** (boot-and-browse: "given mock data, the page shows a Verdict
  headline, not a FailureState")
- the **config surface** ("a config with 2 goals is rejected")
- the **verdict output** for known inputs ("5 merged / target 5 → headline starts
  'Shipped'")

These reference only observable behavior — never internal functions — so they survive
refactors. They encode *what the plan said the feature does* and go red the moment
intent drifts.

### Inner loop — emerges DURING build via TDD

Every unit / integration test (Tiers 1–4) written test-first as each seam is designed.
These are **not** written up front: the seams they target (function signatures, error
types, internal interfaces) are design decisions made during implementation. Writing
them up front means guessing the design, then rewriting the guesses — wasted motion
that also destroys the red-green rhythm.

### Why not "write all possible tests up front"

Considered and rejected. Only the *acceptance* tier can be written first (its
boundaries are stable). Pre-writing inner tests produces a monolithic red wall, loses
incremental signal, and couples tests to a not-yet-designed implementation. The
acceptance tests are sliced per plan phase so each phase greens a named subset.

---

## Part D — Governance (writing-plans + CLAUDE.md)

So the strategy does not rot, two conventions are added to `CLAUDE.md`:

### 1. Every spec carries an Acceptance Criteria section → plan Phase 0

Each spec includes an **Acceptance Criteria** section: testable Given/When/Then
statements derived from the high-level intent, at stable boundaries. `writing-plans`
consumes it as **Phase 0**:

> **Phase 0 — Pin the intent.** Translate every Acceptance Criterion into an
> executable test (`test.todo` / skipped). They compile but stay red. No
> implementation yet.
>
> **Phase 1…N — Implement via TDD,** each phase un-skipping and greening a named
> subset of acceptance tests as its slice lands.

This locks intent before any feature code, while preserving incremental green signal.

### 2. Run the pre-release gauntlet after any major feature

After any major feature implementation, run **Gate 2** (the pre-release gauntlet)
before considering the work done.

---

## First implementation target

**Tier 4 — stub-MCP-over-real-transport harness.** It is the highest-value gap: it
reproduces the current `fetch failed` bug by driving the real `client-manager`
against a controllable stub MCP server. Once it (and a Tier 5 boot-and-browse using
it) goes red against the live path, the bug fix is driven red → green.

## Build order (subsequent gaps)

1. **Tier 4** — stub-MCP harness (reproduces the bug) + wire into PR gate.
2. **Tier 5** — boot-and-browse E2E smoke.
3. **Tier 9** — acceptance-test convention + non-goals guard; add Phase-0 convention
   to `CLAUDE.md`.
4. **Tier 6** — replay-fixture capture + snapshot.
5. **Tier 7 / 8** — wire `/design-review`, `/qa`, live smoke into the documented
   pre-release gauntlet.

Each gap is its own spec → plan → implement cycle. This document is the umbrella
strategy they all reference.
