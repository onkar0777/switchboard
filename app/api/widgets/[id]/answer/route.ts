import { NextResponse } from "next/server";
import { getRunner } from "@/lib/authoring/runner-singleton";

export const dynamic = "force-dynamic";

// Body is one of:
//   { kind: "answer", answers: { <questionText>: string | string[] } }
//   { kind: "proceed" }
//   { kind: "feedback", text: string }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = (await req.json()) as
    | { kind: "answer"; answers: Record<string, string | string[]> }
    | { kind: "proceed" }
    | { kind: "feedback"; text: string };
  const runner = getRunner();
  try {
    if (body.kind === "answer") await runner.answer(params.id, body.answers);
    else if (body.kind === "proceed") await runner.proceed(params.id);
    else if (body.kind === "feedback") await runner.feedback(params.id, body.text);
    else return NextResponse.json({ error: "unknown kind" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
