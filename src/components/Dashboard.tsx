"use client";

import { useCallback, useEffect, useState } from "react";
import ForecastMatrixTable from "@/components/ForecastMatrix";
import VoicePortfolioInput from "@/components/VoicePortfolioInput";
import type { HoldingInput } from "@/lib/fund-registry";
import { FUND_LABELS } from "@/lib/fund-registry";
import { INVESTMENT_STRATEGIES, type StrategyId } from "@/lib/strategies";
import type {
  PortfolioMixSlice,
  ShortInterestRow,
  SimulationResult,
} from "@/lib/types";

const DEFAULT_HOLDINGS: HoldingInput[] = [
  { symbol: "VTI", shares: "100" },
  { symbol: "BND", shares: "150" },
];

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPct(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(1)}%`;
}

export default function Dashboard() {
  const [holdings, setHoldings] = useState<HoldingInput[]>(DEFAULT_HOLDINGS);
  const [cash, setCash] = useState("0");
  const [forecastYears, setForecastYears] = useState(5);
  const [strategyId, setStrategyId] = useState<StrategyId>("buy_and_hold");
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [portfolioMix, setPortfolioMix] = useState<PortfolioMixSlice[]>([]);
  const [shorts, setShorts] = useState<ShortInterestRow[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"simulate" | "shorts">("simulate");
  const [runMeta, setRunMeta] = useState<{
    portfolioValue: number;
    priceSource: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/shorts?limit=50")
      .then((r) => r.json())
      .then((d) => setShorts(d.rows ?? []))
      .catch(() => {});
  }, []);

  const runSimulation = useCallback(
    async (override?: { holdings: HoldingInput[]; cash: string }) => {
      setLoading(true);
      setError(null);
      const h = override?.holdings ?? holdings;
      const c = override?.cash ?? cash;
      try {
        const res = await fetch("/api/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            holdings: h
              .filter((x) => x.symbol.trim())
              .map((x) => ({
                symbol: x.symbol.trim().toUpperCase(),
                shares: Number(x.shares) || 0,
              })),
            cash: Number(c) || 0,
            fetchPrices: true,
            forecastYears,
            strategyId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Simulation failed");
        setResults(data.results ?? []);
        setPortfolioMix(data.meta?.portfolioMix ?? data.results?.[0]?.portfolioMix ?? []);
        setSelectedScenario(data.results?.[0]?.scenario.id ?? null);
        if (data.meta) {
          setRunMeta({
            portfolioValue: data.meta.portfolioValue ?? data.results?.[0]?.startValue ?? 0,
            priceSource: data.meta.priceSource ?? "Unknown",
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [holdings, cash, forecastYears, strategyId],
  );

  useEffect(() => {
    runSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecastYears, strategyId]);

  const activeResult = results.find((r) => r.scenario.id === selectedScenario);

  const addHolding = () =>
    setHoldings([...holdings, { symbol: "", shares: "" }]);

  const removeHolding = (i: number) =>
    setHoldings(holdings.filter((_, idx) => idx !== i));

  const updateHolding = (i: number, field: keyof HoldingInput, value: string) => {
    const next = [...holdings];
    next[i] = { ...next[i], [field]: value };
    setHoldings(next);
  };

  const addFromShort = (symbol: string) => {
    if (holdings.some((h) => h.symbol.toUpperCase() === symbol)) return;
    setHoldings([...holdings, { symbol, shares: "10" }]);
    setTab("simulate");
  };

  const applyVoiceHoldings = useCallback(
    async (next: HoldingInput[], nextCash: string) => {
      setHoldings(next);
      setCash(nextCash);
      await runSimulation({ holdings: next, cash: nextCash });
    },
    [runSimulation],
  );

  return (
    <div className="min-h-screen bg-[#0b0f14] text-zinc-100">
      <header className="border-b border-zinc-800 bg-[#0e141b]/90 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-emerald-400/80">
                Portfolio Hedge Simulator
              </p>
              <h1 className="text-xl font-semibold text-white sm:text-2xl">
                Stress-test by asset mix, not blanket shocks
              </h1>
            </div>
            <p className="text-xs text-zinc-500 max-w-sm">
              Educational tool only — not investment advice
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <section className="mb-6 rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4">
          <h2 className="text-sm font-semibold text-emerald-300">How it works</h2>
          <ol className="mt-2 grid gap-2 text-sm text-zinc-400 sm:grid-cols-3">
            <li>
              <span className="font-medium text-zinc-200">1. Enter holdings</span> — type
              manually or use the microphone to describe funds and amounts
            </li>
            <li>
              <span className="font-medium text-zinc-200">2. Apply scenario shocks</span> — a
              -30% S&amp;P crash hits only the equity portion of each fund
            </li>
            <li>
              <span className="font-medium text-zinc-200">3. Multi-year forecast</span> —
              compound year-by-year (crash → recovery → growth)
            </li>
          </ol>
          {runMeta && (
            <p className="mt-3 text-xs text-emerald-400/90">
              Portfolio {formatUsd(runMeta.portfolioValue)} · {runMeta.priceSource} ·{" "}
              {forecastYears}-year forecast
            </p>
          )}
        </section>

        <div className="mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("simulate")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === "simulate"
                ? "bg-emerald-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            Scenario Simulator
          </button>
          <button
            type="button"
            onClick={() => setTab("shorts")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === "shorts"
                ? "bg-emerald-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            Top 50 Shorted Stocks
          </button>
        </div>

        {tab === "simulate" ? (
          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            <aside className="space-y-4">
              <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <h2 className="mb-3 text-sm font-semibold text-zinc-300">
                  Your Portfolio
                </h2>

                <VoicePortfolioInput onApply={applyVoiceHoldings} />

                <div className="space-y-2">
                  {holdings.map((h, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ticker"
                        value={h.symbol}
                        onChange={(e) => updateHolding(i, "symbol", e.target.value)}
                        className="w-20 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm uppercase"
                        title={FUND_LABELS[h.symbol.toUpperCase()] ?? h.symbol}
                      />
                      <input
                        type="number"
                        placeholder="Shares"
                        value={h.shares}
                        onChange={(e) => updateHolding(i, "shares", e.target.value)}
                        className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeHolding(i)}
                        className="rounded-md px-2 text-zinc-500 hover:text-red-400"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addHolding}
                  className="mt-2 text-xs text-emerald-400 hover:underline"
                >
                  + Add holding
                </button>
                <label className="mt-4 block">
                  <span className="text-xs text-zinc-400">Cash ($)</span>
                  <input
                    type="number"
                    value={cash}
                    onChange={(e) => setCash(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="mt-4 block">
                  <span className="text-xs text-zinc-400">Forecast horizon (years)</span>
                  <select
                    value={forecastYears}
                    onChange={(e) => setForecastYears(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm"
                  >
                    {[1, 3, 5, 10].map((y) => (
                      <option key={y} value={y}>
                        {y} year{y > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-4 block">
                  <span className="text-xs text-zinc-400">Investment strategy</span>
                  <select
                    value={strategyId}
                    onChange={(e) => setStrategyId(e.target.value as StrategyId)}
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm"
                  >
                    {INVESTMENT_STRATEGIES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    {INVESTMENT_STRATEGIES.find((s) => s.id === strategyId)?.description}
                  </p>
                </label>
                <button
                  type="button"
                  onClick={() => runSimulation()}
                  disabled={loading}
                  className="mt-4 w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {loading ? "Analyzing & simulating…" : "Run All Scenarios"}
                </button>
                {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
              </section>

              {portfolioMix.length > 0 && (
                <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <h2 className="mb-3 text-sm font-semibold text-zinc-300">
                    Your Asset Mix
                  </h2>
                  <div className="space-y-2">
                    {portfolioMix.map((s) => (
                      <div key={s.bucket} className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-emerald-600"
                            style={{ width: `${s.weight * 100}%` }}
                          />
                        </div>
                        <span className="w-24 text-right text-xs text-zinc-400">
                          {Math.round(s.weight * 100)}%
                        </span>
                      </div>
                    ))}
                    {portfolioMix.map((s) => (
                      <p key={`label-${s.bucket}`} className="text-xs text-zinc-500">
                        {s.label}: {formatUsd(s.value)}
                      </p>
                    ))}
                  </div>
                </section>
              )}

              {results.length > 0 && (
                <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <h2 className="mb-3 text-sm font-semibold text-zinc-300">
                    Scenario Overview ({forecastYears}yr)
                  </h2>
                  <div className="space-y-1">
                    {results.map((r) => (
                      <button
                        key={r.scenario.id}
                        type="button"
                        onClick={() => setSelectedScenario(r.scenario.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                          selectedScenario === r.scenario.id
                            ? "bg-zinc-800 ring-1 ring-emerald-600/50"
                            : "hover:bg-zinc-800/60"
                        }`}
                      >
                        <span className="truncate pr-2">{r.scenario.name}</span>
                        <span
                          className={
                            r.pnlPercent >= 0 ? "text-emerald-400" : "text-red-400"
                          }
                        >
                          {formatPct(r.pnlPercent)}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </aside>

            <main className="space-y-4">
              {loading && results.length === 0 ? (
                <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
                  <p className="text-lg font-medium text-zinc-300">
                    Analyzing fund exposures and running scenarios…
                  </p>
                </div>
              ) : activeResult ? (
                <>
                  <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                    <h2 className="text-lg font-semibold">{activeResult.scenario.name}</h2>
                    <p className="mt-1 text-sm text-zinc-400">
                      {activeResult.scenario.description}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Strategy: {activeResult.strategyName}
                    </p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <Metric label="Start Value" value={formatUsd(activeResult.startValue)} />
                      <Metric
                        label={`End Value (${activeResult.forecastYears}yr)`}
                        value={formatUsd(activeResult.endValue)}
                      />
                      <Metric
                        label="Total P&amp;L"
                        value={formatUsd(activeResult.pnl)}
                        accent={activeResult.pnl >= 0 ? "positive" : "negative"}
                        sub={formatPct(activeResult.pnlPercent)}
                      />
                    </div>
                  </section>

                  {activeResult.forecastMatrix && (
                    <ForecastMatrixTable
                      matrix={activeResult.forecastMatrix}
                      strategyName={activeResult.strategyName}
                    />
                  )}

                  <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                    <h3 className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-300">
                      Portfolio Total by Year
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                            <th className="px-4 py-2">Period</th>
                            <th className="px-4 py-2">Portfolio Value</th>
                            <th className="px-4 py-2">P&amp;L vs Today</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeResult.forecast.map((pt) => (
                            <tr
                              key={pt.year}
                              className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                            >
                              <td className="px-4 py-2">{pt.label}</td>
                              <td className="px-4 py-2">{formatUsd(pt.portfolioValue)}</td>
                              <td
                                className={`px-4 py-2 font-medium ${
                                  pt.pnlFromStart >= 0
                                    ? "text-emerald-400"
                                    : "text-red-400"
                                }`}
                              >
                                {formatUsd(pt.pnlFromStart)} ({formatPct(pt.pnlPercentFromStart)})
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                    <h3 className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-300">
                      Position Breakdown — shocks applied by fund exposure
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                            <th className="px-4 py-2">Symbol</th>
                            <th className="px-4 py-2">Exposure</th>
                            <th className="px-4 py-2">Start</th>
                            <th className="px-4 py-2">End</th>
                            <th className="px-4 py-2">Total Shock</th>
                            <th className="px-4 py-2">P&amp;L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeResult.positions.map((p) => (
                            <tr
                              key={p.symbol}
                              className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                            >
                              <td className="px-4 py-2 font-mono font-medium">{p.symbol}</td>
                              <td className="px-4 py-2 text-xs text-zinc-400">
                                {p.exposureLabel}
                              </td>
                              <td className="px-4 py-2">{formatUsd(p.startValue)}</td>
                              <td className="px-4 py-2">{formatUsd(p.endValue)}</td>
                              <td
                                className={`px-4 py-2 ${
                                  p.shockApplied >= 0
                                    ? "text-emerald-400"
                                    : "text-red-400"
                                }`}
                              >
                                {formatPct(p.shockApplied)}
                              </td>
                              <td
                                className={`px-4 py-2 font-medium ${
                                  p.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                                }`}
                              >
                                {formatUsd(p.pnl)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {activeResult.hedges.length > 0 && (
                    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                      <h3 className="text-sm font-semibold text-zinc-300">
                        Suggested Hedges
                      </h3>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {activeResult.hedges.map((h) => (
                          <div
                            key={h.symbol}
                            className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-3"
                          >
                            <span className="font-mono font-semibold text-emerald-400">
                              {h.symbol}
                            </span>
                            <p className="mt-1 text-sm text-zinc-300">{h.name}</p>
                            <p className="mt-1 text-xs text-zinc-500">{h.rationale}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              ) : null}
            </main>
          </div>
        ) : (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
            <div className="border-b border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-zinc-300">
                Most Shorted Stocks (by % of float)
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                {shorts.length > 0 ? `${shorts.length} stocks loaded.` : "Loading…"}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                    <th className="px-4 py-2">#</th>
                    <th className="px-4 py-2">Symbol</th>
                    <th className="px-4 py-2">Company</th>
                    <th className="px-4 py-2">Short % Float</th>
                    <th className="px-4 py-2">Days to Cover</th>
                    <th className="px-4 py-2">Sector</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {shorts.map((row) => (
                    <tr
                      key={row.symbol}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                    >
                      <td className="px-4 py-2 text-zinc-500">{row.rank}</td>
                      <td className="px-4 py-2 font-mono font-medium">{row.symbol}</td>
                      <td className="px-4 py-2">{row.company}</td>
                      <td className="px-4 py-2 text-amber-400">
                        {row.floatShortPercent.toFixed(1)}%
                      </td>
                      <td className="px-4 py-2">{row.daysToCover.toFixed(1)}</td>
                      <td className="px-4 py-2 text-zinc-400">{row.sector}</td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => addFromShort(row.symbol)}
                          className="text-xs text-emerald-400 hover:underline"
                        >
                          Add to portfolio
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "positive" | "negative";
}) {
  return (
    <div className="rounded-lg bg-zinc-800/50 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold ${
          accent === "positive"
            ? "text-emerald-400"
            : accent === "negative"
              ? "text-red-400"
              : "text-white"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}
