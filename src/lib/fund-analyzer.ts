import { resolveFundAnalysis } from "./exposure";
import { fetchQuotes } from "./quotes";
import type { FundAnalysis, Holding } from "./types";

export async function analyzeHoldings(
  holdings: Array<{ symbol: string; shares: number }>,
  fetchPrices: boolean,
): Promise<{
  holdings: Holding[];
  priceMeta: { symbol: string; price: number; live: boolean }[];
  analyses: FundAnalysis[];
}> {
  const symbols = holdings.map((h) => h.symbol);
  const quotes = fetchPrices ? await fetchQuotes(symbols) : [];
  const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

  const enriched: Holding[] = [];
  const priceMeta: { symbol: string; price: number; live: boolean }[] = [];
  const analyses: FundAnalysis[] = [];

  for (const h of holdings) {
    const symbol = h.symbol.toUpperCase();
    const quote = quoteMap.get(symbol);
    const price = fetchPrices ? (quote?.price ?? 100) : 100;
    const live = fetchPrices && quote !== undefined;

    const analysis = resolveFundAnalysis(symbol, {
      name: quote?.name,
      quoteType: quote?.quoteType,
      categoryName: quote?.categoryName,
    });

    enriched.push({
      symbol,
      shares: h.shares,
      price,
      value: h.shares * price,
      analysis,
    });
    priceMeta.push({ symbol, price, live });
    analyses.push(analysis);
  }

  return { holdings: enriched, priceMeta, analyses };
}
