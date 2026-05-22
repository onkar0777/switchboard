import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ServerConfig } from "./server-config";
import { semaphoreFor } from "./concurrency";
import { McpTimeoutError } from "./errors";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_CAP = 4;
const DEFAULT_RETRIES = 1;

export interface McpRunner {
  listToolNames(opts?: { signal?: AbortSignal }): Promise<string[]>;
  callTool(name: string, args: Record<string, unknown>, opts?: { signal?: AbortSignal }): Promise<unknown>;
  close(): Promise<void>;
}

interface RunnerOpts {
  serverName: string;
  cap?: number;
  timeoutMs?: number;
  retries?: number;
}

export function chooseTransport(config: ServerConfig): StreamableHTTPClientTransport | StdioClientTransport {
  if (config.transport.type === "http") {
    return new StreamableHTTPClientTransport(new URL(config.transport.url), {
      requestInit: config.transport.headers ? { headers: config.transport.headers } : undefined,
    });
  }
  return new StdioClientTransport({
    command: config.transport.command,
    args: config.transport.args,
    env: config.transport.env,
  });
}

function isTransient(err: unknown): boolean {
  if (err instanceof McpTimeoutError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /network|ECONN|ETIMEDOUT|socket|fetch failed|connection closed|hang up/i.test(msg);
}

// Wraps a connected Client with the resilience contract: per-call timeout +
// AbortSignal, one transient retry (no backoff), and a per-server concurrency cap.
export function makeRunner(client: Client, opts: RunnerOpts): McpRunner {
  const cap = opts.cap ?? DEFAULT_CAP;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = opts.retries ?? DEFAULT_RETRIES;
  const sem = semaphoreFor(opts.serverName, cap);

  async function callOnce(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
    try {
      return await client.callTool({ name, arguments: args }, undefined, { signal, timeout: timeoutMs });
    } catch (err) {
      if (signal?.aborted) throw signal.reason ?? err; // preserve external abort reason (e.g. McpBudgetError)
      const msg = err instanceof Error ? err.message : String(err);
      if (/timed out|timeout|-32001/i.test(msg)) throw new McpTimeoutError(opts.serverName, name);
      throw err;
    }
  }

  return {
    async listToolNames(listOpts) {
      const res = await client.listTools(undefined, { signal: listOpts?.signal, timeout: timeoutMs });
      return res.tools.map((t) => t.name);
    },
    async callTool(name, args, callOpts) {
      const release = await sem.acquire();
      try {
        let lastErr: unknown;
        for (let attempt = 0; attempt <= retries; attempt++) {
          if (callOpts?.signal?.aborted) throw callOpts.signal.reason ?? new Error("aborted");
          try {
            const res = (await callOnce(name, args, callOpts?.signal)) as {
              isError?: boolean;
              content?: Array<{ type: string; text?: string }>;
            };
            if (res?.isError) {
              const text = (res.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("");
              throw new Error(text || `tool "${name}" returned an error`);
            }
            return res;
          } catch (err) {
            lastErr = err;
            if (attempt === retries || !isTransient(err)) throw err;
          }
        }
        throw lastErr;
      } finally {
        release();
      }
    },
    async close() {
      await client.close();
    },
  };
}

export async function openRunner(config: ServerConfig, opts?: Partial<RunnerOpts>): Promise<McpRunner> {
  const client = new Client({ name: "switchboard", version: "1.2.0" });
  await client.connect(chooseTransport(config));
  return makeRunner(client, { serverName: config.name, ...opts });
}

export async function withServer<T>(config: ServerConfig, fn: (r: McpRunner) => Promise<T>): Promise<T> {
  const runner = await openRunner(config);
  try {
    return await fn(runner);
  } finally {
    await runner.close();
  }
}
