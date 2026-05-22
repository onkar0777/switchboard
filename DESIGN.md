# Design System — Switchboard

## Product Context
- **What this is:** The verdict layer for knowledge workers. A local-first morning dashboard that reads from your existing work tools (via MCP) and renders factual progress against goals you defined. Scoreboard, not coach.
- **Who it's for:** Technical managers and senior EMs. Primary user is the founder, daily. Demo audience is a director + 1–2 senior EMs who can `git clone && run` it themselves.
- **Space/industry:** Developer tools / personal operations console. Adjacent to Grafana, Metabase, Notion dashboards — but those show data; Switchboard renders a verdict.
- **Project type:** Local-first web app. v1 = a single screenshot-worthy Verdict Poster. v1.2 = a configurable widget-runtime dashboard (vertical-scroll grid of S/M/L widgets, each authored on demand via Claude Code).
- **The one thing to remember:** A factual verdict with receipts. Bloomberg terminal meets newspaper editorial — serious instrument for serious work.

## Aesthetic Direction
- **Direction:** Editorial newspaper. Broadsheet typography, hairline rules, generous vertical rhythm, restrained palette. Approved via `/plan-design-review` (2026-05-17).
- **Decoration level:** Minimal. Typography and whitespace do the work. No card boxes, no gradients, no decorative fills. Sections are separated by hairlines, like a newspaper, not by borders.
- **Mood:** Authoritative and calm. A glance should feel like reading a verdict from an instrument you trust, not scanning another SaaS panel.
- **Reference points:** Bloomberg terminal (data density, mono numerals), newspaper front page (verdict-as-headline, hairline column rules).

## Typography
- **Display + Body:** **Fraunces** (optical serif). Carries verdicts and headlines — this is the editorial voice and the single biggest reason a screenshot reads as a verdict, not a dashboard widget. `var(--font-fraunces)`.
- **Numerals (standalone stats):** **JetBrains Mono**, `tabular-nums`. The "terminal" half of the aesthetic. Used for any number that stands alone (counts, deltas, sparkline values). Numerals inline within a Fraunces verdict sentence stay Fraunces. `var(--font-jetbrains)`.
- **UI / eyebrows / meta:** **Geist** (replacing Inter). Clean technical sans for labels, eyebrows, footers, receipt-row meta. Reads modern-technical, pairs with Fraunces without competing. *Inter was the prior default and is removed — it is the #1 AI-convergence font and the sans role here is small enough that a font with more technical character serves better.*
- **Code (Add-Widget panel, hints files):** **JetBrains Mono**.
- **Loading:** Self-hosted via `next/font` (already wired for Fraunces + JetBrains Mono). Add Geist the same way; drop the Inter `var(--font-inter)`.
- **Scale (px):**
  - Hero verdict (L card / lead): 40px Fraunces, semibold, tracking -0.01em, leading 1.1
  - Card verdict (M): 22px Fraunces, leading 1.2
  - Compact verdict (S): 15px Fraunces, muted color, leading 1.35
  - Hero stat: 32px JetBrains Mono, tabular-nums
  - Card stat: 24px JetBrains Mono, tabular-nums
  - Compact stat: 18px JetBrains Mono, tabular-nums
  - Eyebrow / label: 12px Geist, uppercase, tracking 0.08em
  - Body / meta: 14px Geist

## Color
- **Approach:** Restrained. Neutrals everywhere; status bands carry the *only* saturated color on the page. If something is colored, it means something.
- **Neutrals (warm stone):**
  - Background: `250 250 249` (#fafaf9) — already shipped
  - Foreground / ink: `24 24 27` (#18181b) — already shipped
  - Hairline rules: stone-200 (#e7e5e4)
  - Meta text: stone-500 (#78716c)
  - Secondary text: stone-600 (#57534e) / stone-700 (#44403c)
- **Status (the only saturation):**
  - Good / on-track / shipped: emerald-700 (#047857), tint emerald-50 (#ecfdf5)
  - At-risk / drag: amber-600 (#d97706), tint amber-50 (#fffbeb)
  - Behind / error: rose-700 (#be123c), tint rose-50 (#fff1f2)
  - Neutral / pure-status (no target): inherits ink, no color
- **Links / deeplinks:** Ink (zinc-900), underlined. No separate accent hue — keeps status color meaningful. Deeplinks are the "dig deeper" affordance and should read as understated newspaper links, not buttons.
- **Dark mode:** Skipped in v1 (decision D6). Switchboard is a light-only screenshot brand for now. Revisit only if daily use demands it.

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable. Generous vertical rhythm is core to the editorial feel — do not tighten to reclaim space.
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)

## Layout
- **Approach:** Hybrid. Single editorial column for the lead verdict; a 4-column grid below for the rest of the widgets.
- **Grid:** 4 columns on desktop. Widget size buckets map to span: **S** = 1 col, **M** = 2 cols, **L** = full width (4 cols). Vertical scroll, no cap on widget count (P3). Collapses to single column on narrow screens.
- **Max content width:** ~768px (max-w-3xl) for the single-poster era; the grid uses the full width up to a ~1280px container.
- **Separation:** Hairline rules (stone-200), not boxed cards. A widget is a section with a top rule, not a bordered tile.
- **Border radius:** Minimal — sm 2px, md 4px. Newspaper-sharp. Avoid uniform bubbly radii.

## Widget Grid — Emphasis Model

> **Phasing (reconciled 2026-05-20 via `/plan-eng-review`):** the full reactive
> emphasis engine was an aspirational v1.2 design that the v1.2 implementation plan
> never budgeted (zero-buffer 2-weekend wedge). It is split: **v1.2 ships the
> canonical status contract + status color only**; **v1.3 adds reactive sort,
> status-driven volume, and the reorder animation.** This section is marked per phase.

Every widget emits the P5 contract: a **verdict** (one sentence) + a **value or status** + **deeplink(s)** to dig deeper. The grid varies a widget's *volume*, never its *content*. Two inputs set volume:

1. **Size (S/M/L)** — chosen at authoring time. Sets footprint and the *ceiling* of typographic treatment.
2. **Status band** — emerald (good/on-track), amber (at-risk/drag), rose (behind), neutral (pure status, no target). Computed from live data on each refresh.

### v1.2 — canonical status contract + color (SHIPS NOW)
- The per-widget runtime emits **two typed fields** (decision: `/plan-eng-review` 2026-05-20):
  - `status: 'good' | 'at_risk' | 'behind' | 'neutral'` — the verdict outcome band, derived from the DSL `compare`-op output via a fixed mapping (handles numeric **and** enum/boolean outcomes, not just numeric thresholds).
  - `state: 'ok' | 'loading' | 'error' | 'empty' | 'unauthorized'` — the runtime/fetch health, separate from the verdict outcome.
- All four render templates color on `status` **only when `state === 'ok'`**; otherwise they render the failure-state UX (loading skeleton / "can't reach {server}" / empty / auth prompt).
- **Order in v1.2 is authored order** (the `dashboard.layout.json` list). No automatic re-sorting.
- Color mapping: emerald = good, amber = at_risk, rose = behind, ink/neutral = neutral. This is the only saturated color on the page (per Color section).

### v1.3 — reactive emphasis (DEFERRED)
- **Order:** Widgets sort by severity on each refresh — rose, then amber, then emerald/neutral. Within a band, by size (L→S), then authored order. The page floats whatever needs you to the top.
- **Volume:** Off-track widgets (amber/rose) render their verdict at full editorial weight for their size, status-colored. Fine widgets (emerald/neutral) render quiet — the mono numeral leads and the verdict drops to a muted caption.
- **Size caps absolute scale:** an L behind-status widget is the 40px editorial hero; an S behind-status widget is compact-but-colored, never a hero.
- **Reorder animation:** a short move transition so cards don't jump on re-sort.
- **Tradeoff (accepted for v1.3):** the layout shifts week to week (not screenshot-stable) in exchange for a dashboard that always surfaces the two things that are off. The v1.2 `status`/`state` contract is designed so this is a pure additive change — the grid reads the same `status` field, no runtime rework.

**Protecting the rich widget:** `verdict_card` (receipts, drag, momentum sparkline, Monday move — the refactored v1 poster) stays a first-class template. At **L** it shows receipts/momentum inline. At **M/S** it simply renders fewer slots (verdict + stat only). Receipts are *omitted* at small sizes, not hidden behind an expand — progressive disclosure is deferred (see below).

**Deferred (net-new scope, candidate for a later version):** a dedicated pinned "North Star" slot independent of status, and progressive receipt disclosure (expand-to-reveal receipts on quiet cards). Both add a concept the runtime doesn't have yet; revisit once the reactive grid is in daily use.

**Render templates** (4, from the v1.2 spec): `verdict_card` (rich, text-heavy), `scoreboard` (numeric headline + delta), `list` (ranked deeplinked rows), `single_stat` (one number + verdict). In v1.2 all four obey size→treatment and `status`→color; the `status`→volume rules apply in v1.3.

## Motion
- **Approach:** Minimal-functional. Only motion that aids comprehension.
- **Loading:** Suspense skeletons matching each widget's layout (decision D3). Each widget is its own server component so first paint streams in.
- **Easing:** enter(ease-out) · exit(ease-in) · move(ease-in-out)
- **Duration:** micro(50–100ms) · short(150–250ms) · medium(250–400ms). No long/choreographed animation — this is a glance, not an experience. (v1.3: reactive reorder uses a short move transition so cards don't jump — deferred with the reactive engine.)

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-17 | Editorial newspaper aesthetic; Fraunces + JetBrains Mono numerals; verdict-as-hero; light-only | `/plan-design-review` moved shipped v1 from 6.5→9/10 (decisions D1–D6) |
| 2026-05-20 | Replace Inter with Geist for UI/labels/meta | Inter is the #1 AI-convergence font; the sans role is small (Fraunces carries body), so a font with technical character pairs better |
| 2026-05-20 | Grid emphasis = size (Pattern 1) + reactive status (Pattern 2) | Vary volume not content; surface what's off-track automatically. Avoids verdict fatigue when every card emits a verdict |
| 2026-05-20 | Reactive emphasis over manual/pinned | A self-reordering page that surfaces problems beats a screenshot-stable one for a Monday-morning EM glance (user call) |
| 2026-05-20 | **Phase the emphasis model: v1.2 = canonical status + color only; reactive sort/volume/animation → v1.3** | `/plan-eng-review` reconciliation: the reactive engine was never in the v1.2 plan's zero-buffer 2-weekend budget. The demo's value is the Add-Widget flow, not auto-sorting; manual order demos fine. Phasing protects the wedge |
| 2026-05-20 | **Canonical status split into two fields: `status` (verdict band) + `state` (runtime health)** | `/plan-eng-review` + Codex outside voice: a single enum conflated verdict outcome with loading/error/empty/unauthorized. Two fields keep color logic clean and make the v1.3 sort a pure additive change |
| 2026-05-20 | **Status band mapping handles enum/boolean outcomes, not just numeric thresholds** | Codex flagged that GitHub PR verdicts hinge on booleans/enums/age/failed-checks, not only numeric compares; the band→status map must not assume numeric dominance |
| 2026-05-20 | Defer pinned North Star slot + progressive receipt disclosure | Net-new scope; both add a runtime concept that doesn't exist yet. Later version |
| 2026-05-20 | `verdict_card` stays first-class; renders fewer slots at M/S rather than hiding receipts | Protects the v1 screenshot magic without bloating the grid; consistent with deferring progressive disclosure |
