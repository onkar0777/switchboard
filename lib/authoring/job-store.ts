import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Job, JobState } from "./job-types";

const TERMINAL: JobState[] = ["done", "failed"];

// Durable job store backed by .switchboard/jobs/<id>.json. Writes are
// tmp-then-rename for crash safety. A fresh instance re-reads from disk, so
// jobs survive a backend restart (the durability the spec requires).
export class JobStore {
  constructor(private readonly dir: string) {}

  private path(id: string): string {
    return join(this.dir, `${id}.json`);
  }

  async create(intent: string): Promise<Job> {
    const now = new Date().toISOString();
    const job: Job = { id: randomUUID(), intent, state: "queued", createdAt: now, updatedAt: now };
    await this.save(job);
    return job;
  }

  async save(job: Job): Promise<Job> {
    await mkdir(this.dir, { recursive: true });
    const next = { ...job, updatedAt: new Date().toISOString() };
    const tmp = this.path(`${job.id}.tmp-${randomUUID()}`);
    await writeFile(tmp, JSON.stringify(next, null, 2), "utf8");
    await rename(tmp, this.path(job.id)); // atomic on same filesystem
    return next;
  }

  async get(id: string): Promise<Job | undefined> {
    try {
      return JSON.parse(await readFile(this.path(id), "utf8")) as Job;
    } catch {
      return undefined;
    }
  }

  async list(): Promise<Job[]> {
    let names: string[];
    try {
      names = await readdir(this.dir);
    } catch {
      return [];
    }
    const ids = names.filter((n) => n.endsWith(".json") && !n.includes(".tmp-")).map((n) => n.slice(0, -5));
    const jobs = await Promise.all(ids.map((id) => this.get(id)));
    return jobs.filter((j): j is Job => Boolean(j)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  // The single in-flight build (serial constraint): non-queued, non-terminal.
  async findActive(): Promise<Job | undefined> {
    return (await this.list()).find((j) => j.state !== "queued" && !TERMINAL.includes(j.state));
  }

  async nextQueued(): Promise<Job | undefined> {
    return (await this.list()).find((j) => j.state === "queued");
  }
}
