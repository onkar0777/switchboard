import type {
  AdapterResult,
  ListMergedPRsArgs,
  ListOpenPRsArgs,
  MCPAdapter,
} from "./adapter";
import type { Receipt } from "@/lib/verdicts/types";
import { MOCK_PRS } from "./fixtures";

export class MockAdapter implements MCPAdapter {
  private readonly pool: Receipt[];

  constructor(pool: Receipt[] = MOCK_PRS) {
    this.pool = pool;
  }

  async listMergedPRs(args: ListMergedPRsArgs): Promise<AdapterResult<Receipt[]>> {
    const since = new Date(args.since).getTime();
    const until = new Date(args.until).getTime();
    const repos = new Set(args.repos);
    const data = this.pool.filter((p) => {
      if (!p.mergedAt) return false;
      if (!repos.has(p.repo)) return false;
      const t = new Date(p.mergedAt).getTime();
      return t >= since && t <= until;
    });
    return { ok: true, data };
  }

  async listOpenPRs(args: ListOpenPRsArgs): Promise<AdapterResult<Receipt[]>> {
    const repos = new Set(args.repos);
    const data = this.pool.filter((p) => !p.mergedAt && repos.has(p.repo));
    return { ok: true, data };
  }
}
