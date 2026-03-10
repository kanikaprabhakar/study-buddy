import { NextResponse } from "next/server";
import { getQuote } from "@/lib/quoterism";

export const runtime = "nodejs";

/**
 * GET /api/quote?id=quote-of-the-day  (default)
 * GET /api/quote?id=random
 * GET /api/quote?id=<any-id>
 *
 * Proxies to Quoterism so the API key never reaches the browser.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ?? "quote-of-the-day";

  try {
    const quote = await getQuote(id);
    // Cache until the next UTC midnight so the CDN/browser drops the quote exactly when Quoterism rotates it.
    const now = Date.now();
    const nextMidnight = new Date();
    nextMidnight.setUTCHours(24, 0, 0, 0);
    const secondsUntilMidnight = Math.max(60, Math.floor((nextMidnight.getTime() - now) / 1000));
    return NextResponse.json(quote, {
      headers: {
        "Cache-Control": `public, s-maxage=${secondsUntilMidnight}, stale-while-revalidate=60`,
      },
    });
  } catch (err) {
    console.error("[/api/quote]", err);
    return NextResponse.json(
      { error: "Failed to fetch quote" },
      { status: 502 }
    );
  }
}
