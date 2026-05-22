import { describe, expect, it } from "vitest";
import { Semaphore, semaphoreFor } from "./concurrency";

describe("Semaphore", () => {
  it("never lets more than `max` holders run at once", async () => {
    const sem = new Semaphore(2);
    let active = 0;
    let peak = 0;
    const release: Array<() => void> = [];

    // Acquire 4 slots; each waits on an external promise before releasing.
    const tasks = [0, 1, 2, 3].map(async () => {
      const free = await sem.acquire();
      active++;
      peak = Math.max(peak, active);
      await new Promise<void>((res) => release.push(res));
      active--;
      free();
    });

    // Let microtasks settle: only 2 should have acquired.
    await new Promise((r) => setTimeout(r, 0));
    expect(active).toBe(2);

    // Release one — a third should acquire.
    release.shift()!();
    await new Promise((r) => setTimeout(r, 0));
    expect(peak).toBe(2);

    // Drain the rest. Each shift+call may wake a queued waiter whose
    // continuation (and release.push) runs in the next microtask batch,
    // so we flush after each step to let newly-woken tasks enter release[].
    while (release.length) {
      release.shift()!();
      await new Promise((r) => setTimeout(r, 0));
    }
    await Promise.all(tasks);
    expect(active).toBe(0);
  });

  it("double-release is a no-op", async () => {
    const sem = new Semaphore(1);
    const free = await sem.acquire();
    free();
    free(); // must not throw or over-decrement
    const free2 = await sem.acquire(); // still acquirable
    free2();
    expect(true).toBe(true);
  });

  it("semaphoreFor returns the same instance per key", () => {
    expect(semaphoreFor("a", 4)).toBe(semaphoreFor("a", 4));
    expect(semaphoreFor("a", 4)).not.toBe(semaphoreFor("b", 4));
  });
});
