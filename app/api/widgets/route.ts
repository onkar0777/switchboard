import { NextResponse } from "next/server";
import { getRunner } from "@/lib/authoring/runner-singleton";
import { JobStore } from "@/lib/authoring/job-store";
import { join } from "node:path";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { intent } = (await req.json()) as { intent?: string };
  if (!intent || !intent.trim()) return NextResponse.json({ error: "intent required" }, { status: 400 });
  const job = await getRunner().enqueue(intent.trim());
  return NextResponse.json({ job });
}

export async function GET() {
  const store = new JobStore(join(process.cwd(), ".switchboard", "jobs"));
  return NextResponse.json({ jobs: await store.list() });
}
