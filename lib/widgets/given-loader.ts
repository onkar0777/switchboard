import type { PipelineInput } from "./dsl/evaluate";

// A golden case's `given` is keyed by MCP query name and already holds canonical
// rows (post-map). execute() consumes `{ queries: { <queryName>: rows[] } }`,
// so the loader is a thin, named wrapper rather than a transform.
export function givenToPipelineInput(given: Record<string, Array<Record<string, unknown>>>): PipelineInput {
  return { queries: given };
}
