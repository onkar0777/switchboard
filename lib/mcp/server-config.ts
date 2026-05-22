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
  const parsed = ServerConfigSchema.safeParse(json);
  if (!parsed.success) {
    throw new McpUnavailableError(name, `${file} is invalid: ${parsed.error.message}`);
  }
  return parsed.data;
}
