import { searchFunds } from "./fund-search";
import { parseVoiceSegments, type VoiceSegment } from "./voice-parser";
import type { VoiceParseItem } from "./types";

function parseCashFromTranscript(transcript: string): number {
  const cashMatch = transcript.match(
    /(?:\$|)(\d[\d,]*(?:\.\d+)?)\s*(?:k|thousand|m|million)?\s*(?:in\s+)?cash/i,
  );
  if (!cashMatch) return 0;

  const raw = cashMatch[0].toLowerCase();
  const num = parseFloat(cashMatch[1].replace(/,/g, ""));
  if (raw.includes("k") || raw.includes("thousand")) return num * 1000;
  if (raw.includes("m") || raw.includes("million")) return num * 1_000_000;
  return num;
}

function mergeSegments(segments: VoiceSegment[]): VoiceSegment[] {
  const seen = new Set<string>();
  const merged: VoiceSegment[] = [];

  for (const seg of segments) {
    const key = `${seg.shares ?? ""}|${seg.dollars ?? ""}|${seg.rawSegment.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(seg);
  }

  return merged;
}

export async function segmentsToParseItems(
  segments: VoiceSegment[],
  idPrefix = "item",
): Promise<VoiceParseItem[]> {
  const items: VoiceParseItem[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const query = seg.localMatch?.label ?? seg.searchQuery;
    const recommendations = await searchFunds(query);

    if (seg.localMatch) {
      const exists = recommendations.find((r) => r.symbol === seg.localMatch!.symbol);
      if (!exists) {
        recommendations.unshift({
          symbol: seg.localMatch.symbol,
          name: seg.localMatch.label,
          source: "registry",
          confidence: 0.99,
          reason: "Matched from description",
        });
      }
    }

    items.push({
      id: `${idPrefix}-${i}`,
      rawSegment: seg.rawSegment,
      dollars: seg.dollars,
      shares: seg.shares,
      recommendations: recommendations.slice(0, 6),
      selectedSymbol: recommendations[0]?.symbol ?? seg.localMatch?.symbol,
    });
  }

  return items;
}

export async function parseHoldingsFromText(
  transcript: string,
  extraSegments: VoiceSegment[] = [],
): Promise<{
  items: VoiceParseItem[];
  cash: number;
  segmentCount: number;
}> {
  const trimmed = transcript.trim();
  const voiceSegments = trimmed ? parseVoiceSegments(trimmed) : [];
  const segments = mergeSegments([...extraSegments, ...voiceSegments]);

  if (segments.length === 0) {
    return { items: [], cash: parseCashFromTranscript(trimmed), segmentCount: 0 };
  }

  const items = await segmentsToParseItems(segments);
  return {
    items,
    cash: parseCashFromTranscript(trimmed),
    segmentCount: segments.length,
  };
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
