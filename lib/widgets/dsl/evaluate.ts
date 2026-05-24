import type { Band, Expr, Op, Pipeline, Row, Value } from "./grammar";

export class DslEvalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DslEvalError";
  }
}

export interface DslContext {
  now: Date;
  nowMs: number;
  [k: string]: unknown; // weekStartIso, weekEndIso, fourWeeksAgoIso, ...spec.params
}

export interface PipelineInput {
  queries: Record<string, unknown>;
}

interface Scope {
  bag: Record<string, Value>;
  ctx: DslContext;
  row?: Row;
}

const HOUR_MS = 3_600_000;

export function truthy(v: Value): boolean {
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "number") return v !== 0 && !Number.isNaN(v);
  return Boolean(v);
}

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc != null && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function resolveVar(name: string, scope: Scope): Value {
  if (name in scope.bag) return scope.bag[name];
  if (name in scope.ctx) return scope.ctx[name];
  return undefined;
}

export function evalExpr(expr: Expr, scope: Scope): Value {
  if (expr === null || typeof expr === "number" || typeof expr === "boolean") return expr;
  if (typeof expr === "string") {
    if (expr.startsWith("{") && expr.endsWith("}")) return resolveVar(expr.slice(1, -1), scope);
    if (scope.row === undefined) {
      throw new DslEvalError(`row-field reference "${expr}" used outside a row scope`);
    }
    return getPath(scope.row, expr);
  }
  if ("lit" in expr) return expr.lit;
  if ("eq" in expr) return evalExpr(expr.eq[0], scope) === evalExpr(expr.eq[1], scope);
  if ("gt" in expr) return num(expr.gt[0], scope) > num(expr.gt[1], scope);
  if ("lt" in expr) return num(expr.lt[0], scope) < num(expr.lt[1], scope);
  if ("gte" in expr) return cmp(expr.gte[0], expr.gte[1], scope) >= 0;
  if ("lte" in expr) return cmp(expr.lte[0], expr.lte[1], scope) <= 0;
  if ("in" in expr) {
    const hay = evalExpr(expr.in[1], scope);
    return Array.isArray(hay) && hay.includes(evalExpr(expr.in[0], scope));
  }
  if ("matches" in expr) {
    const pattern = expr.matches[1];
    let re: RegExp;
    try {
      re = new RegExp(pattern);
    } catch {
      throw new DslEvalError(`invalid regex in matches: "${pattern}"`);
    }
    return re.test(String(evalExpr(expr.matches[0], scope)));
  }
  if ("and" in expr) return expr.and.every((e) => truthy(evalExpr(e, scope)));
  if ("or" in expr) return expr.or.some((e) => truthy(evalExpr(e, scope)));
  if ("not" in expr) return !truthy(evalExpr(expr.not, scope));
  if ("size" in expr) {
    const v = evalExpr(expr.size, scope);
    return Array.isArray(v) ? v.length : 0;
  }
  if ("round" in expr) return Math.round(num(expr.round, scope));
  if ("hoursSince" in expr) {
    const iso = String(evalExpr(expr.hoursSince, scope));
    return Math.round((scope.ctx.nowMs - Date.parse(iso)) / HOUR_MS);
  }
  if ("cond" in expr) {
    for (const branch of expr.cond) if (truthy(evalExpr(branch.when, scope))) return evalExpr(branch.then, scope);
    return evalExpr(expr.else, scope);
  }
  throw new DslEvalError(`unrecognized expression: ${JSON.stringify(expr)}`);
}

function num(e: Expr, scope: Scope): number {
  return Number(evalExpr(e, scope));
}

// Comparison that works for both numbers and ISO date strings (lexicographic
// ISO ordering == chronological ordering), used by gte/lte.
function cmp(a: Expr, b: Expr, scope: Scope): number {
  const av = evalExpr(a, scope);
  const bv = evalExpr(b, scope);
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  const as = String(av);
  const bs = String(bv);
  return as < bs ? -1 : as > bs ? 1 : 0;
}

function asRows(v: Value, opName: string): Row[] {
  if (!Array.isArray(v)) throw new DslEvalError(`op "${opName}" expected an array, got ${typeof v}`);
  return v as Row[];
}

export function evaluate(pipeline: Pipeline, input: PipelineInput, ctx: DslContext): Record<string, Value> {
  const bag: Record<string, Value> = {};
  let current: Value = null;
  const scope = (row?: Row): Scope => ({ bag, ctx, row });

  for (const op of pipeline) {
    current = runOp(op, current, input, bag, ctx, scope);
  }
  return bag;
}

function runOp(
  op: Op,
  current: Value,
  input: PipelineInput,
  bag: Record<string, Value>,
  ctx: DslContext,
  scope: (row?: Row) => Scope,
): Value {
  switch (op.op) {
    case "select": {
      const key = op.from.replace(/^queries\./, "");
      if (!(key in input.queries)) throw new DslEvalError(`no query named "${key}"`);
      return input.queries[key];
    }
    case "selectBag": {
      if (!(op.from in bag)) throw new DslEvalError(`no bag value named "${op.from}"`);
      return bag[op.from];
    }
    case "stash":
      bag[op.as] = current;
      return current;
    case "filter":
      return asRows(current, "filter").filter((row) => truthy(evalExpr(op.where, scope(row))));
    case "map":
      return asRows(current, "map").map((row) => {
        const out: Row = {};
        for (const [k, e] of Object.entries(op.fields)) out[k] = evalExpr(e, scope(row));
        return out;
      });
    case "sort": {
      const rows = [...asRows(current, "sort")];
      const sign = op.dir === "desc" ? -1 : 1;
      return rows.sort((a, b) => sign * sortCmp(a, b, op.by));
    }
    case "first": {
      const rows = asRows(current, "first");
      return rows.length > 0 ? rows[0] : null;
    }
    case "reduce": {
      const rows = asRows(current, "reduce");
      let result: number;
      if (op.kind === "count") {
        result = rows.length;
      } else {
        result = rows.reduce((sum, row) => sum + Number(getPath(row, op.field ?? "")), 0);
      }
      bag[op.as] = result;
      return result;
    }
    case "bucket": {
      const rows = asRows(current, "bucket");
      const field = op.by.replace(/^weekOf:/, "");
      const anchorStart = Date.parse(String(ctx.weekStartIso)); // start of the current (last) week
      const WEEK = 7 * 24 * HOUR_MS;
      const counts = new Array<number>(op.count).fill(0);
      for (const row of rows) {
        const raw = getPath(row, field);
        if (raw == null) continue;
        const t = Date.parse(String(raw));
        for (let i = 0; i < op.count; i++) {
          const start = anchorStart - (op.count - 1 - i) * WEEK;
          if (t >= start && t < start + WEEK) {
            counts[i]++;
            break;
          }
        }
      }
      bag[op.as] = counts;
      return counts;
    }
    case "set": {
      const v = evalExpr(op.to, scope());
      bag[op.as] = v;
      return v;
    }
    case "compare": {
      const left = Number(evalExpr(op.left, scope()));
      const right = Number(evalExpr(op.right, scope()));
      const bands: Band[] = op.bands;
      let out: string;
      if (!(right > 0)) {
        out = bands[bands.length - 1].out;
      } else {
        const ratio = left / right;
        const match = bands.find((b) => ratio >= b.min);
        out = (match ?? bands[bands.length - 1]).out;
      }
      bag[op.as] = out;
      return out;
    }
    case "format": {
      // When the current pipeline value is null (e.g. `first` on an empty set),
      // the format has no row to interpolate from — produce "" so that downstream
      // `cond` guards correctly test for an absent value.
      const out = current === null ? "" : renderTemplate(op.template, current, bag, ctx);
      const key = op.as ?? "verdict";
      bag[key] = out;
      return out;
    }
    default:
      throw new DslEvalError(`op "${(op as Op).op}" not implemented yet`);
  }
}

function sortCmp(a: Row, b: Row, by: string): number {
  const av = getPath(a, by);
  const bv = getPath(b, by);
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  const as = String(av);
  const bs = String(bv);
  return as < bs ? -1 : as > bs ? 1 : 0;
}

// Resolves a {name} placeholder: current-row field (when current is a plain
// object) -> bag -> ctx.
function resolvePlaceholder(name: string, current: Value, bag: Record<string, Value>, ctx: DslContext): Value {
  if (current != null && typeof current === "object" && !Array.isArray(current)) {
    const fromRow = (current as Row)[name];
    if (fromRow !== undefined) return fromRow;
  }
  if (name in bag) return bag[name];
  if (name in ctx) return ctx[name];
  return undefined;
}

function applyModifier(value: Value, mod: string | undefined, ctx: DslContext): string {
  if (!mod) return value == null ? "" : String(value);
  const m = /^(\w+)(?:\((.*)\))?$/.exec(mod);
  if (!m) throw new DslEvalError(`bad format modifier "${mod}"`);
  const [, name, rawArgs = ""] = m;
  switch (name) {
    case "plural": {
      const [one, many] = rawArgs.split("|");
      return Number(value) === 1 ? one : many;
    }
    case "map": {
      const table = new Map<string, string>();
      for (const entry of rawArgs.split(",")) {
        const eq = entry.indexOf("=");
        if (eq >= 0) table.set(entry.slice(0, eq), entry.slice(eq + 1));
      }
      return table.get(String(value)) ?? String(value);
    }
    case "round":
      return String(Math.round(Number(value)));
    case "hoursSince":
      return String(Math.round((ctx.nowMs - Date.parse(String(value))) / HOUR_MS));
    default:
      throw new DslEvalError(`unknown format modifier "${name}"`);
  }
}

function interpolate(text: string, current: Value, bag: Record<string, Value>, ctx: DslContext): string {
  return text.replace(/\{([\w.]+)(?::([^}]+))?\}/g, (_match, path: string, mod?: string) => {
    const value = resolvePlaceholder(path, current, bag, ctx);
    return applyModifier(value, mod, ctx);
  });
}

function renderTemplate(template: string, current: Value, bag: Record<string, Value>, ctx: DslContext): string {
  // First resolve conditional segments {?name}...{/name}, then interpolate.
  const withConds = template.replace(/\{\?(\w+)\}([\s\S]*?)\{\/\1\}/g, (_m, name: string, inner: string) => {
    return truthy(resolvePlaceholder(name, current, bag, ctx)) ? inner : "";
  });
  return interpolate(withConds, current, bag, ctx);
}
