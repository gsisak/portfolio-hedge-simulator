export type ExposureBucket =
  | "us_equity"
  | "intl_equity"
  | "investment_grade_bond"
  | "long_treasury"
  | "tips"
  | "gold"
  | "commodity"
  | "cash"
  | "ai_tech"
  | "inverse_equity"
  | "real_estate"
  | "high_yield";

export type AssetClass =
  | "equity"
  | "tips"
  | "gold"
  | "commodity"
  | "bond"
  | "cash"
  | "inverse"
  | "ai";

/** Weights sum to 1.0 — how a holding maps to shock buckets */
export type ExposureProfile = Partial<Record<ExposureBucket, number>>;

export interface FundAnalysis {
  symbol: string;
  name?: string;
  instrumentType: "stock" | "etf" | "mutual_fund" | "unknown";
  category?: string;
  exposure: ExposureProfile;
  source: "database" | "yahoo_category" | "inferred";
}

export interface Holding {
  symbol: string;
  shares: number;
  price?: number;
  value?: number;
  analysis?: FundAnalysis;
}

export interface Portfolio {
  holdings: Holding[];
  cash: number;
}

export type BucketShocks = Partial<Record<ExposureBucket, number>>;

export interface ScenarioYear {
  label: string;
  bucketShocks: BucketShocks;
}

export interface ScenarioShock {
  id: string;
  name: string;
  description: string;
  /** Default forecast length in years */
  defaultForecastYears: number;
  /** Per-year bucket shocks; length defines max forecast path */
  yearlyPath: ScenarioYear[];
  hedgeSuggestions: string[];
  /** Legacy ticker overrides applied on top of bucket math */
  tickerShocks?: Record<string, number>;
}

export interface PositionResult {
  symbol: string;
  shares: number;
  startValue: number;
  endValue: number;
  pnl: number;
  pnlPercent: number;
  assetClass: AssetClass;
  shockApplied: number;
  exposure: ExposureProfile;
  exposureLabel: string;
  yearlyValues?: number[];
}

export interface ForecastPoint {
  year: number;
  label: string;
  portfolioValue: number;
  pnlFromStart: number;
  pnlPercentFromStart: number;
}

export interface SimulationResult {
  scenario: ScenarioShock;
  forecastYears: number;
  startValue: number;
  endValue: number;
  pnl: number;
  pnlPercent: number;
  positions: PositionResult[];
  hedges: HedgeRecommendation[];
  forecast: ForecastPoint[];
  portfolioMix: PortfolioMixSlice[];
}

export interface PortfolioMixSlice {
  bucket: ExposureBucket;
  label: string;
  weight: number;
  value: number;
}

export interface HedgeRecommendation {
  symbol: string;
  name: string;
  rationale: string;
  allocationPercent: number;
  expectedBenefit: string;
}

export interface ShortInterestRow {
  rank: number;
  symbol: string;
  company: string;
  shortInterest: number;
  floatShortPercent: number;
  daysToCover: number;
  sector: string;
  source: string;
  asOf: string;
}

export interface QuoteResult {
  symbol: string;
  price: number;
  currency: string;
  name?: string;
  quoteType?: string;
  categoryName?: string;
}

export const BUCKET_LABELS: Record<ExposureBucket, string> = {
  us_equity: "US Equities",
  intl_equity: "International Equities",
  investment_grade_bond: "Investment-Grade Bonds",
  long_treasury: "Long Treasuries",
  tips: "Inflation-Linked Bonds (TIPS)",
  gold: "Gold",
  commodity: "Commodities",
  cash: "Cash / Money Market",
  ai_tech: "AI / Growth Tech",
  inverse_equity: "Inverse Equity",
  real_estate: "Real Estate (REITs)",
  high_yield: "High-Yield Bonds",
};
