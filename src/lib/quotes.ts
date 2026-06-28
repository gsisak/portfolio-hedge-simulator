import YahooFinance from "yahoo-finance2";
import type { QuoteResult } from "@/lib/types";

const yahooFinance = new YahooFinance();

export async function fetchQuotes(symbols: string[]): Promise<QuoteResult[]> {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))].filter(
    (s) => s !== "CASH",
  );

  if (unique.length === 0) return [];

  try {
    const quotes = await yahooFinance.quote(unique);
    const list = Array.isArray(quotes) ? quotes : [quotes];

    return list
      .filter((q) => q.regularMarketPrice != null)
      .map((q) => ({
        symbol: (q.symbol ?? "").toUpperCase(),
        price: q.regularMarketPrice ?? 0,
        currency: q.currency ?? "USD",
        name: q.shortName ?? q.longName,
        quoteType: q.quoteType,
        categoryName: (q as { category?: string }).category,
      }));
  } catch {
    return [];
  }
}
