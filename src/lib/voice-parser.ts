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
  "SHARE", "SHARES", "DOLLAR", "DOLLARS", "WORTH", "ABOUT", "ROUGHLY", "HAVE",
  "OWN", "WITH", "FOR", "USD", "K", "M",
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s$.,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSegments(transcript: string): string[] {
  return transcript
    .split(/\s+(?:and|also|plus|then)\s+|,\s*|\.\s+|\n+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

function parseDollars(segment: string): number | undefined {
  const normalized = segment.toLowerCase();

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
  const m = segment.match(/([\d,]+(?:\.\d+)?)\s+shares?/i);
  if (m) return parseFloat(m[1].replace(/,/g, ""));
  return undefined;
}

function matchTicker(segment: string): { symbol: string; label: string } | null {
  const upper = segment.toUpperCase();
  const tickers = upper.match(/\b[A-Z]{1,5}\b/g) ?? [];
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

export function mergeTranscripts(existing: string, next: string): string {
  const combined = `${existing} ${next}`.trim();
  return combined.replace(/\s+/g, " ");
}
