import { getAssetClass } from "./asset-classes";
import {
  aggregatePortfolioMix,
  computeWeightedShock,
  formatExposureLabel,
} from "./exposure";
import { getScenarioYears } from "./scenarios";
import type {
  ExposureProfile,
  ForecastPoint,
  HedgeRecommendation,
  Holding,
  Portfolio,
  PortfolioMixSlice,
  PositionResult,
  ScenarioShock,
  SimulationResult,
} from "./types";
import { BUCKET_LABELS } from "./types";

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

function simulatePositionOverYears(
  holding: Holding,
  scenario: ScenarioShock,
  forecastYears: number,
  startValue: number,
): { endValue: number; yearlyValues: number[]; totalShock: number } {
  const exposure = holding.analysis?.exposure ?? { us_equity: 1 };
  let value = startValue;
  const yearlyValues = [startValue];

  for (let y = 0; y < forecastYears; y++) {
    const shock = resolveShockForYear(scenario, holding.symbol, exposure, y);
    value = value * (1 + shock);
    yearlyValues.push(value);
  }

  const totalShock = startValue > 0 ? value / startValue - 1 : 0;
  return { endValue: value, yearlyValues, totalShock };
}

function buildForecastTimeline(
  portfolio: Portfolio,
  scenario: ScenarioShock,
  forecastYears: number,
  startValue: number,
): ForecastPoint[] {
  const years = getScenarioYears(scenario, forecastYears);
  const points: ForecastPoint[] = [
    {
      year: 0,
      label: "Today",
      portfolioValue: startValue,
      pnlFromStart: 0,
      pnlPercentFromStart: 0,
    },
  ];

  let portfolioValue = startValue;

  for (let y = 0; y < forecastYears; y++) {
    let yearEnd = portfolio.cash;
    const cashShock = computeWeightedShock(
      { cash: 1 },
      years[y].bucketShocks,
    );
    yearEnd = portfolio.cash * Math.pow(1 + cashShock, y + 1);

    for (const h of portfolio.holdings) {
      const start = positionValue(h);
      const { yearlyValues } = simulatePositionOverYears(
        h,
        scenario,
        y + 1,
        start,
      );
      yearEnd += yearlyValues[yearlyValues.length - 1];
    }

    portfolioValue = yearEnd;
    points.push({
      year: y + 1,
      label: years[y].label,
      portfolioValue,
      pnlFromStart: portfolioValue - startValue,
      pnlPercentFromStart:
        startValue > 0 ? (portfolioValue - startValue) / startValue : 0,
    });
  }

  return points;
}

export function simulatePortfolio(
  portfolio: Portfolio,
  scenario: ScenarioShock,
  forecastYears: number = scenario.defaultForecastYears,
): SimulationResult {
  const years = Math.max(1, Math.min(forecastYears, 10));
  const positions: PositionResult[] = [];
  let startValue = portfolio.cash;

  for (const holding of portfolio.holdings) {
    startValue += positionValue(holding);
  }

  for (const holding of portfolio.holdings) {
    const start = positionValue(holding);
    const exposure = holding.analysis?.exposure ?? { us_equity: 1 };
    const { endValue, yearlyValues, totalShock } = simulatePositionOverYears(
      holding,
      scenario,
      years,
      start,
    );

    positions.push({
      symbol: holding.symbol.toUpperCase(),
      shares: holding.shares,
      startValue: start,
      endValue,
      pnl: endValue - start,
      pnlPercent: start > 0 ? (endValue - start) / start : 0,
      assetClass: getAssetClass(holding.symbol),
      shockApplied: totalShock,
      exposure,
      exposureLabel: formatExposureLabel(exposure),
      yearlyValues,
    });
  }

  const cashExposure = { cash: 1 } as ExposureProfile;
  const scenarioYears = getScenarioYears(scenario, years);
  let cashEnd = portfolio.cash;
  for (let y = 0; y < years; y++) {
    const shock = computeWeightedShock(cashExposure, scenarioYears[y].bucketShocks);
    cashEnd = (y === 0 ? portfolio.cash : cashEnd) * (1 + shock);
  }

  if (portfolio.cash > 0) {
    positions.push({
      symbol: "CASH",
      shares: 1,
      startValue: portfolio.cash,
      endValue: cashEnd,
      pnl: cashEnd - portfolio.cash,
      pnlPercent:
        portfolio.cash > 0 ? (cashEnd - portfolio.cash) / portfolio.cash : 0,
      assetClass: "cash",
      shockApplied:
        portfolio.cash > 0 ? cashEnd / portfolio.cash - 1 : 0,
      exposure: { cash: 1 },
      exposureLabel: "100% cash",
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

  return {
    scenario,
    forecastYears: years,
    startValue,
    endValue,
    pnl: endValue - startValue,
    pnlPercent: startValue > 0 ? (endValue - startValue) / startValue : 0,
    positions: positions.sort((a, b) => a.pnl - b.pnl),
    hedges: buildHedgeRecommendations(scenario),
    forecast: buildForecastTimeline(portfolio, scenario, years, startValue),
    portfolioMix,
  };
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
): SimulationResult[] {
  return scenarios.map((s) =>
    simulatePortfolio(portfolio, s, forecastYears ?? s.defaultForecastYears),
  );
}
