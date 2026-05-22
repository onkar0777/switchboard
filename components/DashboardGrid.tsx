import type { JSX } from "react";
import type { RuntimeOutput } from "@/lib/widgets/runtime";
import { VerdictCardTemplate } from "@/components/widget-templates/VerdictCardTemplate";
import { ScoreboardTemplate } from "@/components/widget-templates/ScoreboardTemplate";
import { ListTemplate } from "@/components/widget-templates/ListTemplate";
import { SingleStatTemplate } from "@/components/widget-templates/SingleStatTemplate";
import type { WidgetOutput } from "@/components/widget-templates/types";
import { EYEBROW } from "@/lib/design-tokens";

export interface GridWidget {
  id: string;
  title: string;
  size: "S" | "M" | "L";
  template: "verdict_card" | "scoreboard" | "list" | "single_stat";
  output: RuntimeOutput;
  errorMessage?: string;
}

const SPAN: Record<GridWidget["size"], string> = {
  S: "col-span-1 md:col-span-1",
  M: "col-span-1 md:col-span-2",
  L: "col-span-4 md:col-span-4",
};

const TEMPLATES: Record<GridWidget["template"], (props: { output: WidgetOutput }) => JSX.Element> = {
  verdict_card: VerdictCardTemplate,
  scoreboard: ScoreboardTemplate,
  list: ListTemplate,
  single_stat: SingleStatTemplate,
};

function FailureState({ widget }: { widget: GridWidget }) {
  const { state } = widget.output;
  const message =
    widget.errorMessage ??
    (state === "unauthorized"
      ? "Switchboard couldn't find Claude Code credentials."
      : state === "empty"
        ? "Nothing to show yet."
        : "Couldn't load this widget.");
  return (
    <article className="space-y-3" role="article" aria-label={`${widget.title} (failed)`}>
      <p className={EYEBROW}>{widget.title}</p>
      {state === "loading" ? (
        <div className="h-10 w-3/4 animate-pulse bg-stone-200" aria-label="loading" />
      ) : (
        <p className="border-l-2 border-rose-700 bg-rose-50 px-5 py-4 font-serif text-[22px] leading-snug text-rose-700">
          {message}
        </p>
      )}
    </article>
  );
}

function WidgetCell({ widget }: { widget: GridWidget }) {
  // Render the authored template only when state === "ok" (color logic lives in
  // each template); otherwise the failure-state UX. An unknown template name
  // (e.g. from a future layout loader bypassing the zod parse) also falls back
  // to FailureState rather than crashing the grid. Authored order, no re-sort.
  const Template = TEMPLATES[widget.template] ?? null;
  const body =
    widget.output.state === "ok" && Template ? (
      <Template output={{ ...widget.output, title: widget.title }} />
    ) : (
      <FailureState widget={widget} />
    );
  return <section className={`border-t border-stone-200 pt-6 ${SPAN[widget.size]}`}>{body}</section>;
}

export function DashboardGrid({ widgets }: { widgets: GridWidget[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-4">
      {widgets.map((w) => (
        <WidgetCell key={w.id} widget={w} />
      ))}
    </div>
  );
}
