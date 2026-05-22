// A counting semaphore. acquire() resolves when a slot is free and returns an
// idempotent release fn. Used to bound concurrent in-flight MCP calls per server.
export class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async acquire(): Promise<() => void> {
    await new Promise<void>((resolve) => {
      const attempt = () => {
        if (this.active < this.max) {
          this.active++;
          resolve();
        } else {
          this.queue.push(attempt);
        }
      };
      attempt();
    });
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active--;
      this.queue.shift()?.();
    };
  }
}

const pool = new Map<string, Semaphore>();

// One semaphore per server name, shared across widget-loads in the process.
export function semaphoreFor(key: string, max: number): Semaphore {
  let s = pool.get(key);
  if (!s) {
    s = new Semaphore(max);
    pool.set(key, s);
  }
  return s;
}
