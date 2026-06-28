"use client";

import type { VoiceParseItem } from "@/lib/types";

interface ParseItemsPreviewProps {
  items: VoiceParseItem[];
  onSelect: (itemId: string, symbol: string) => void;
}

export default function ParseItemsPreview({
  items,
  onSelect,
}: ParseItemsPreviewProps) {
  if (items.length === 0) return null;

  return (
    <div className="mt-3 space-y-3 border-t border-zinc-700 pt-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-md border border-zinc-700/80 bg-zinc-900/50 p-2.5"
        >
          <p className="text-xs text-zinc-400">
            &quot;{item.rawSegment}&quot;
            {item.dollars !== undefined && (
              <span className="ml-2 text-zinc-500">
                ${item.dollars.toLocaleString()}
              </span>
            )}
            {item.shares !== undefined && (
              <span className="ml-2 text-zinc-500">{item.shares} shares</span>
            )}
          </p>
          <p className="mt-1.5 text-[10px] uppercase tracking-wide text-zinc-600">
            Pick best match
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {item.recommendations.map((rec) => {
              const selected = item.selectedSymbol === rec.symbol;
              return (
                <button
                  key={rec.symbol}
                  type="button"
                  onClick={() => onSelect(item.id, rec.symbol)}
                  className={`rounded-md border px-2 py-1 text-left text-xs transition ${
                    selected
                      ? "border-emerald-600 bg-emerald-900/40 text-emerald-200"
                      : "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-600"
                  }`}
                  title={rec.reason}
                >
                  <span className="font-mono font-semibold">{rec.symbol}</span>
                  <span className="ml-1 text-zinc-500">
                    {(rec.confidence * 100).toFixed(0)}%
                  </span>
                  <span className="block max-w-[180px] truncate text-[10px] text-zinc-500">
                    {rec.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function itemsToHoldings(
  items: VoiceParseItem[],
): Array<{ symbol: string; shares: string }> {
  const holdings: Array<{ symbol: string; shares: string }> = [];

  for (const item of items) {
    if (!item.selectedSymbol) continue;
    const rec = item.recommendations.find((r) => r.symbol === item.selectedSymbol);
    const price = rec?.price ?? undefined;
    let shares = item.shares;

    if (shares === undefined && item.dollars !== undefined && price && price > 0) {
      shares = Math.round((item.dollars / price) * 100) / 100;
    }

    if (shares && shares > 0) {
      holdings.push({
        symbol: item.selectedSymbol,
        shares: String(shares),
      });
    }
  }

  return holdings;
}
