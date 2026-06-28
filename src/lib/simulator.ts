import { getAssetClass } from "./asset-classes";
import {
  aggregatePortfolioMix,
  computeWeightedShock,
  formatExposureLabel,
} from "./exposure";
import { getScenarioYears } from "./scenarios";
import { getStrategy, type StrategyId } from "./strategies";
import type {
  ExposureBucket,
  ExposureProfile,
  ForecastMatrix,
  ForecastMatrixRow,
  ForecastPoint,
  HedgeRecommendation,
  Holding,
  Portfolio,
  PortfolioMixSlice,
  PositionResult,
  ScenarioShock,
  SimulationResult,
  YearlyPositionDetail,
} from "./types";
import { BUCKET_LABELS } from "./types";

interface HoldingState {
  symbol: string;
  holding: Holding;
  value: number;
  exposure: ExposureProfile;
}

function positionValue(holding: Holding): number {
  if (holding.value !== undefined) return holding.value;
  if (holding.price !== undefined) return holding.shares * holding.price;
  return 0;
}

function resolveShockForYear(
  scenario: ScenarioShock,
  symbol: string,
  exposure: ExposureProfile,
  yearIndex: number,
): number {
  const years = getScenarioYears(scenario, yearIndex + 1);
  const year = years[yearIndex];
  if (!year) return 0;

  const upper = symbol.toUpperCase();
  const bucketShock = computeWeightedShock(exposure, year.bucketShocks);
  const tickerOverride = scenario.tickerShocks?.[upper];

  if (tickerOverride !== undefined && yearIndex === 0) {
    return tickerOverride;
  }
  return bucketShock;
}

function buildBucketBreakdown(
  exposure: ExposureProfile,
  bucketShocks: Partial<Record<ExposureBucket, number>>,
): YearlyPositionDetail["bucketBreakdown"] {
  return Object.entries(exposure)
    .filter(([, w]) => (w ?? 0) > 0)
    .map(([bucket, weight]) => {
      const b = bucket as ExposureBucket;
      const bucketShock = bucketShocks[b] ?? 0;
      const w = weight ?? 0;
      return {
        bucket: b,
        label: BUCKET_LABELS[b],
        weight: w,
        bucketShock,
        contribution: w * bucketShock,
      };
    })
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
}

function formatExplanation(breakdown: YearlyPositionDetail["bucketBreakdown"]): string {
  if (breakdown.length === 0) return "No exposure breakdown available.";
  const parts = breakdown.slice(0, 4).map(
    (b) =>
      `${b.label}: ${(b.bucketShock * 100).toFixed(1)}% × ${(b.weight * 100).toFixed(0)}% = ${(b.contribution * 100).toFixed(1)}%`,
  );
  return parts.join(" · ");
}

function dominantBucket(exposure: ExposureProfile): ExposureBucket {
  let best: ExposureBucket = "us_equity";
  let bestW = 0;
  for (const [b, w] of Object.entries(exposure)) {
    if ((w ?? 0) > bestW) {
      bestW = w ?? 0;
      best = b as ExposureBucket;
    }
  }
  return best;
}

function applyAnnualRebalance(
  states: HoldingState[],
  cash: number,
  targetMix: Partial<Record<ExposureBucket, number>>,
): { states: HoldingState[]; cash: number; note: string } {
  const total =
    cash + states.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return { states, cash, note: "" };

  const byBucket = new Map<ExposureBucket, HoldingState[]>();
  for (const s of states) {
    const bucket = dominantBucket(s.exposure);
    const list = byBucket.get(bucket) ?? [];
    list.push(s);
    byBucket.set(bucket, list);
  }

  const newStates = states.map((s) => ({ ...s }));
  let newCash = cash;

  for (const [bucket, targetWeight] of Object.entries(targetMix)) {
    const b = bucket as ExposureBucket;
    const targetValue = total * (targetWeight ?? 0);

    if (b === "cash") {
      newCash = targetValue;
      continue;
    }

    const group = byBucket.get(b) ?? [];
    const currentGroupValue = group.reduce((sum, s) => sum + s.value, 0);
    if (group.length === 0 || currentGroupValue <= 0) continue;

    const scale = targetValue / currentGroupValue;
    for (const s of group) {
      const idx = newStates.findIndex((x) => x.symbol === s.symbol);
      if (idx >= 0) newStates[idx].value *= scale;
    }
  }

  return {
    states: newStates,
    cash: newCash,
    note: "Rebalanced to 60/40 target mix at year start",
  };
}

function applyDefensiveRotation(
  states: HoldingState[],
  cash: number,
  priorYearReturn: number,
): { states: HoldingState[]; cash: number; note: string } {
  if (priorYearReturn >= -0.1) return { states, cash, note: "" };

  const equityBuckets: ExposureBucket[] = [
    "us_equity",
    "intl_equity",
    "ai_tech",
    "real_estate",
  ];
  const bondBuckets: ExposureBucket[] = [
    "investment_grade_bond",
    "long_treasury",
    "tips",
    "high_yield",
  ];

  let equityValue = 0;
  let bondValue = 0;
  for (const s of states) {
    for (const [b, w] of Object.entries(s.exposure)) {
      const val = s.value * (w ?? 0);
      if (equityBuckets.includes(b as ExposureBucket)) equityValue += val;
      if (bondBuckets.includes(b as ExposureBucket)) bondValue += val;
    }
  }

  const shift = equityValue * 0.1;
  if (shift <= 0) return { states, cash, note: "" };

  const newStates = states.map((s) => ({ ...s }));
  for (const s of newStates) {
    const eqShare = Object.entries(s.exposure)
      .filter(([b]) => equityBuckets.includes(b as ExposureBucket))
      .reduce((sum, [, w]) => sum + (w ?? 0), 0);
    if (eqShare > 0) {
      s.value -= shift * (s.value * eqShare) / equityValue;
    }
  }

  const bondStates = newStates.filter((s) =>
    bondBuckets.includes(dominantBucket(s.exposure)),
  );
  if (bondStates.length > 0) {
    const perBond = shift / bondStates.length;
    for (const s of bondStates) s.value += perBond;
  } else {
    cash += shift;
  }

  return {
    states: newStates,
    cash,
    note: `Defensive shift: moved ${(shift / 1000).toFixed(0)}k from stocks to bonds after down year`,
  };
}

function applyDca(
  states: HoldingState[],
  monthlyContribution: number,
): { states: HoldingState[]; note: string } {
  const annual = monthlyContribution * 12;
  const equityStates = states.filter((s) => {
    const bucket = dominantBucket(s.exposure);
    return ["us_equity", "intl_equity", "ai_tech"].includes(bucket);
  });
  if (equityStates.length === 0) return { states, note: "" };

  const newStates = states.map((s) => ({ ...s }));
  const per = annual / equityStates.length;
  for (const s of equityStates) {
    const idx = newStates.findIndex((x) => x.symbol === s.symbol);
    if (idx >= 0) newStates[idx].value += per;
  }

  return {
    states: newStates,
    note: `Added $${annual.toLocaleString()}/yr via DCA into equities`,
  };
}

function applyIncomeReinvest(
  states: HoldingState[],
): { states: HoldingState[]; note: string } {
  const bondBuckets: ExposureBucket[] = [
    "investment_grade_bond",
    "long_treasury",
    "tips",
    "high_yield",
  ];
  let bondTotal = 0;
  for (const s of states) {
    if (bondBuckets.includes(dominantBucket(s.exposure))) bondTotal += s.value;
  }
  const income = bondTotal * 0.03;
  if (income <= 0) return { states, note: "" };

  const newStates = states.map((s) => ({ ...s, value: s.value + income / states.length }));
  return {
    states: newStates,
    note: `Reinvested ~$${income.toFixed(0)} bond income (3% yield)`,
  };
}

function buildForecastMatrix(
  positions: PositionResult[],
  forecastYears: number,
  scenarioYears: { label: string }[],
): ForecastMatrix {
  const yearLabels = [
    "Today",
    ...scenarioYears.slice(0, forecastYears).map((y) => y.label),
  ];

  const rows: ForecastMatrixRow[] = positions.map((p) => ({
    symbol: p.symbol,
    label: p.symbol,
    values: p.yearlyValues ?? [p.startValue, p.endValue],
    yearlyDetails: p.yearlyDetails,
  }));

  const totalValues: number[] = [];
  for (let i = 0; i <= forecastYears; i++) {
    totalValues.push(
      positions.reduce((sum, p) => sum + (p.yearlyValues?.[i] ?? 0), 0),
    );
  }

  rows.push({
    symbol: "TOTAL",
    label: "Portfolio Total",
    values: totalValues,
    isTotal: true,
  });

  return { yearLabels, rows };
}

export function simulatePortfolio(
  portfolio: Portfolio,
  scenario: ScenarioShock,
  forecastYears: number = scenario.defaultForecastYears,
  strategyId: StrategyId = "buy_and_hold",
): SimulationResult {
  const strategy = getStrategy(strategyId);
  const years = Math.max(1, Math.min(forecastYears, 10));
  const scenarioYears = getScenarioYears(scenario, years);

  let states: HoldingState[] = portfolio.holdings.map((h) => ({
    symbol: h.symbol.toUpperCase(),
    holding: h,
    value: positionValue(h),
    exposure: h.analysis?.exposure ?? { us_equity: 1 },
  }));

  let cash = portfolio.cash;
  const startValue =
    cash + states.reduce((sum, s) => sum + s.value, 0);

  const positionDetails = new Map<
    string,
    { yearlyValues: number[]; yearlyDetails: YearlyPositionDetail[] }
  >();

  for (const s of states) {
    positionDetails.set(s.symbol, { yearlyValues: [s.value], yearlyDetails: [] });
  }
  if (cash > 0) {
    positionDetails.set("CASH", { yearlyValues: [cash], yearlyDetails: [] });
  }

  let yearStartTotal = startValue;

  for (let y = 0; y < years; y++) {
    let strategyNote = "";
    const totalAtYearStart =
      states.reduce((sum, s) => sum + s.value, 0) + cash;

    if (y > 0) {
      if (strategy.id === "annual_rebalance" && strategy.targetMix) {
        const r = applyAnnualRebalance(states, cash, strategy.targetMix);
        states = r.states;
        cash = r.cash;
        strategyNote = r.note;
      } else if (strategy.id === "defensive_rotation") {
        const priorReturn =
          yearStartTotal > 0 ? totalAtYearStart / yearStartTotal - 1 : 0;
        const r = applyDefensiveRotation(states, cash, priorReturn);
        states = r.states;
        cash = r.cash;
        strategyNote = r.note;
      } else if (strategy.id === "dca_equity" && strategy.monthlyContribution) {
        const r = applyDca(states, strategy.monthlyContribution);
        states = r.states;
        strategyNote = r.note;
      } else if (strategy.id === "income_reinvest") {
        const r = applyIncomeReinvest(states);
        states = r.states;
        strategyNote = r.note;
      }
    }

    yearStartTotal = totalAtYearStart;

    const yearStartValues = new Map<string, number>();
    for (const s of states) yearStartValues.set(s.symbol, s.value);
    const cashStart = cash;

    for (const s of states) {
      const startVal = s.value;
      const shock = resolveShockForYear(scenario, s.symbol, s.exposure, y);
      s.value = startVal * (1 + shock);

      const breakdown = buildBucketBreakdown(s.exposure, scenarioYears[y].bucketShocks);
      const detail: YearlyPositionDetail = {
        year: y + 1,
        label: scenarioYears[y].label,
        startValue: startVal,
        endValue: s.value,
        shockPercent: shock,
        changeUsd: s.value - startVal,
        explanation: formatExplanation(breakdown),
        bucketBreakdown: breakdown,
        strategyNote: strategyNote || undefined,
      };

      const pd = positionDetails.get(s.symbol)!;
      pd.yearlyValues.push(s.value);
      pd.yearlyDetails.push(detail);
    }

    const cashShock = computeWeightedShock({ cash: 1 }, scenarioYears[y].bucketShocks);
    const cashEnd = cash * (1 + cashShock);
    if (cash > 0 || cashStart > 0) {
      const pd = positionDetails.get("CASH") ?? {
        yearlyValues: [cashStart],
        yearlyDetails: [],
      };
      if (!positionDetails.has("CASH")) positionDetails.set("CASH", pd);
      pd.yearlyValues.push(cashEnd);
      pd.yearlyDetails.push({
        year: y + 1,
        label: scenarioYears[y].label,
        startValue: cash,
        endValue: cashEnd,
        shockPercent: cashShock,
        changeUsd: cashEnd - cash,
        explanation: `Cash / money market: ${(cashShock * 100).toFixed(1)}%`,
        bucketBreakdown: [
          {
            bucket: "cash",
            label: BUCKET_LABELS.cash,
            weight: 1,
            bucketShock: cashShock,
            contribution: cashShock,
          },
        ],
        strategyNote: strategyNote || undefined,
      });
    }
    cash = cashEnd;
  }

  const positions: PositionResult[] = [];

  for (const s of states) {
    const start = positionValue(s.holding);
    const pd = positionDetails.get(s.symbol)!;
    const endValue = s.value;
    const totalShock = start > 0 ? endValue / start - 1 : 0;

    positions.push({
      symbol: s.symbol,
      shares: s.holding.shares,
      startValue: start,
      endValue,
      pnl: endValue - start,
      pnlPercent: start > 0 ? (endValue - start) / start : 0,
      assetClass: getAssetClass(s.holding.symbol),
      shockApplied: totalShock,
      exposure: s.exposure,
      exposureLabel: formatExposureLabel(s.exposure),
      yearlyValues: pd.yearlyValues,
      yearlyDetails: pd.yearlyDetails,
    });
  }

  if (portfolio.cash > 0) {
    const pd = positionDetails.get("CASH")!;
    positions.push({
      symbol: "CASH",
      shares: 1,
      startValue: portfolio.cash,
      endValue: cash,
      pnl: cash - portfolio.cash,
      pnlPercent:
        portfolio.cash > 0 ? (cash - portfolio.cash) / portfolio.cash : 0,
      assetClass: "cash",
      shockApplied: portfolio.cash > 0 ? cash / portfolio.cash - 1 : 0,
      exposure: { cash: 1 },
      exposureLabel: "100% cash",
      yearlyValues: pd.yearlyValues,
      yearlyDetails: pd.yearlyDetails,
    });
  }

  const endValue = positions.reduce((sum, p) => sum + p.endValue, 0);
  const mix = aggregatePortfolioMix(portfolio.holdings, portfolio.cash);
  const portfolioMix: PortfolioMixSlice[] = mix.map((m) => ({
    bucket: m.bucket,
    label: BUCKET_LABELS[m.bucket],
    weight: m.weight,
    value: m.value,
  }));

  const forecast = buildForecastTimelineFromPositions(
    positions,
    scenarioYears,
    years,
    startValue,
  );

  return {
    scenario,
    forecastYears: years,
    strategyId: strategy.id,
    strategyName: strategy.name,
    startValue,
    endValue,
    pnl: endValue - startValue,
    pnlPercent: startValue > 0 ? (endValue - startValue) / startValue : 0,
    positions: positions.sort((a, b) => a.pnl - b.pnl),
    hedges: buildHedgeRecommendations(scenario),
    forecast,
    portfolioMix,
    forecastMatrix: buildForecastMatrix(positions, years, scenarioYears),
  };
}

function buildForecastTimelineFromPositions(
  positions: PositionResult[],
  scenarioYears: { label: string }[],
  forecastYears: number,
  startValue: number,
): ForecastPoint[] {
  const points: ForecastPoint[] = [
    {
      year: 0,
      label: "Today",
      portfolioValue: startValue,
      pnlFromStart: 0,
      pnlPercentFromStart: 0,
    },
  ];

  for (let y = 0; y < forecastYears; y++) {
    const portfolioValue = positions.reduce(
      (sum, p) => sum + (p.yearlyValues?.[y + 1] ?? p.endValue),
      0,
    );
    points.push({
      year: y + 1,
      label: scenarioYears[y].label,
      portfolioValue,
      pnlFromStart: portfolioValue - startValue,
      pnlPercentFromStart:
        startValue > 0 ? (portfolioValue - startValue) / startValue : 0,
    });
  }

  return points;
}

function buildHedgeRecommendations(
  scenario: ScenarioShock,
): HedgeRecommendation[] {
  const map: Record<string, HedgeRecommendation[]> = {
    inflation_spike: [
      { symbol: "TIP", name: "iShares TIPS Bond ETF", rationale: "Principal adjusts with CPI", allocationPercent: 15, expectedBenefit: "TIPS bucket +8% in year 1" },
      { symbol: "GLD", name: "SPDR Gold Shares", rationale: "Historical inflation hedge", allocationPercent: 10, expectedBenefit: "Gold bucket +12% in year 1" },
    ],
    market_crash: [
      { symbol: "BND", name: "Vanguard Total Bond", rationale: "Rallies when equities crash", allocationPercent: 20, expectedBenefit: "Bond portion +5% while stocks -30%" },
      { symbol: "GLD", name: "SPDR Gold Shares", rationale: "Flight-to-safety", allocationPercent: 10, expectedBenefit: "Gold +10% in crash year" },
    ],
    ai_bust: [
      { symbol: "BND", name: "Vanguard Total Bond", rationale: "Diversify away from AI", allocationPercent: 25, expectedBenefit: "Minimal drawdown vs AI stocks" },
      { symbol: "VTV", name: "Vanguard Value ETF", rationale: "Rotate to value", allocationPercent: 20, expectedBenefit: "Outperforms growth/AI" },
    ],
    stagflation: [
      { symbol: "TIP", name: "iShares TIPS Bond ETF", rationale: "Inflation protection", allocationPercent: 20, expectedBenefit: "TIPS +10% in year 1" },
      { symbol: "GLD", name: "SPDR Gold Shares", rationale: "Dual hedge", allocationPercent: 15, expectedBenefit: "Gold +15% in year 1" },
    ],
    openai_indirect: [
      { symbol: "BND", name: "Vanguard Total Bond", rationale: "Uncorrelated to OpenAI risk", allocationPercent: 20, expectedBenefit: "Stable while AI names fall" },
      { symbol: "GOOGL", name: "Alphabet", rationale: "Relative winner", allocationPercent: 10, expectedBenefit: "+5% ticker override" },
    ],
  };
  return map[scenario.id] ?? [];
}

export function simulateAllScenarios(
  portfolio: Portfolio,
  scenarios: ScenarioShock[],
  forecastYears?: number,
  strategyId?: StrategyId,
): SimulationResult[] {
  return scenarios.map((s) =>
    simulatePortfolio(
      portfolio,
      s,
      forecastYears ?? s.defaultForecastYears,
      strategyId,
    ),
  );
}
