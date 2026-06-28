"use client";

import type { VoiceParseItem } from "@/lib/types";

interface ParseItemsPreviewProps {
  items: VoiceParseItem[];
  onSelect: (itemId: string, symbol: string) => void;
  onDeselect?: (itemId: string) => void;
  onExclude?: (itemId: string) => void;
  onRestore?: (itemId: string) => void;
}

function formatAmount(item: VoiceParseItem): string | null {
  if (item.dollars !== undefined) {
    return `$${item.dollars.toLocaleString()}`;
  }
  if (item.shares !== undefined) {
    return `${item.shares.toLocaleString()} shares`;
  }
  return null;
}

function HoldingCard({
  item,
  onSelect,
  onDeselect,
  onExclude,
}: {
  item: VoiceParseItem;
  onSelect: (itemId: string, symbol: string) => void;
  onDeselect?: (itemId: string) => void;
  onExclude?: (itemId: string) => void;
}) {
  const amount = formatAmount(item);
  const selectedRec = item.recommendations.find(
    (r) => r.symbol === item.selectedSymbol,
  );

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-700/80 bg-zinc-900/60">
      <div className="flex items-start gap-2 border-b border-zinc-800/80 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs leading-relaxed text-zinc-300">
            {item.rawSegment}
          </p>
          {amount && (
            <span className="mt-1.5 inline-block rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
              {amount}
            </span>
          )}
        </div>
        {onExclude && (
          <button
            type="button"
            onClick={() => onExclude(item.id)}
            className="shrink-0 rounded-md p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
            title="Exclude from portfolio"
            aria-label="Exclude holding"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Match ticker
          </p>
          {item.selectedSymbol ? (
            <button
              type="button"
              onClick={() => onDeselect?.(item.id)}
              className="shrink-0 text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              Clear
            </button>
          ) : (
            <span className="text-[10px] text-amber-500/90">Required</span>
          )}
        </div>

        <label className="sr-only" htmlFor={`ticker-select-${item.id}`}>
          Select ticker for {item.rawSegment}
        </label>
        <select
          id={`ticker-select-${item.id}`}
          value={item.selectedSymbol ?? ""}
          onChange={(e) => {
            const symbol = e.target.value;
            if (!symbol) {
              onDeselect?.(item.id);
            } else {
              onSelect(item.id, symbol);
            }
          }}
          className="mb-2 w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-600/60 focus:ring-1 focus:ring-emerald-600/40"
        >
          <option value="">— Select ticker —</option>
          {item.recommendations.map((rec) => (
            <option key={rec.symbol} value={rec.symbol}>
              {rec.symbol} · {(rec.confidence * 100).toFixed(0)}% · {rec.name}
            </option>
          ))}
        </select>

        <div className="max-h-36 overflow-y-auto overscroll-contain rounded-md border border-zinc-800/80 bg-zinc-950/40">
          <ul className="divide-y divide-zinc-800/60">
            {item.recommendations.map((rec) => {
              const selected = item.selectedSymbol === rec.symbol;
              return (
                <li key={rec.symbol}>
                  <button
                    type="button"
                    onClick={() => {
                      if (selected && onDeselect) {
                        onDeselect(item.id);
                      } else {
                        onSelect(item.id, rec.symbol);
                      }
                    }}
                    className={`flex w-full items-start gap-2.5 px-2.5 py-2 text-left transition ${
                      selected
                        ? "bg-emerald-950/50"
                        : "hover:bg-zinc-800/50"
                    }`}
                    title={selected ? "Click to clear" : rec.reason}
                  >
                    <span
                      className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                        selected
                          ? "border-emerald-500 bg-emerald-600"
                          : "border-zinc-600 bg-transparent"
                      }`}
                      aria-hidden="true"
                    >
                      {selected && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                        <span
                          className={`font-mono text-xs font-semibold ${
                            selected ? "text-emerald-300" : "text-zinc-200"
                          }`}
                        >
                          {rec.symbol}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {(rec.confidence * 100).toFixed(0)}% match
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] leading-snug text-zinc-500">
                        {rec.name}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {selectedRec && (
          <p className="mt-2 truncate text-[10px] text-emerald-400/90">
            Selected: {selectedRec.symbol} — {selectedRec.name}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ParseItemsPreview({
  items,
  onSelect,
  onDeselect,
  onExclude,
  onRestore,
}: ParseItemsPreviewProps) {
  if (items.length === 0) return null;

  const activeItems = items.filter((i) => !i.excluded);
  const excludedItems = items.filter((i) => i.excluded);

  return (
    <div className="mt-3 min-w-0 space-y-3 border-t border-zinc-700/80 pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Review matches
        </p>
        <p className="text-[10px] text-zinc-500">
          <span className="text-emerald-400/90">{activeItems.length} active</span>
          {excludedItems.length > 0 && (
            <span className="text-zinc-600"> · {excludedItems.length} excluded</span>
          )}
        </p>
      </div>

      <div className="max-h-[min(420px,50vh)] space-y-2.5 overflow-y-auto overscroll-contain pr-0.5">
        {activeItems.map((item) => (
          <HoldingCard
            key={item.id}
            item={item}
            onSelect={onSelect}
            onDeselect={onDeselect}
            onExclude={onExclude}
          />
        ))}
      </div>

      {excludedItems.length > 0 && onRestore && (
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/30 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Excluded ({excludedItems.length})
          </p>
          <ul className="mt-1.5 space-y-1">
            {excludedItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5"
              >
                <span className="min-w-0 flex-1 truncate text-[10px] text-zinc-500">
                  {item.rawSegment}
                </span>
                <button
                  type="button"
                  onClick={() => onRestore(item.id)}
                  className="shrink-0 text-[10px] text-emerald-500 hover:text-emerald-400"
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function itemsToHoldings(
  items: VoiceParseItem[],
): Array<{ symbol: string; shares: string }> {
  const holdings: Array<{ symbol: string; shares: string }> = [];

  for (const item of items) {
    if (item.excluded || !item.selectedSymbol) continue;
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
