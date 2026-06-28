"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HoldingInput } from "@/lib/fund-registry";
import ParseItemsPreview, { itemsToHoldings } from "@/components/ParseItemsPreview";
import type { VoiceParseItem } from "@/lib/types";

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultLike[];
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

interface VoicePortfolioInputProps {
  onApply: (holdings: HoldingInput[], cash: string) => void | Promise<void>;
}

export default function VoicePortfolioInput({ onApply }: VoicePortfolioInputProps) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [parsing, setParsing] = useState(false);
  const [items, setItems] = useState<VoiceParseItem[]>([]);
  const [previewCash, setPreviewCash] = useState("0");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const w = window as SpeechWindow;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event: SpeechRecognitionEventLike) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const part = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalChunk += part;
        else interimChunk += part;
      }
      if (finalChunk) {
        setTranscript((prev) => `${prev} ${finalChunk}`.trim());
      }
      setInterim(interimChunk.trim());
    };

    rec.onerror = (e) => {
      setError(e.error === "not-allowed" ? "Microphone permission denied" : e.error);
      setListening(false);
    };

    rec.onend = () => setListening(false);
    recognitionRef.current = rec;

    return () => {
      rec.stop();
    };
  }, []);

  const toggleListening = useCallback(() => {
    setError(null);
    const rec = recognitionRef.current;
    if (!rec) return;

    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      setMessage(null);
      rec.start();
      setListening(true);
    }
  }, [listening]);

  const selectRecommendation = (itemId: string, symbol: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, selectedSymbol: symbol } : item,
      ),
    );
  };

  const deselectRecommendation = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, selectedSymbol: undefined } : item,
      ),
    );
  };

  const excludeItem = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, excluded: true } : item,
      ),
    );
  };

  const restoreItem = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, excluded: false } : item,
      ),
    );
  };

  const parseTranscript = useCallback(async () => {
    const text = transcript.trim();
    if (!text) {
      setError("Say or type your holdings first");
      return;
    }

    setParsing(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/voice-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Parse failed");

      if (!data.items?.length) {
        setItems([]);
        setMessage(data.message ?? "No holdings matched");
        return;
      }

      setItems(data.items);
      setPreviewCash(String(data.cash ?? 0));
      setMessage(
        `Found ${data.items.length} holding(s) — pick the best ticker match for each`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setParsing(false);
    }
  }, [transcript]);

  const applyPreview = useCallback(async () => {
    if (!items.length) return;

    const holdings = itemsToHoldings(items);
    if (!holdings.length) {
      setError("Select a ticker for each holding with a valid share/dollar amount");
      return;
    }

    await onApply(holdings, previewCash);
    setMessage("Portfolio updated — running scenarios…");
  }, [items, previewCash, onApply]);

  if (!supported) {
    return (
      <div className="mb-4 rounded-lg border border-zinc-700 bg-zinc-800/40 p-3 text-xs text-zinc-400">
        Voice input requires Chrome or Edge. Type holdings below instead.
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-zinc-700 bg-zinc-800/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-300">Voice portfolio input</p>
        <button
          type="button"
          onClick={toggleListening}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            listening
              ? "bg-red-600 text-white animate-pulse"
              : "bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
          }`}
          aria-pressed={listening}
        >
          <span aria-hidden="true">{listening ? "⏹" : "🎤"}</span>
          {listening ? "Stop" : "Speak holdings"}
        </button>
      </div>

      <p className="mt-2 text-xs text-zinc-500">
        Describe funds in plain English — we search Yahoo Finance and suggest
        tickers. Example: &quot;$621,000 in institutional 500 index&quot; or
        &quot;530k total bond market&quot;
      </p>

      <textarea
        value={transcript + (interim && listening ? ` ${interim}` : "")}
        onChange={(e) => setTranscript(e.target.value)}
        placeholder="Transcript appears here…"
        rows={3}
        className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
      />

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={parseTranscript}
          disabled={parsing || !transcript.trim()}
          className="flex-1 rounded-md bg-zinc-700 py-1.5 text-xs font-medium text-white hover:bg-zinc-600 disabled:opacity-50"
        >
          {parsing ? "Searching funds…" : "Search & match funds"}
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

      <ParseItemsPreview
        items={items}
        onSelect={selectRecommendation}
        onDeselect={deselectRecommendation}
        onExclude={excludeItem}
        onRestore={restoreItem}
      />
    </div>
  );
}
