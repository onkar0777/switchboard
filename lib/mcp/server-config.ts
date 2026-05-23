import { z } from "zod";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { McpUnavailableError } from "./errors";

export const HttpTransportSchema = z.object({
  type: z.literal("http"),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
});

export const StdioTransportSchema = z.object({
  type: z.literal("stdio"),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional(),
});

export const ServerConfigSchema = z.object({
  name: z.string().min(1),
  transport: z.discriminatedUnion("type", [HttpTransportSchema, StdioTransportSchema]),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

// Substitutes ${VAR} references in every string of the parsed config with the
// matching environment variable, so secrets (e.g. a GitHub PAT) live in the
// environment / .env.local, not in the committed mcp/<name>.json. Throws when a
// referenced variable is unset — a clear "you forgot to set it" signal instead
// of sending the literal "${VAR}" to the server.
export function interpolateEnv(value: unknown, name: string): unknown {
  if (typeof value === "string") {
    return value.replace(/\$\{(\w+)\}/g, (_m, envName: string) => {
      const v = process.env[envName];
      if (v === undefined || v === "") {
        throw new McpUnavailableError(
          name,
          `environment variable ${envName} (referenced in mcp/${name}.json) is not set`,
        );
      }
      return v;
    });
  }
  if (Array.isArray(value)) return value.map((v) => interpolateEnv(v, name));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = interpolateEnv(v, name);
    return out;
  }
  return value;
}

export async function loadServerConfig(name: string, dir = path.join(process.cwd(), "mcp")): Promise<ServerConfig> {
  const file = path.join(dir, `${name}.json`);
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    throw new McpUnavailableError(name, `no MCP config at ${file}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new McpUnavailableError(name, `${file} is not valid JSON`);
  }
  // Resolve ${ENV} references before validation (throws McpUnavailableError on
  // a missing variable, which propagates as-is).
  const resolved = interpolateEnv(json, name);
  const parsed = ServerConfigSchema.safeParse(resolved);
  if (!parsed.success) {
    throw new McpUnavailableError(name, `${file} is invalid: ${parsed.error.message}`);
  }
  return parsed.data;
}
