// Typed errors for the live MCP data path. Each maps to a user-facing widget
// message via describeMcpError; the loader turns any of these into state:"error".
export class McpUnavailableError extends Error {
  constructor(public readonly server: string, message: string) {
    super(message);
    this.name = "McpUnavailableError";
  }
}

export class McpTimeoutError extends Error {
  constructor(public readonly server: string, public readonly tool: string) {
    super(`MCP tool "${tool}" on "${server}" timed out`);
    this.name = "McpTimeoutError";
  }
}

export class McpDriftError extends Error {
  constructor(public readonly server: string, public readonly tool: string) {
    super(`MCP tool "${tool}" is no longer exposed by "${server}" — re-author this widget`);
    this.name = "McpDriftError";
  }
}

export class McpBudgetError extends Error {
  constructor(public readonly server: string) {
    super(`MCP queries for "${server}" exceeded the per-widget time budget`);
    this.name = "McpBudgetError";
  }
}

// Maps any error thrown by the MCP data path to a calm, user-facing message.
export function describeMcpError(err: unknown, server: string): string {
  if (err instanceof McpDriftError) return err.message;
  if (err instanceof McpTimeoutError) return `The ${server} MCP server timed out. Retry.`;
  if (err instanceof McpBudgetError) return `The ${server} MCP server was too slow. Retry.`;
  if (err instanceof McpUnavailableError) return `Can't reach the ${server} MCP server.`;
  return err instanceof Error ? `Couldn't compute: ${err.message}` : "Couldn't compute.";
}
