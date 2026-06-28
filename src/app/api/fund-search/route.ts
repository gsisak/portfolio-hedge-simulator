import { NextResponse } from "next/server";
import { searchFunds } from "@/lib/fund-search";
import { fetchQuotes } from "@/lib/quotes";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { query?: string };
    const query = body.query?.trim();

    if (!query) {
      return NextResponse.json({ error: "query required" }, { status: 400 });
    }

    const recommendations = await searchFunds(query);
    const symbols = recommendations.map((r) => r.symbol);
    const quotes = symbols.length > 0 ? await fetchQuotes(symbols) : [];
    const priceMap = new Map(quotes.map((q) => [q.symbol, q.price]));

    return NextResponse.json({
      query,
      recommendations: recommendations.map((r) => ({
        ...r,
        price: priceMap.get(r.symbol) ?? null,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fund search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
