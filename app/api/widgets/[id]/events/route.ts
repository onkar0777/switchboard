import { JobStore } from "@/lib/authoring/job-store";
import { join } from "node:path";

export const dynamic = "force-dynamic";

// Polls the durable job and streams its full state as SSE. Polling (not an
// in-memory emitter) keeps the stream correct across the serial runner and a
// backend restart — the job file is the single source of truth.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const store = new JobStore(join(process.cwd(), ".switchboard", "jobs"));
  const encoder = new TextEncoder();
  let last = "";
  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        const job = await store.get(params.id);
        const snapshot = JSON.stringify(job ?? null);
        if (snapshot !== last) {
          last = snapshot;
          controller.enqueue(encoder.encode(`data: ${snapshot}\n\n`));
        }
        if (job && (job.state === "done" || job.state === "failed")) {
          controller.close();
          return;
        }
        setTimeout(send, 500);
      };
      await send();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
