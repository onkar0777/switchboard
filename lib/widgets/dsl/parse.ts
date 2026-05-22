import type { Op, Pipeline } from "./grammar";

export class DslParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DslParseError";
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const KNOWN_OPS = new Set([
  "select", "selectBag", "stash", "filter", "map", "sort",
  "first", "reduce", "bucket", "compare", "set", "format",
]);

function req(node: Record<string, unknown>, key: string, idx: number): void {
  if (!(key in node) || node[key] === undefined) {
    throw new DslParseError(`op at index ${idx} ("${String(node.op)}") is missing required field "${key}"`);
  }
}

// Structural validation only. Expression internals are validated lazily by the
// evaluator (which throws DslEvalError) — keeping the parser small and the error
// surface honest about what is statically checkable.
export function parsePipeline(input: unknown): Pipeline {
  if (!Array.isArray(input)) {
    throw new DslParseError("pipeline must be an array of operations");
  }
  return input.map((node, idx) => {
    if (!isObj(node) || typeof node.op !== "string") {
      throw new DslParseError(`op at index ${idx} must be an object with a string "op"`);
    }
    if (!KNOWN_OPS.has(node.op)) {
      throw new DslParseError(`unknown op "${node.op}" at index ${idx}`);
    }
    switch (node.op) {
      case "select":
      case "selectBag":
        req(node, "from", idx);
        break;
      case "stash":
        req(node, "as", idx);
        break;
      case "filter":
        req(node, "where", idx);
        break;
      case "map":
        req(node, "fields", idx);
        break;
      case "sort":
        req(node, "by", idx);
        req(node, "dir", idx);
        break;
      case "reduce":
        req(node, "as", idx);
        req(node, "kind", idx);
        break;
      case "bucket":
        req(node, "as", idx);
        req(node, "by", idx);
        req(node, "count", idx);
        break;
      case "compare":
        req(node, "as", idx);
        req(node, "left", idx);
        req(node, "right", idx);
        req(node, "bands", idx);
        break;
      case "set":
        req(node, "as", idx);
        req(node, "to", idx);
        break;
      case "format":
        req(node, "template", idx);
        break;
      case "first":
        break;
    }
    return node as unknown as Op;
  });
}
