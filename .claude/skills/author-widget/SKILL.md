---
name: author-widget
description: Author a Switchboard widget package from a natural-language intent. Use when driven headlessly by the Switchboard backend to turn a user's "what should this widget track?" into widgets/<name>/{spec.json, golden/cases.json}. Sequences brainstorming → one build-summary gate → golden cases first → TDD until green → dry-run.
---

# Authoring a Switchboard widget

You are driving Switchboard's in-app widget authoring. The user interacts ONLY
through the webapp; your `AskUserQuestion` calls surface as in-app forms. Your
job: turn the intent into a valid widget **package** the dashboard can render.

You will be told a **jobId** and a **staging directory**
(`.switchboard/staging/<jobId>/`). Write the final package there — NOT into
`widgets/`. The backend validates and lands it atomically.

## Output contract — emit these plain-text markers exactly

- `[[phase:planning]]`, `[[phase:implementing]]`, `[[phase:testing]]`, `[[phase:dry-run]]` — as you enter each build phase.
- `[[summary]]<one plain-language paragraph>[[/summary]]` — the build summary, then STOP and end your turn.
- `[[done:<widget-id>]]` — when the package is written and golden greens.
- `[[failed:<short reason>]]` — if you cannot converge or the MCP is unreachable.

## Flow

1. **Elicit intent (brainstorming).** Use the `superpowers:brainstorming`
   technique by instruction (do not type `/brainstorming` — slash commands do
   not work here). Ask clarifying questions ONE AT A TIME via `AskUserQuestion`:
   the source MCP server + tool, the verdict shape, the status rule, the target.
   Emit `[[phase:clarifying]]` before your first question.

2. **Build summary (the single light gate).** When you have enough to proceed,
   emit ONE paragraph naming the source MCP + tool, the verdict shape, and the
   status rule, wrapped in `[[summary]]…[[/summary]]`. Then STOP — end your turn.
   Do NOT show a plan or a test-plan for approval. The backend resumes you with
   either `PROCEED` or feedback text.
   - On feedback: ask more questions / re-summarize. Never an approval gate.

3. **On `PROCEED` — golden cases first (writing-plans Phase 0).** Emit
   `[[phase:planning]]`. Write `<staging>/golden/cases.json` FIRST — the required
   case set, each as `{ name, given|fault, then }`:
   `empty`, `happy`, `boundary`, `over-target` (data cases with `given` rows
   keyed by MCP query name + a hand-written `then`), and `tool-error`,
   `unauthorized` (fault cases). The `then` literals are the intent contract.

4. **Implement the spec via TDD.** Emit `[[phase:implementing]]`. Write
   `<staging>/spec.json` (a `WidgetSpec`: `mcp.server/queries`, the verdict
   `pipeline`, `deeplink`, `render.template` + `slots`, `refresh`, `authoredBy`).
   Iterate until every golden case greens IN-PROCESS (`[[phase:testing]]`). If a
   subagent worker hits a genuine ambiguity it must RETURN a "needs clarification"
   result to you — you then ask the user via `AskUserQuestion` and re-dispatch.
   (Subagents cannot ask questions themselves.)

5. **Dry-run.** Emit `[[phase:dry-run]]`. Confirm the happy `given` produces
   `state: ok` when run through the widget runtime. Then emit `[[done:<id>]]`.

## Rules

- Match `lib/widgets/spec.ts` (`WidgetSpecSchema`) and `lib/widgets/cases.ts`
  (`CasesSchema`) exactly. Read an existing package (`widgets/founder-pr-verdict/`)
  as the reference shape.
- Honor DESIGN.md: status color only when `state === "ok"`; choose a render
  template from `verdict_card | scoreboard | list | single_stat`.
- Keep `<widget-id>` kebab-case and unique (it becomes the directory name + the
  layout id).
