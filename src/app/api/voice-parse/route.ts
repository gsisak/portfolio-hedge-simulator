import { NextResponse } from "next/server";
import { buildHoldingsFromItems, parseHoldingsFromText } from "@/lib/parse-holdings";
import { fetchQuotes } from "@/lib/quotes";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { transcript?: string };
    const transcript = body.transcript?.trim();

    if (!transcript) {
      return NextResponse.json({ error: "transcript required" }, { status: 400 });
    }

    const { items, cash, segmentCount } = await parseHoldingsFromText(transcript);

    if (items.length === 0) {
      return NextResponse.json({
        items: [],
        cash: 0,
        unparsed: transcript,
        message:
          'Could not parse any holdings. Try: "$300,000 in Vanguard 500 index" or "500 shares of total bond market"',
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

    const holdings = buildHoldingsFromItems(items, priceMap);

    return NextResponse.json({
      items,
      holdings,
      cash,
      transcript,
      parsedCount: segmentCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Voice parse failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
