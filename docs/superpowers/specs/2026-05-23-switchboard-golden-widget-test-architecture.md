# Golden Widget Test Architecture — retiring v1-parity

**Date:** 2026-05-23
**Status:** Design locked (via /plan-eng-review). **Folded into Step 6** — this is the
test-architecture half of the Step 6 authoring-flow plan, not a standalone PR. The
widget-package contract defined here is the same shape the Step 6 authoring flow emits.
**Supersedes:** the v1-parity gate (`runtime.parity.test.ts`, `mcp-data.parity.test.ts`)
shipped in PR #7 Steps 1–5.

## Why

The v1-parity gate certified that the Step 1–5 widget-runtime refactor produces
byte-identical verdict output to v1's `computeVerdict`. That certification is spent —
the refactor shipped. What remains is pure cost: `computeVerdict` and its helpers
(`statusFor`, `headlineFor`, `pickMondayMove`, `bucketMomentum`, `pluralize` in
`lib/verdicts/engine.ts`) are **dead production code** — zero non-test callers. They
survive only as the parity oracle. The gate therefore forces us to maintain *two
implementations of the verdict logic* (the v1 engine body and the DSL pipeline) in
lockstep. That is the real tax, and it does not scale to a multi-source platform.

Switchboard is a platform: Step 6 lets Claude author widgets against arbitrary MCP
servers (GitHub, Confluence, Linear, Datadog, …). The regression gate must hold for
any widget, not just the founder/GitHub example.

## Architecture — two layers

### Layer 1: Structural conformance (generic, platform-owned)
Parametrized over every widget in `widgets/`. Zero per-widget code. For any spec,
regardless of MCP source, asserts:
- spec validates against `WidgetSpecSchema`
- pipeline parses (`parsePipeline`)
- output honors the template's slot contract (`template-slots.ts`)
- state machine: empty rows → `empty`, tool error → `error`, auth fail →
  `unauthorized`, good rows → `ok`
- deeplinks well-formed
- DESIGN.md rule: status color only when `state === "ok"`
- **GUARD: a minimum known-widget count is discovered** (anti empty-glob false-pass)

### Layer 2: Semantics / golden (generic runner, per-widget data)
The runner is generic; the content is irreducibly per-widget (the verdict logic *is*
the widget) but expressed as **data, not code** — a table of `given → then` cases:

```
for each widget package (spec, cases[]):
  for each case (name, given: {toolName: rows[]}, then: expected):
    out = execute(spec, given, frozenNow)        # in-memory
    assert out matches then                       # explicit targeted literals
```

`then` asserts the contract-defining fields as hand-written literals: `state`,
`verdict` (the string the user reads), `status`, slot ids + order, `momentum`,
`action`. Not a full deep-equal (brittle), not a snapshot (re-blessed silently).
Hand-writing the verdict makes it the TDD intent contract and self-documenting.

### Transport: in-memory + one real smoke per widget
- All golden cases run **in-memory** via `execute()` — fast, full semantics, clear
  failure attribution.
- Each widget's `happy` case `given` is **replayed once over the real stub-MCP HTTP
  transport** (`lib/mcp/testkit/stub-mcp-server.ts`), asserting `state=ok` + the
  verdict literal. This covers the per-MCP parse/drift boundary — where the
  "fetch failed" / drift bugs live — for *every* widget, not just the founder one.
  Reuses the same `given` data, so near-zero extra fixtures.

## Package shape

```
widgets/
  founder-pr-verdict/
    spec.json
    golden/cases.json     # [{ name, given: {tool: rows[]}, then: {...} }]
  confluence-docs-freshness/
    spec.json
    golden/cases.json
```

A widget is a self-contained, testable unit. New widget = drop a directory, get both
test layers free. The Step 6 authoring flow emits exactly this shape.

## Confluence example (proving platform-generality)

```
widgets/confluence-docs-freshness/spec.json   # tools:[search_pages]; counts stale>90d; scoreboard
widgets/confluence-docs-freshness/golden/cases.json:
  - name: "happy — mostly fresh"
    given: { search_pages: [ ...10 pages, 3 older than 90d ] }
    then:  { state: ok, verdict: "7/10 docs current", status: good }
  - name: "empty — no pages"
    given: { search_pages: [] }
    then:  { state: empty }
  - name: "all stale"
    given: { search_pages: [ ...all >90d ] }
    then:  { state: ok, verdict: "0/10 docs current", status: behind }
```

Identical runner to the founder PR widget; only the data differs.

## Changes

**Delete:** `lib/verdicts/engine.ts` → `computeVerdict`, `statusFor`, `headlineFor`,
`pickMondayMove`, `bucketMomentum`, `pluralize`; `runtime.parity.test.ts`;
`mcp-data.parity.test.ts`.
**Keep:** `mondayOfWeek`, `sundayEndOfWeek` (used by `lib/widgets/ctx.ts`);
`lib/verdicts/types.ts` (`GoalConfig`, used across `lib/mcp/*`).
**Replace:** `buildFixtureData` (hardcoded `list_merged_prs`/`list_open_prs`) → generic
`given`-by-tool-name loader.
**Add:** `structure.test.ts`, `golden.test.ts`, `transport-smoke.test.ts` (all generic);
`widgets/founder-pr-verdict/golden/cases.json`.
**Restructure:** `widgets/*.spec.json` → `widgets/<name>/spec.json` (~5 test imports update).

## Acceptance Criteria

- **AC1 (structure, generic):** Given any registered widget spec, When the structure
  suite runs, Then schema/pipeline/slot-contract/state-machine/deeplink/DESIGN-color
  all pass, and the suite fails if fewer than the known widget count are discovered.
- **AC2 (golden semantics):** Given a widget's `golden/cases.json`, When each `given`
  is executed in-memory, Then output matches `then` on state, verdict string, status,
  slot ids+order, momentum, action.
- **AC3 (empty state):** Given a case with empty `given` rows, When executed, Then
  `state === "empty"` and no false verdict.
- **AC4 (transport smoke, per widget):** Given a widget's happy `given` replayed over
  the real stub-MCP HTTP transport, When loaded, Then `state === "ok"` and verdict
  equals the case's literal.
- **AC5 (no v1 oracle):** `computeVerdict` and the parity tests no longer exist; the
  full suite is green without them.

## Relationship to the rest of Step 6

This test architecture is one half of Step 6; the authoring flow is the other half.
They meet at the **widget-package contract** (`widgets/<name>/{spec.json,
golden/cases.json}`). Sequencing within the Step 6 plan:

1. **Test architecture (this spec)** lands first as the foundation: per-widget
   package layout, generic structure + golden + transport-smoke suites, delete the
   v1 oracle, replace `buildFixtureData`. The founder widget is migrated into the new
   package shape as instance #1. This greens independently of any authoring code.
2. **Authoring flow** (Anthropic SDK, prompt caching, forced tool use, SSE, dry-run
   save, `dashboard.layout.json` + `[id]/data` route) emits the package shape from (1).
   The ATDD seam: the flow generates `golden/cases.json` **first** (the intent
   contract a human approves), then iterates the `spec.json` DSL until golden greens.
3. **Required-cases checklist** (empty / happy / boundary / over-target / tool-error /
   unauthorized) — the widget template mandates these; the structure suite enforces
   their presence. Now in scope here (was deferred), because it is the contract that
   makes Claude-authored widgets complete by construction.

## NOT in scope
- Re-authoring the demo widgets against real GitHub MCP for the demo — Step 7.
- Live Anthropic credentials / billing UX beyond what the authoring route needs.
