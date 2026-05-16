import { headers } from "next/headers";
import type { Verdict } from "@/lib/verdicts/types";

export type FetchVerdictResult =
  | { ok: true; verdict: Verdict }
  | { ok: false; status: number; code: string; message: string; retryAfterSeconds?: number };

export async function fetchVerdict(): Promise<FetchVerdictResult> {
  const h = headers();
  const host = h.get("host") ?? "localhost:8000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const res = await fetch(`${proto}://${host}/api/verdict`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return {
      ok: false,
      status: res.status,
      code: body.code ?? "unknown",
      message: body.error ?? `HTTP ${res.status}`,
      retryAfterSeconds: body.retryAfterSeconds,
    };
  }
  const verdict = (await res.json()) as Verdict;
  return { ok: true, verdict };
}
