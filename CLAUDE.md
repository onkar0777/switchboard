# Switchboard — Claude Notes

This repo uses gstack and superpowers plugins/skills to do product and engineering work. There are two locations where artifacts from these are stored. Check **both** when doing any design, planning or major feature work.

### 1. In-repo (Committed) — `docs/superpowers/`

### 2. Local gstack project (Not Committed) — `~/.gstack/projects/switchboard/`

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, aesthetic direction, and the widget-grid emphasis
model are defined there. Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Testing Strategy
See `docs/superpowers/specs/2026-05-22-switchboard-test-strategy-design.md` for the
full 9-tier taxonomy and two-gate cadence. Two conventions are mandatory:

1. **Every spec carries an Acceptance Criteria section → plan Phase 0.**
   Write acceptance criteria as Given/When/Then statements at *stable boundaries*
   (rendered page, config surface, verdict output) — never against internal
   functions. `writing-plans` turns these into Phase 0 of the plan: translate each
   criterion into an executable test (`test.todo`/skipped) that compiles but stays
   red, with no implementation yet. Phases 1…N implement via TDD, each greening a
   named subset. This is ATDD's outer loop (intent contract written first); the
   inner unit/integration tests emerge during TDD — do NOT pre-write them.

2. **Run the pre-release gauntlet after any major feature implementation** before
   considering the work done: full PR gate + `/design-review` (DESIGN.md
   conformance) + `/qa` + live smoke vs real GitHub + acceptance review vs the
   plan's stated intent.