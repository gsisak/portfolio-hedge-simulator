import YahooFinance from "yahoo-finance2";
import { getAllAliasEntries, FUND_REGISTRY } from "./fund-registry";

const yahooFinance = new YahooFinance();

export interface FundRecommendation {
  symbol: string;
  name: string;
  quoteType?: string;
  source: "registry" | "yahoo" | "alias";
  confidence: number;
  reason: string;
  exchange?: string;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function scoreMatch(query: string, target: string): number {
  const q = normalize(query);
  const t = normalize(target);
  if (q === t) return 1;
  if (t.includes(q) || q.includes(t)) return 0.85;
  const qWords = q.split(" ").filter((w) => w.length > 2);
  const matches = qWords.filter((w) => t.includes(w)).length;
  return qWords.length > 0 ? (matches / qWords.length) * 0.75 : 0;
}

function searchRegistry(query: string): FundRecommendation[] {
  const results: FundRecommendation[] = [];
  const seen = new Set<string>();

  for (const fund of FUND_REGISTRY) {
    const scores = [
      scoreMatch(query, fund.label),
      scoreMatch(query, fund.symbol),
      ...fund.aliases.map((a) => scoreMatch(query, a)),
    ];
    const best = Math.max(...scores);
    if (best >= 0.4 && !seen.has(fund.symbol)) {
      seen.add(fund.symbol);
      results.push({
        symbol: fund.symbol,
        name: fund.label,
        source: "registry",
        confidence: best,
        reason: `Matched "${fund.label}" in fund database`,
      });
    }
  }

  for (const entry of getAllAliasEntries()) {
    if (seen.has(entry.symbol)) continue;
    const s = scoreMatch(query, entry.alias);
    if (s >= 0.5) {
      seen.add(entry.symbol);
      results.push({
        symbol: entry.symbol,
        name: entry.label,
        source: "alias",
        confidence: s * 0.95,
        reason: `Alias match: "${entry.alias}"`,
      });
    }
  }

  return results;
}

async function searchYahoo(query: string): Promise<FundRecommendation[]> {
  try {
    const result = await yahooFinance.search(query, { quotesCount: 8, newsCount: 0 });
    const quotes = result.quotes ?? [];

    return quotes
      .filter((q) => "symbol" in q && q.symbol)
      .map((q, i) => {
        const quote = q as {
          symbol: string;
          shortname?: string;
          longname?: string;
          quoteType?: string;
          exchange?: string;
        };
        return {
          symbol: quote.symbol.toUpperCase(),
          name: quote.longname ?? quote.shortname ?? quote.symbol,
          quoteType: quote.quoteType,
          exchange: quote.exchange,
          source: "yahoo" as const,
          confidence: Math.max(0.5, 0.95 - i * 0.08),
          reason: `Yahoo Finance search result #${i + 1}`,
        };
      });
  } catch {
    return [];
  }
}

export async function searchFunds(query: string): Promise<FundRecommendation[]> {
  const local = searchRegistry(query);
  const yahoo = await searchYahoo(query);

  const merged = new Map<string, FundRecommendation>();

  for (const r of [...local, ...yahoo]) {
    const existing = merged.get(r.symbol);
    if (!existing || r.confidence > existing.confidence) {
      merged.set(r.symbol, {
        ...r,
        confidence: existing
          ? Math.min(1, (existing.confidence + r.confidence) / 2 + 0.1)
          : r.confidence,
        reason: existing ? `${existing.reason}; ${r.reason}` : r.reason,
      });
    }
  }

  return [...merged.values()]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6);
}
