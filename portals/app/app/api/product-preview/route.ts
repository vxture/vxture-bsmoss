import { demoDataEnabled } from "../../lib/demo-mode";
import { NextResponse } from "next/server";
import { buildPreview } from "../../domains/preview/model.ts";
export async function POST(request: Request) {
  if (!demoDataEnabled())
    return new Response(null, { status: 404 });
  try {
    const text = await request.text();
    if (text.length > 20000)
      return NextResponse.json({ error: "request_too_large" }, { status: 413 });
    return NextResponse.json(buildPreview(JSON.parse(text)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "invalid_preview_configuration" },
      { status: 400 },
    );
  }
}
