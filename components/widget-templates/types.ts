import type { RuntimeOutput } from "@/lib/widgets/runtime";

// Render-side output: the pure runtime output plus the widget title the grid
// supplies. Structurally identical to VerdictCardOutput.
export interface WidgetOutput extends RuntimeOutput {
  title: string;
}
