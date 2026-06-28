"use client";

import { useState } from "react";
import type { ForecastMatrix, YearlyPositionDetail } from "@/lib/types";

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

function YearChange({ values, index }: { values: number[]; index: number }) {
  if (index === 0) return null;
  const prev = values[index - 1];
  const curr = values[index];
  const pct = prev > 0 ? (curr - prev) / prev : 0;
  return (
    <span
      className={`block text-[10px] ${pct >= 0 ? "text-emerald-500" : "text-red-500"}`}
    >
      {formatPct(pct)}
    </span>
  );
}

function DetailCard({ detail }: { detail: YearlyPositionDetail }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-zinc-300">{detail.label}</span>
        <span
          className={
            detail.changeUsd >= 0 ? "text-emerald-400" : "text-red-400"
          }
        >
          {formatUsd(detail.changeUsd)} ({formatPct(detail.shockPercent)})
        </span>
      </div>
      <p className="mt-2 text-zinc-400">{detail.explanation}</p>
      {detail.strategyNote && (
        <p className="mt-1 text-amber-400/90">Strategy: {detail.strategyNote}</p>
      )}
      <ul className="mt-2 space-y-1 border-t border-zinc-800 pt-2">
        {detail.bucketBreakdown.map((b) => (
          <li key={b.bucket} className="flex justify-between gap-4 text-zinc-500">
            <span>
              {b.label} · {(b.weight * 100).toFixed(0)}% weight
            </span>
            <span className={b.contribution >= 0 ? "text-emerald-400" : "text-red-400"}>
              {formatPct(b.bucketShock)} → {formatPct(b.contribution)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ForecastMatrixProps {
  matrix: ForecastMatrix;
  strategyName?: string;
}

export default function ForecastMatrixTable({
  matrix,
  strategyName,
}: ForecastMatrixProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const expandedRow = matrix.rows.find((r) => r.symbol === expanded);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-300">
          Forecast Matrix — funds × years
        </h3>
        {strategyName && (
          <p className="mt-1 text-xs text-zinc-500">
            Strategy: <span className="text-emerald-400">{strategyName}</span>
          </p>
        )}
        <p className="mt-1 text-xs text-zinc-500">
          Rows are funds; columns are forecast years left to right. Click a fund
          to see why it moved each year.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
              <th className="sticky left-0 z-10 bg-zinc-900/95 px-4 py-2 min-w-[140px]">
                Fund
              </th>
              {matrix.yearLabels.map((label, i) => (
                <th key={label} className="px-3 py-2 text-right whitespace-nowrap">
                  {label}
                  {i > 0 && (
                    <span className="block font-normal text-zinc-600">Yr {i}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr
                key={row.symbol}
                className={`border-b border-zinc-800/50 ${
                  row.isTotal
                    ? "bg-zinc-800/40 font-semibold"
                    : "hover:bg-zinc-800/30 cursor-pointer"
                }`}
                onClick={() =>
                  !row.isTotal &&
                  setExpanded((prev) => (prev === row.symbol ? null : row.symbol))
                }
              >
                <td className="sticky left-0 z-10 bg-inherit px-4 py-2 font-mono">
                  {!row.isTotal && (
                    <span className="mr-1 text-zinc-600">
                      {expanded === row.symbol ? "▼" : "▶"}
                    </span>
                  )}
                  {row.label}
                </td>
                {row.values.map((val, i) => (
                  <td key={`${row.symbol}-${i}`} className="px-3 py-2 text-right">
                    {formatUsd(val)}
                    <YearChange values={row.values} index={i} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {expandedRow?.yearlyDetails && expandedRow.yearlyDetails.length > 0 && (
        <div className="border-t border-zinc-800 px-4 py-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Why {expandedRow.label} moved — itemized breakdown
          </h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {expandedRow.yearlyDetails.map((detail) => (
              <DetailCard key={detail.year} detail={detail} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
