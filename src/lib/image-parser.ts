import { getAllAliasEntries } from "./fund-registry";
import { dedupeSegmentsBySymbol } from "./parse-holdings";
import type { VoiceSegment } from "./voice-parser";

const ALIAS_ENTRIES = getAllAliasEntries().sort(
  (a, b) => b.alias.length - a.alias.length,
);

const TICKER_BLOCKLIST = new Set([
  "THE", "AND", "FOR", "USD", "INC", "LLC", "TR", "UB", "LX", "LD", "OK",
  "CIT", "FUND", "TRUST", "UNIT", "ADM", "ADMIRAL", "INST", "TOTAL", "VGI",
]);

function parseLineDollars(line: string): number | undefined {
  const m = line.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if (m) return parseFloat(m[1].replace(/,/g, ""));

  const trailing = line.match(/([\d,]+\.\d{2})\s*$/);
  if (trailing) {
    const val = parseFloat(trailing[1].replace(/,/g, ""));
    if (val > 100) return val;
  }

  return undefined;
}

function parseLineShares(line: string): number | undefined {
  const explicit = line.match(/([\d,]+(?:\.\d+)?)\s+(?:shares?|sh\b|units?|qty)/i);
  if (explicit) return parseFloat(explicit[1].replace(/,/g, ""));

  const tickerFirst = line.match(
    /^([A-Z]{1,5})\s+([\d,]+(?:\.\d+)?)(?:\s|$)/,
  );
  if (tickerFirst && !TICKER_BLOCKLIST.has(tickerFirst[1])) {
    const val = parseFloat(tickerFirst[2].replace(/,/g, ""));
    if (val > 0 && val < 1_000_000) return val;
  }

  return undefined;
}

function matchTickerInLine(line: string): { symbol: string; label: string } | null {
  const upper = line.toUpperCase();
  const tickers = upper.match(/\b[A-Z]{2,5}\b/g) ?? [];
  for (const t of tickers) {
    if (!TICKER_BLOCKLIST.has(t)) {
      const entry = ALIAS_ENTRIES.find((a) => a.symbol === t);
      return { symbol: t, label: entry?.label ?? t };
    }
  }
  return null;
}

function matchFundInLine(line: string): { symbol: string; label: string } | null {
  const norm = line.toLowerCase();
  for (const entry of ALIAS_ENTRIES) {
    if (norm.includes(entry.alias)) {
      return { symbol: entry.symbol, label: entry.label };
    }
  }
  return null;
}

function parseTableRow(line: string): VoiceSegment | null {
  const trimmed = line.trim();
  if (trimmed.length < 4) return null;

  const lower = trimmed.toLowerCase();
  if (
    lower.includes("symbol") &&
    (lower.includes("quantity") || lower.includes("shares") || lower.includes("value"))
  ) {
    return null;
  }
  if (lower.includes("total") && lower.includes("portfolio")) return null;

  const shares = parseLineShares(trimmed);
  const dollars = parseLineDollars(trimmed);
  if (!shares && !dollars) return null;

  const tickerMatch = matchTickerInLine(trimmed);
  const fundMatch = matchFundInLine(trimmed);
  const localMatch = tickerMatch ?? fundMatch ?? undefined;

  const searchQuery = trimmed
    .replace(/\$\s*[\d,]+(?:\.\d+)?/g, "")
    .replace(/[\d,]+(?:\.\d+)?\s*(?:shares?|sh|units?)/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    rawSegment: trimmed,
    shares,
    dollars,
    searchQuery: searchQuery.length > 2 ? searchQuery : trimmed,
    localMatch,
  };
}

/** Extract holdings from OCR table rows (voice-style parsing runs in parse-holdings) */
export function parseImageOcrText(ocrText: string): VoiceSegment[] {
  const lines = ocrText
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  const fromLines: VoiceSegment[] = [];
  for (const line of lines) {
    const row = parseTableRow(line);
    if (row) fromLines.push(row);
  }

  return dedupeSegmentsBySymbol(fromLines);
}

export async function extractTextWithOpenAIVision(
  imageBase64: string,
  mimeType: string,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const dataUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:${mimeType};base64,${imageBase64}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Extract all portfolio holdings from this screenshot. For each holding return one line in this format: FUND_OR_TICKER | SHARES_OR_DOLLARS | AMOUNT. Use SHARES if quantity is in shares/units, DOLLARS if market value. Include fund names exactly as shown. Output only the lines, no headers.",
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 1500,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vision API failed: ${err.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}
