import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkBotId } from "botid/server";
import { checkRouteLimit } from "@/lib/limits";

const BodySchema = z.object({
  email: z.email("Please enter a valid email address.").max(254),
});

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;

  if (!apiKey || !audienceId) {
    return NextResponse.json(
      { error: "Newsletter service temporarily unavailable." },
      { status: 503 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }
  const email = parsed.data.email.trim().toLowerCase();

  // Durable per-IP limit (Upstash), platform-trusted IP.
  const limit = await checkRouteLimit("subscribe", request);
  if (!limit.ok) {
    return NextResponse.json({ error: limit.error }, { status: limit.status });
  }

  // Bot check: this route writes to the audience list.
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "Automated traffic detected." }, { status: 403 });
  }

  try {
    const res = await fetch(
      `https://api.resend.com/audiences/${audienceId}/contacts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ email }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend API error:", errText);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Subscribe error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
