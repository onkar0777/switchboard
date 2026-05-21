import type { RuntimeOutput } from "@/lib/widgets/runtime";
import { VerdictCardTemplate } from "@/components/widget-templates/VerdictCardTemplate";
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
  // Color on status only when state === "ok" (DESIGN.md). Otherwise failure UX.
  //
  // Intentional v1.2 fallthrough: only "verdict_card" is implemented in this step.
  // All other templates (scoreboard, list, single_stat) render FailureState here.
  // Step 5 will replace this ternary with a template registry lookup.
  const body =
    widget.output.state === "ok" && widget.template === "verdict_card" ? (
      <VerdictCardTemplate output={{ ...widget.output, title: widget.title }} />
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
