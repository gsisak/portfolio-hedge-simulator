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

function segmentDedupeKey(seg: VoiceSegment): string {
  if (seg.localMatch?.symbol) return `sym:${seg.localMatch.symbol}`;
  return `raw:${seg.rawSegment.slice(0, 80).toLowerCase()}`;
}

/** Merge segments that refer to the same fund; combine amounts when both are present */
export function dedupeSegmentsBySymbol(segments: VoiceSegment[]): VoiceSegment[] {
  const byKey = new Map<string, VoiceSegment>();

  for (const seg of segments) {
    const key = segmentDedupeKey(seg);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, { ...seg });
      continue;
    }

    if (seg.shares !== undefined && existing.shares === undefined) {
      existing.shares = seg.shares;
    }
    if (seg.dollars !== undefined && existing.dollars === undefined) {
      existing.dollars = seg.dollars;
    }
    if (!existing.localMatch && seg.localMatch) {
      existing.localMatch = seg.localMatch;
    }
    if (seg.rawSegment.length > existing.rawSegment.length) {
      existing.rawSegment = seg.rawSegment;
    }
    if (seg.searchQuery.length > existing.searchQuery.length) {
      existing.searchQuery = seg.searchQuery;
    }
  }

  return [...byKey.values()];
}

/** Collapse parse items that resolve to the same ticker */
export function dedupeParseItems(items: VoiceParseItem[]): VoiceParseItem[] {
  const unmatched: VoiceParseItem[] = [];
  const bySymbol = new Map<string, VoiceParseItem>();

  for (const item of items) {
    const symbol = item.selectedSymbol ?? item.recommendations[0]?.symbol;
    if (!symbol) {
      unmatched.push(item);
      continue;
    }

    const existing = bySymbol.get(symbol);
    if (!existing) {
      bySymbol.set(symbol, { ...item, selectedSymbol: symbol });
      continue;
    }

    const shares =
      existing.shares !== undefined || item.shares !== undefined
        ? Math.max(existing.shares ?? 0, item.shares ?? 0)
        : undefined;
    const dollars =
      existing.dollars !== undefined || item.dollars !== undefined
        ? Math.max(existing.dollars ?? 0, item.dollars ?? 0)
        : undefined;

    bySymbol.set(symbol, {
      ...existing,
      shares: shares && shares > 0 ? shares : undefined,
      dollars: dollars && dollars > 0 ? dollars : undefined,
      rawSegment:
        item.rawSegment.length > existing.rawSegment.length
          ? item.rawSegment
          : existing.rawSegment,
      recommendations:
        existing.recommendations.length >= item.recommendations.length
          ? existing.recommendations
          : item.recommendations,
    });
  }

  return [...Array.from(bySymbol.values()), ...unmatched];
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
  options?: { skipVoiceParse?: boolean },
): Promise<{
  items: VoiceParseItem[];
  cash: number;
  segmentCount: number;
}> {
  const trimmed = transcript.trim();
  const voiceSegments = options?.skipVoiceParse
    ? []
    : trimmed
      ? parseVoiceSegments(trimmed)
      : [];
  const segments = dedupeSegmentsBySymbol([...extraSegments, ...voiceSegments]);

  if (segments.length === 0) {
    return { items: [], cash: parseCashFromTranscript(trimmed), segmentCount: 0 };
  }

  const items = dedupeParseItems(await segmentsToParseItems(segments));
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
