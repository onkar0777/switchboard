import { NextResponse } from "next/server";
import { getRunner } from "@/lib/authoring/runner-singleton";

export const dynamic = "force-dynamic";

// Body is one of:
//   { kind: "answer", answers: { <questionText>: string | string[] } }
//   { kind: "proceed" }
//   { kind: "feedback", text: string }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  let body: { kind: string; answers?: unknown; text?: unknown };
  try {
    body = (await req.json()) as { kind: string; answers?: unknown; text?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const runner = getRunner();

  switch (body.kind) {
    case "answer": {
      if (!body.answers || typeof body.answers !== "object") {
        return NextResponse.json({ error: "answers must be a non-null object" }, { status: 400 });
      }
      try {
        await runner.answer(params.id, body.answers as Record<string, string | string[]>);
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 409 });
      }
      break;
    }
    case "proceed": {
      try {
        await runner.proceed(params.id);
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 409 });
      }
      break;
    }
    case "feedback": {
      if (typeof body.text !== "string" || !body.text.trim()) {
        return NextResponse.json({ error: "text must be a non-empty string" }, { status: 400 });
      }
      try {
        await runner.feedback(params.id, body.text);
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 409 });
      }
      break;
    }
    default:
      return NextResponse.json({ error: "unknown kind" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
