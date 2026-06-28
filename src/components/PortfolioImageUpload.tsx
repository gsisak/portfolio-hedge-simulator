"use client";

import { useCallback, useRef, useState } from "react";
import type { HoldingInput } from "@/lib/fund-registry";
import ParseItemsPreview, { itemsToHoldings } from "@/components/ParseItemsPreview";
import type { VoiceParseItem } from "@/lib/types";

const ACCEPT = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

interface PortfolioImageUploadProps {
  onApply: (holdings: HoldingInput[], cash: string) => void | Promise<void>;
}

export default function PortfolioImageUpload({ onApply }: PortfolioImageUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [showOcr, setShowOcr] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string | null>(null);
  const [items, setItems] = useState<VoiceParseItem[]>([]);
  const [previewCash, setPreviewCash] = useState("0");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetPreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const loadFile = useCallback(
    (next: File) => {
      if (!ACCEPT.includes(next.type)) {
        setError("Use PNG, JPG, or WebP");
        return;
      }
      resetPreview();
      setFile(next);
      setPreviewUrl(URL.createObjectURL(next));
      setOcrText("");
      setItems([]);
      setMessage(null);
      setError(null);
    },
    [resetPreview],
  );

  const runOcr = useCallback(async (): Promise<string> => {
    if (!file) throw new Error("Choose an image first");

    setOcrProgress("Loading OCR engine…");
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng", undefined, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          setOcrProgress(`Reading screenshot… ${Math.round((m.progress ?? 0) * 100)}%`);
        }
      },
    });

    try {
      const { data } = await worker.recognize(file);
      return data.text.trim();
    } finally {
      await worker.terminate();
      setOcrProgress(null);
    }
  }, [file]);

  const parseImage = useCallback(async () => {
    if (!file) {
      setError("Upload a portfolio screenshot first");
      return;
    }

    setParsing(true);
    setError(null);
    setMessage(null);

    try {
      let text = ocrText.trim();
      if (!text) {
        text = await runOcr();
        setOcrText(text);
        setShowOcr(true);
      }

      if (!text) {
        setMessage("No text found in image — try a clearer screenshot");
        return;
      }

      const res = await fetch("/api/image-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ocrText: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Parse failed");

      if (!data.items?.length) {
        setItems([]);
        setMessage(data.message ?? "No holdings matched — edit extracted text and retry");
        return;
      }

      setItems(data.items);
      setPreviewCash(String(data.cash ?? 0));
      setMessage(
        `Found ${data.items.length} holding(s) from screenshot — confirm ticker matches`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setParsing(false);
    }
  }, [file, ocrText, runOcr]);

  const selectRecommendation = (itemId: string, symbol: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, selectedSymbol: symbol } : item,
      ),
    );
  };

  const applyPreview = useCallback(async () => {
    const holdings = itemsToHoldings(items);
    if (!holdings.length) {
      setError("Select a ticker for each holding with a valid amount");
      return;
    }
    await onApply(holdings, previewCash);
    setMessage("Portfolio updated from screenshot — running scenarios…");
  }, [items, previewCash, onApply]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  };

  return (
    <div className="mb-4 rounded-lg border border-zinc-700 bg-zinc-800/30 p-3">
      <p className="text-xs font-medium text-zinc-300">Screenshot upload</p>
      <p className="mt-1 text-xs text-zinc-500">
        Upload a brokerage portfolio screenshot — we read fund names, tickers, shares,
        and dollar values.
      </p>

      <div
        className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 transition ${
          dragOver
            ? "border-emerald-500 bg-emerald-950/20"
            : "border-zinc-700 bg-zinc-900/40 hover:border-zinc-600"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) loadFile(f);
          }}
        />
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Portfolio screenshot preview"
            className="max-h-40 rounded-md object-contain"
          />
        ) : (
          <p className="text-center text-xs text-zinc-500">
            Drop image here or click to browse
          </p>
        )}
      </div>

      {ocrProgress && (
        <p className="mt-2 text-xs text-amber-400">{ocrProgress}</p>
      )}

      {ocrText && (
        <button
          type="button"
          onClick={() => setShowOcr((v) => !v)}
          className="mt-2 text-[10px] text-zinc-500 hover:text-zinc-300"
        >
          {showOcr ? "Hide" : "Show"} extracted text
        </button>
      )}

      {showOcr && (
        <textarea
          value={ocrText}
          onChange={(e) => setOcrText(e.target.value)}
          rows={4}
          placeholder="OCR text will appear here…"
          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
        />
      )}

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={parseImage}
          disabled={parsing || !file}
          className="flex-1 rounded-md bg-zinc-700 py-1.5 text-xs font-medium text-white hover:bg-zinc-600 disabled:opacity-50"
        >
          {parsing ? "Reading & matching…" : "Extract holdings"}
        </button>
        {items.length > 0 && (
          <button
            type="button"
            onClick={applyPreview}
            className="flex-1 rounded-md bg-emerald-700 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
          >
            Apply to portfolio
          </button>
        )}
      </div>

      {message && <p className="mt-2 text-xs text-emerald-400">{message}</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      <ParseItemsPreview items={items} onSelect={selectRecommendation} />
    </div>
  );
}
