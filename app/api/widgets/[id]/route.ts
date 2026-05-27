import { NextResponse } from "next/server";
import { getRunner } from "@/lib/authoring/runner-singleton";

export const dynamic = "force-dynamic";

// Discard is a lifecycle action (a dedicated REST verb), not an authoring input —
// hence DELETE here rather than an overload of the answer POST. discard() is
// idempotent and never throws on a missing job, so this is always 200.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await getRunner().discard(params.id);
  return NextResponse.json({ ok: true });
}
