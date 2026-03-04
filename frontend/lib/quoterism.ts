const BASE_URL = "https://quoterism.com/api";

export interface QuoteAuthor {
  id: string;
  name: string;
}

export interface Quote {
  id: string;
  text: string;
  author: QuoteAuthor;
}

export interface QuotePage {
  quotes: Quote[];
  total: number;
  page: number;
  limit: number;
}

function headers(): HeadersInit {
  return {
    "X-API-Key": process.env.QUOTERISM_API_KEY ?? "",
    "Content-Type": "application/json",
  };
}

/**
 * Fetch a single quote by ID.
 * Use id = "random" or id = "quote-of-the-day" for special values.
 */
export async function getQuote(id: string): Promise<Quote> {
  const res = await fetch(`${BASE_URL}/quotes/${id}`, {
    headers: headers(),
    next: { revalidate: 86400 }, // cache for 24 hours (daily quote)
  });
  if (!res.ok) throw new Error(`Quoterism error: ${res.status}`);
  return res.json() as Promise<Quote>;
}

/**
 * Fetch a paginated list of quotes.
 */
export async function getQuotes(page = 0, limit = 12): Promise<QuotePage> {
  const url = new URL(`${BASE_URL}/quotes`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), {
    headers: headers(),
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Quoterism error: ${res.status}`);
  return res.json() as Promise<QuotePage>;
}
