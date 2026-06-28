import { NextResponse } from "next/server";
import { fetchQuotes } from "@/lib/quotes";
import { parseVoiceTranscript } from "@/lib/voice-parser";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { transcript?: string };
    const transcript = body.transcript?.trim();

    if (!transcript) {
      return NextResponse.json({ error: "transcript required" }, { status: 400 });
    }

    const drafts = parseVoiceTranscript(transcript);
    if (drafts.length === 0) {
      return NextResponse.json({
        holdings: [],
        unparsed: transcript,
        message:
          "Could not match any funds. Try: \"500 shares of VOO\" or \"$300,000 in total bond BND\"",
      });
    }

    const symbols = drafts.map((d) => d.symbol);
    const quotes = await fetchQuotes(symbols);
    const priceMap = new Map(quotes.map((q) => [q.symbol, q.price]));

    const holdings = drafts.map((d) => {
      const price = priceMap.get(d.symbol);
      let shares = d.shares;
      let source: "shares" | "dollars" | "unknown" = "unknown";

      if (shares !== undefined) {
        source = "shares";
      } else if (d.dollars !== undefined && price && price > 0) {
        shares = Math.round((d.dollars / price) * 100) / 100;
        source = "dollars";
      }

      return {
        symbol: d.symbol,
        shares: shares ?? 0,
        matchedLabel: d.matchedLabel,
        rawSegment: d.rawSegment,
        dollars: d.dollars,
        price: price ?? null,
        source,
        live: priceMap.has(d.symbol),
      };
    });

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

    return NextResponse.json({
      holdings: holdings.filter((h) => h.shares > 0),
      cash,
      transcript,
      parsedCount: holdings.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Voice parse failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
