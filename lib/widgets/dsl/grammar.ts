// Pure type surface for the verdict DSL. No runtime logic lives here.
export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export type Row = Record<string, unknown>;
export type Value = unknown;

export type Expr =
  | number
  | boolean
  | null
  | string // "{var}" => variable; otherwise a row-field path
  | { lit: Json }
  | { eq: [Expr, Expr] }
  | { gt: [Expr, Expr] }
  | { lt: [Expr, Expr] }
  | { gte: [Expr, Expr] }
  | { lte: [Expr, Expr] }
  | { in: [Expr, Expr] }
  | { matches: [Expr, string] }
  | { and: Expr[] }
  | { or: Expr[] }
  | { not: Expr }
  | { size: Expr }
  | { round: Expr }
  | { hoursSince: Expr }
  | { cond: { when: Expr; then: Expr }[]; else: Expr };

export interface Band {
  min: number;
  out: string;
}

export type Op =
  | { op: "select"; from: string }
  | { op: "selectBag"; from: string }
  | { op: "stash"; as: string }
  | { op: "filter"; where: Expr }
  | { op: "map"; fields: Record<string, Expr> }
  | { op: "sort"; by: string; dir: "asc" | "desc" }
  | { op: "first" }
  | { op: "reduce"; as: string; kind: "count" | "sum"; field?: string }
  | { op: "bucket"; as: string; by: string; count: number }
  | { op: "compare"; as: string; left: Expr; right: Expr; bands: Band[] }
  | { op: "set"; as: string; to: Expr }
  | { op: "format"; as?: string; template: string };

export type Pipeline = Op[];
