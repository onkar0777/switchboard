import { JobStore } from "@/lib/authoring/job-store";
import { join } from "node:path";

export const dynamic = "force-dynamic";

// Polls the durable job and streams its full state as SSE. Polling (not an
// in-memory emitter) keeps the stream correct across the serial runner and a
// backend restart — the job file is the single source of truth.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const store = new JobStore(join(process.cwd(), ".switchboard", "jobs"));
  const encoder = new TextEncoder();
  let last = "";
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  // Stop polling when the client disconnects.
  req.signal.addEventListener("abort", () => {
    stopped = true;
    if (timer !== undefined) clearTimeout(timer);
    try {
      controller.close();
    } catch {
      // already closed — ignore
    }
  });

  // Hoist so the abort listener can reference it before the stream is built.
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      controller = ctrl;

      const send = async () => {
        if (stopped) return;

        const job = await store.get(params.id);
        const snapshot = JSON.stringify(job ?? null);

        if (!stopped && snapshot !== last) {
          last = snapshot;
          controller.enqueue(encoder.encode(`data: ${snapshot}\n\n`));
        }

        if (job && (job.state === "done" || job.state === "failed")) {
          if (!stopped) {
            stopped = true;
            controller.close();
          }
          return;
        }

        if (!stopped) {
          timer = setTimeout(send, 500);
        }
      };

      await send();
    },

    cancel() {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
