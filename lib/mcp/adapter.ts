import type { Receipt } from "@/lib/verdicts/types";

export type AdapterErrorCode =
  | "auth_failed"
  | "rate_limited"
  | "network"
  | "not_found"
  | "unknown";

export interface AdapterError {
  code: AdapterErrorCode;
  message: string;
  retryAfterSeconds?: number;
}

export type AdapterResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AdapterError };

export interface ListMergedPRsArgs {
  repos: string[];
  author: string;
  since: string;
  until: string;
}

export interface ListOpenPRsArgs {
  repos: string[];
  author: string;
}

export interface MCPAdapter {
  listMergedPRs(args: ListMergedPRsArgs): Promise<AdapterResult<Receipt[]>>;
  listOpenPRs(args: ListOpenPRsArgs): Promise<AdapterResult<Receipt[]>>;
}
