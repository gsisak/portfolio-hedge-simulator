import { getAllAliasEntries } from "./fund-registry";

export interface ParsedHoldingDraft {
  symbol: string;
  matchedLabel: string;
  shares?: number;
  dollars?: number;
  rawSegment: string;
}

const ALIAS_ENTRIES = getAllAliasEntries().sort(
  (a, b) => b.alias.length - a.alias.length,
);

const TICKER_WORD_BLOCKLIST = new Set([
  "I", "A", "AN", "THE", "OF", "IN", "MY", "AND", "OR", "TO", "AT", "IS", "IT",
  "SHARE", "SHARES", "SCARE", "SCARES", "DOLLAR", "DOLLARS", "WORTH", "ABOUT",
  "ROUGHLY", "HAVE", "OWN", "WITH", "FOR", "USD", "K", "M", "OK", "UB", "LD",
  "LX", "TR", "UNIT", "FONT", "FUND", "FUNDS",
]);

/** Strip thousand-separators so "$370,963" and "87,788" parse reliably */
function normalizeNumberCommas(text: string): string {
  return text.replace(/(\d),(\d{3}(?:,\d{3})*(?:\.\d+)?)/g, (_, left, right) => {
    const combined = left + right.replace(/,/g, "");
    return combined;
  });
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s$.,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSegments(transcript: string): string[] {
  const cleaned = normalizeNumberCommas(transcript);

  return cleaned
    .split(
      /\b(?:ok|and then|i also have|also have|plus|then)\b|\.\s+|\n+|;\s*/i,
    )
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

function parseDollars(segment: string): number | undefined {
  const normalized = normalizeNumberCommas(segment).toLowerCase();

  const dollarSign = normalized.match(
    /\$\s*([\d,]+(?:\.\d+)?)\s*(k|thousand|m|million|b|billion)?/,
  );
  if (dollarSign) {
    return scaleNumber(parseFloat(dollarSign[1].replace(/,/g, "")), dollarSign[2]);
  }

  const dollarsWord = normalized.match(
    /([\d,]+(?:\.\d+)?)\s*(k|thousand|m|million|b|billion)?\s*dollars?/,
  );
  if (dollarsWord) {
    return scaleNumber(parseFloat(dollarsWord[1].replace(/,/g, "")), dollarsWord[2]);
  }

  const inAmount = normalized.match(
    /(?:about|roughly|around|have|that's|at)\s+\$?\s*([\d,]+(?:\.\d+)?)\s*(k|thousand|m|million)?/,
  );
  if (inAmount) {
    return scaleNumber(parseFloat(inAmount[1].replace(/,/g, "")), inAmount[2]);
  }

  const worth = normalized.match(/worth\s+(?:about\s+)?([\d,]+(?:\.\d+)?)\s*(k|thousand|m|million)?/);
  if (worth) {
    return scaleNumber(parseFloat(worth[1].replace(/,/g, "")), worth[2]);
  }

  const thousand = normalized.match(/([\d,]+(?:\.\d+)?)\s+thousand/);
  if (thousand) {
    return parseFloat(thousand[1].replace(/,/g, "")) * 1000;
  }

  const million = normalized.match(/([\d,]+(?:\.\d+)?)\s+million/);
  if (million) {
    return parseFloat(million[1].replace(/,/g, "")) * 1_000_000;
  }

  return undefined;
}

function scaleNumber(n: number, suffix?: string): number {
  if (!suffix) return n;
  const s = suffix.toLowerCase();
  if (s === "k" || s === "thousand") return n * 1000;
  if (s === "m" || s === "million") return n * 1_000_000;
  if (s === "b" || s === "billion") return n * 1_000_000_000;
  return n;
}

function parseShares(segment: string): number | undefined {
  const m = segment.match(/([\d,]+(?:\.\d+)?)\s+scare?s?/i);
  if (m) return parseFloat(m[1].replace(/,/g, ""));
  return undefined;
}

function matchTicker(segment: string): { symbol: string; label: string } | null {
  const upper = segment.toUpperCase();
  const tickers = upper.match(/\b[A-Z]{2,5}\b/g) ?? [];
  for (const t of tickers) {
    if (!TICKER_WORD_BLOCKLIST.has(t)) {
      const entry = ALIAS_ENTRIES.find((a) => a.symbol === t);
      return { symbol: t, label: entry?.label ?? t };
    }
  }
  return null;
}

function matchFundName(segment: string): { symbol: string; label: string } | null {
  const norm = normalize(segment);
  for (const entry of ALIAS_ENTRIES) {
    if (norm.includes(entry.alias)) {
      return { symbol: entry.symbol, label: entry.label };
    }
  }
  return null;
}

export function parseVoiceTranscript(transcript: string): ParsedHoldingDraft[] {
  const segments = splitSegments(transcript);
  const results: ParsedHoldingDraft[] = [];
  const seen = new Set<string>();

  for (const segment of segments) {
    const tickerMatch = matchTicker(segment);
    const fundMatch = matchFundName(segment);
    const match = tickerMatch ?? fundMatch;
    if (!match) continue;

    const shares = parseShares(segment);
    const dollars = parseDollars(segment);

    if (!shares && !dollars) continue;

    const key = match.symbol;
    if (seen.has(key)) {
      const existing = results.find((r) => r.symbol === key);
      if (existing) {
        if (shares) existing.shares = (existing.shares ?? 0) + shares;
        if (dollars) existing.dollars = (existing.dollars ?? 0) + dollars;
      }
      continue;
    }

    seen.add(key);
    results.push({
      symbol: match.symbol,
      matchedLabel: match.label,
      shares,
      dollars,
      rawSegment: segment,
    });
  }

  return results;
}

function extractSearchQuery(segment: string): string {
  return segment
    .replace(/\$\s*[\d,]+(?:\.\d+)?\s*(?:k|thousand|m|million|b|billion)?/gi, "")
    .replace(/[\d,]+(?:\.\d+)?\s*(?:k|thousand|m|million|b|billion)?\s*(?:dollars?|usd)/gi, "")
    .replace(/[\d,]+(?:\.\d+)?\s+scare?s?/gi, "")
    .replace(/\b(?:worth|about|roughly|around|have|own|in|of|my|portfolio|ok|vanguard|fund|funds|font|called|which is a|there's|that's|i also|then)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface VoiceSegment {
  rawSegment: string;
  shares?: number;
  dollars?: number;
  searchQuery: string;
  localMatch?: { symbol: string; label: string };
}

export function parseVoiceSegments(transcript: string): VoiceSegment[] {
  const segments = splitSegments(transcript);
  const results: VoiceSegment[] = [];

  for (const segment of segments) {
    const shares = parseShares(segment);
    const dollars = parseDollars(segment);
    if (!shares && !dollars) continue;

    const searchQuery = extractSearchQuery(segment) || segment;
    const tickerMatch = matchTicker(segment);
    const fundMatch = matchFundName(segment);
    const localMatch = tickerMatch ?? fundMatch ?? undefined;

    results.push({
      rawSegment: segment,
      shares,
      dollars,
      searchQuery: searchQuery.length > 2 ? searchQuery : segment,
      localMatch,
    });
  }

  return results;
}

export function mergeTranscripts(existing: string, next: string): string {
  const combined = `${existing} ${next}`.trim();
  return combined.replace(/\s+/g, " ");
}
