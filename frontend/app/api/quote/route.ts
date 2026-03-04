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
    return NextResponse.json(quote, {
      headers: {
        // Cache for 24 hours — quote-of-the-day refreshes daily
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
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
