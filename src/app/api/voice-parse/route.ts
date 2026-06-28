import { NextResponse } from "next/server";
import { searchFunds } from "@/lib/fund-search";
import { fetchQuotes } from "@/lib/quotes";
import { parseVoiceSegments } from "@/lib/voice-parser";
import type { VoiceParseItem } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { transcript?: string };
    const transcript = body.transcript?.trim();

    if (!transcript) {
      return NextResponse.json({ error: "transcript required" }, { status: 400 });
    }

    const segments = parseVoiceSegments(transcript);
    if (segments.length === 0) {
      return NextResponse.json({
        items: [],
        cash: 0,
        unparsed: transcript,
        message:
          'Could not parse any holdings. Try: "$300,000 in Vanguard 500 index" or "500 shares of total bond market"',
      });
    }

    const items: VoiceParseItem[] = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const query = seg.localMatch?.label ?? seg.searchQuery;
      const recommendations = await searchFunds(query);

      if (seg.localMatch) {
        const exists = recommendations.find(
          (r) => r.symbol === seg.localMatch!.symbol,
        );
        if (!exists) {
          recommendations.unshift({
            symbol: seg.localMatch.symbol,
            name: seg.localMatch.label,
            source: "registry",
            confidence: 0.99,
            reason: "Matched from your spoken description",
          });
        }
      }

      items.push({
        id: `item-${i}`,
        rawSegment: seg.rawSegment,
        dollars: seg.dollars,
        shares: seg.shares,
        recommendations: recommendations.slice(0, 6),
        selectedSymbol:
          recommendations[0]?.symbol ?? seg.localMatch?.symbol,
      });
    }

    const allSymbols = [
      ...new Set(
        items
          .map((it) => it.selectedSymbol)
          .filter((s): s is string => Boolean(s)),
      ),
    ];
    const quotes = allSymbols.length > 0 ? await fetchQuotes(allSymbols) : [];
    const priceMap = new Map(quotes.map((q) => [q.symbol, q.price]));

    for (const item of items) {
      item.recommendations = item.recommendations.map((r) => ({
        ...r,
        price: priceMap.get(r.symbol) ?? null,
      }));
    }

    const cashMatch = transcript.match(
      /(?:\$|)(\d[\d,]*(?:\.\d+)?)\s*(?:k|thousand|m|million)?\s*(?:in\s+)?cash/i,
    );
    let cash = 0;
    if (cashMatch) {
      const raw = cashMatch[0].toLowerCase();
      const num = parseFloat(cashMatch[1].replace(/,/g, ""));
      if (raw.includes("k") || raw.includes("thousand")) cash = num * 1000;
      else if (raw.includes("m") || raw.includes("million")) cash = num * 1_000_000;
      else cash = num;
    }

    const holdings = buildHoldingsFromItems(items, priceMap);

    return NextResponse.json({
      items,
      holdings,
      cash,
      transcript,
      parsedCount: items.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Voice parse failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export function buildHoldingsFromItems(
  items: VoiceParseItem[],
  priceMap: Map<string, number>,
) {
  return items
    .filter((item) => item.selectedSymbol)
    .map((item) => {
      const symbol = item.selectedSymbol!;
      const price = priceMap.get(symbol);
      let shares = item.shares;
      let source: "shares" | "dollars" | "unknown" = "unknown";

      if (shares !== undefined) {
        source = "shares";
      } else if (item.dollars !== undefined && price && price > 0) {
        shares = Math.round((item.dollars / price) * 100) / 100;
        source = "dollars";
      }

      const rec = item.recommendations.find((r) => r.symbol === symbol);

      return {
        symbol,
        shares: shares ?? 0,
        matchedLabel: rec?.name ?? symbol,
        rawSegment: item.rawSegment,
        dollars: item.dollars,
        price: price ?? null,
        source,
        live: priceMap.has(symbol),
      };
    })
    .filter((h) => h.shares > 0);
}
