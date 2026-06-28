import type { ExposureBucket, ExposureProfile, FundAnalysis } from "./types";

/** Known fund/stock profiles — weights sum to 1 */
const FUND_DATABASE: Record<
  string,
  { name?: string; type: FundAnalysis["instrumentType"]; exposure: ExposureProfile }
> = {
  // US equity index
  SPY: { type: "etf", exposure: { us_equity: 1 } },
  VOO: { type: "etf", exposure: { us_equity: 1 } },
  IVV: { type: "etf", exposure: { us_equity: 1 } },
  VTI: { type: "etf", exposure: { us_equity: 1 } },
  ITOT: { type: "etf", exposure: { us_equity: 1 } },
  SCHB: { type: "etf", exposure: { us_equity: 1 } },
  FXAIX: { type: "mutual_fund", exposure: { us_equity: 1 } },
  VFIAX: { type: "mutual_fund", exposure: { us_equity: 1 } },
  VTSAX: { type: "mutual_fund", exposure: { us_equity: 1 } },
  SWPPX: { type: "mutual_fund", exposure: { us_equity: 1 } },

  // Intl equity
  VXUS: { type: "etf", exposure: { intl_equity: 1 } },
  VTIAX: { type: "mutual_fund", exposure: { intl_equity: 1 } },
  IXUS: { type: "etf", exposure: { intl_equity: 1 } },
  EFA: { type: "etf", exposure: { intl_equity: 1 } },

  // Aggregate / investment-grade bonds
  BND: { name: "Vanguard Total Bond", type: "etf", exposure: { investment_grade_bond: 0.85, cash: 0.15 } },
  AGG: { name: "iShares Core US Aggregate Bond", type: "etf", exposure: { investment_grade_bond: 0.85, cash: 0.15 } },
  VBTLX: { type: "mutual_fund", exposure: { investment_grade_bond: 0.85, cash: 0.15 } },
  FXNAX: { type: "mutual_fund", exposure: { investment_grade_bond: 0.85, cash: 0.15 } },
  BNDX: { type: "etf", exposure: { investment_grade_bond: 0.7, intl_equity: 0.1, cash: 0.2 } },

  // Long treasuries
  TLT: { type: "etf", exposure: { long_treasury: 1 } },
  VGLT: { type: "etf", exposure: { long_treasury: 1 } },
  EDV: { type: "etf", exposure: { long_treasury: 1 } },

  // Short / intermediate treasuries
  SHY: { type: "etf", exposure: { investment_grade_bond: 0.9, cash: 0.1 } },
  IEF: { type: "etf", exposure: { investment_grade_bond: 0.85, long_treasury: 0.15 } },
  VGSH: { type: "etf", exposure: { investment_grade_bond: 0.9, cash: 0.1 } },

  // TIPS
  TIP: { type: "etf", exposure: { tips: 1 } },
  SCHP: { type: "etf", exposure: { tips: 1 } },
  VAIPX: { type: "mutual_fund", exposure: { tips: 1 } },

  // Gold / commodities
  GLD: { type: "etf", exposure: { gold: 1 } },
  IAU: { type: "etf", exposure: { gold: 1 } },
  PDBC: { type: "etf", exposure: { commodity: 1 } },
  DBC: { type: "etf", exposure: { commodity: 1 } },

  // REITs
  VNQ: { type: "etf", exposure: { real_estate: 0.9, us_equity: 0.1 } },
  SCHH: { type: "etf", exposure: { real_estate: 0.9, us_equity: 0.1 } },

  // High yield
  HYG: { type: "etf", exposure: { high_yield: 0.9, cash: 0.1 } },
  JNK: { type: "etf", exposure: { high_yield: 0.9, cash: 0.1 } },

  // Balanced / allocation
  AOR: { name: "iShares Core Growth Allocation", type: "etf", exposure: { us_equity: 0.48, intl_equity: 0.12, investment_grade_bond: 0.35, cash: 0.05 } },
  AOM: { type: "etf", exposure: { us_equity: 0.28, intl_equity: 0.07, investment_grade_bond: 0.6, cash: 0.05 } },
  AOA: { type: "etf", exposure: { us_equity: 0.58, intl_equity: 0.17, investment_grade_bond: 0.2, cash: 0.05 } },
  VBIAX: { type: "mutual_fund", exposure: { us_equity: 0.55, intl_equity: 0.05, investment_grade_bond: 0.4 } },
  VWELX: { type: "mutual_fund", exposure: { us_equity: 0.65, intl_equity: 0.05, investment_grade_bond: 0.3 } },

  // Target date (approximate glide paths)
  VFIFX: { name: "Vanguard Target 2050", type: "mutual_fund", exposure: { us_equity: 0.52, intl_equity: 0.18, investment_grade_bond: 0.25, cash: 0.05 } },
  VFFVX: { name: "Vanguard Target 2055", type: "mutual_fund", exposure: { us_equity: 0.54, intl_equity: 0.2, investment_grade_bond: 0.22, cash: 0.04 } },
  VTTSX: { name: "Vanguard Target 2060", type: "mutual_fund", exposure: { us_equity: 0.56, intl_equity: 0.22, investment_grade_bond: 0.18, cash: 0.04 } },
  TRRMX: { name: "T. Rowe Price Retire 2045", type: "mutual_fund", exposure: { us_equity: 0.5, intl_equity: 0.15, investment_grade_bond: 0.3, cash: 0.05 } },

  // Inverse
  SQQQ: { type: "etf", exposure: { inverse_equity: 1 } },
  SH: { type: "etf", exposure: { inverse_equity: 1 } },
  SPXS: { type: "etf", exposure: { inverse_equity: 1 } },
  TECS: { type: "etf", exposure: { inverse_equity: 0.8, ai_tech: 0.2 } },

  // Money market / cash equivalents
  VMFXX: { type: "mutual_fund", exposure: { cash: 1 } },
  DTVLX: { type: "mutual_fund", exposure: { us_equity: 0.7, intl_equity: 0.3 } },
  DFAT: { type: "etf", exposure: { us_equity: 0.7, intl_equity: 0.3 } },
  VTTVX: { name: "Vanguard Target 2025", type: "mutual_fund", exposure: { us_equity: 0.38, intl_equity: 0.12, investment_grade_bond: 0.45, cash: 0.05 } },
  VTHRX: { name: "Vanguard Target 2030", type: "mutual_fund", exposure: { us_equity: 0.48, intl_equity: 0.15, investment_grade_bond: 0.32, cash: 0.05 } },
  VWENX: { name: "Vanguard Wellington Admiral", type: "mutual_fund", exposure: { us_equity: 0.65, investment_grade_bond: 0.35 } },
  VIIIX: { type: "mutual_fund", exposure: { us_equity: 1 } },
  VTSNX: { type: "mutual_fund", exposure: { intl_equity: 1 } },
  VBTIX: { type: "mutual_fund", exposure: { investment_grade_bond: 0.85, cash: 0.15 } },
  SPAXX: { type: "mutual_fund", exposure: { cash: 1 } },
  BIL: { type: "etf", exposure: { cash: 1 } },
};

const AI_TICKERS = new Set([
  "NVDA", "MSFT", "PLTR", "ORCL", "SMCI", "AMD", "META", "GOOGL", "GOOG",
  "AMZN", "CRM", "SNOW", "AI", "SOUN", "ARM", "AVGO", "TSM", "MRVL",
]);

function normalizeProfile(exposure: ExposureProfile): ExposureProfile {
  const sum = Object.values(exposure).reduce((a, b) => a + (b ?? 0), 0);
  if (sum <= 0) return { us_equity: 1 };
  const out: ExposureProfile = {};
  for (const [k, v] of Object.entries(exposure)) {
    if (v && v > 0) out[k as ExposureBucket] = v / sum;
  }
  return out;
}

function profileFromCategory(category: string): ExposureProfile | null {
  const c = category.toLowerCase();
  if (c.includes("long government") || c.includes("long-term bond"))
    return { long_treasury: 1 };
  if (c.includes("intermediate-term bond") || c.includes("intermediate core bond"))
    return { investment_grade_bond: 0.9, cash: 0.1 };
  if (c.includes("short-term bond") || c.includes("short duration"))
    return { investment_grade_bond: 0.7, cash: 0.3 };
  if (c.includes("inflation-protected") || c.includes("tips"))
    return { tips: 1 };
  if (c.includes("corporate bond") || c.includes("aggregate") || c.includes("total bond"))
    return { investment_grade_bond: 0.85, cash: 0.15 };
  if (c.includes("high yield") || c.includes("junk"))
    return { high_yield: 0.9, cash: 0.1 };
  if (c.includes("large blend") || c.includes("large cap") || c.includes("s&p 500"))
    return { us_equity: 1 };
  if (c.includes("large growth") || c.includes("technology") || c.includes("growth"))
    return { us_equity: 0.85, ai_tech: 0.15 };
  if (c.includes("foreign") || c.includes("international") || c.includes("world"))
    return c.includes("world") ? { us_equity: 0.55, intl_equity: 0.45 } : { intl_equity: 1 };
  if (c.includes("balanced") || c.includes("allocation"))
    return { us_equity: 0.45, intl_equity: 0.1, investment_grade_bond: 0.4, cash: 0.05 };
  if (c.includes("target-date") || c.includes("retirement"))
    return { us_equity: 0.5, intl_equity: 0.15, investment_grade_bond: 0.3, cash: 0.05 };
  if (c.includes("real estate") || c.includes("reit"))
    return { real_estate: 0.9, us_equity: 0.1 };
  if (c.includes("commodity") || c.includes("precious metals"))
    return c.includes("gold") ? { gold: 1 } : { commodity: 1 };
  if (c.includes("money market"))
    return { cash: 1 };
  return null;
}

export function formatExposureLabel(exposure: ExposureProfile): string {
  return Object.entries(exposure)
    .filter(([, w]) => (w ?? 0) > 0.01)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 3)
    .map(([b, w]) => `${Math.round((w ?? 0) * 100)}% ${b.replace(/_/g, " ")}`)
    .join(", ");
}

export function resolveFundAnalysis(
  symbol: string,
  meta?: { name?: string; quoteType?: string; categoryName?: string },
): FundAnalysis {
  const upper = symbol.toUpperCase();

  if (upper === "CASH") {
    return {
      symbol: upper,
      instrumentType: "unknown",
      exposure: { cash: 1 },
      source: "database",
    };
  }

  const db = FUND_DATABASE[upper];
  if (db) {
    return {
      symbol: upper,
      name: db.name ?? meta?.name,
      instrumentType: db.type,
      exposure: normalizeProfile(db.exposure),
      source: "database",
    };
  }

  if (meta?.categoryName) {
    const fromCat = profileFromCategory(meta.categoryName);
    if (fromCat) {
      return {
        symbol: upper,
        name: meta.name,
        instrumentType: meta.quoteType?.includes("MUTUALFUND") ? "mutual_fund" : "etf",
        category: meta.categoryName,
        exposure: normalizeProfile(fromCat),
        source: "yahoo_category",
      };
    }
  }

  if (AI_TICKERS.has(upper)) {
    return {
      symbol: upper,
      name: meta?.name,
      instrumentType: "stock",
      exposure: { ai_tech: 0.7, us_equity: 0.3 },
      source: "inferred",
    };
  }

  const qt = meta?.quoteType?.toUpperCase() ?? "";
  if (qt === "EQUITY" || qt === "") {
    return {
      symbol: upper,
      name: meta?.name,
      instrumentType: "stock",
      exposure: { us_equity: 1 },
      source: "inferred",
    };
  }

  if (qt.includes("MUTUALFUND") || qt.includes("ETF")) {
    return {
      symbol: upper,
      name: meta?.name,
      instrumentType: qt.includes("MUTUALFUND") ? "mutual_fund" : "etf",
      category: meta?.categoryName,
      exposure: { us_equity: 0.5, investment_grade_bond: 0.5 },
      source: "inferred",
    };
  }

  return {
    symbol: upper,
    name: meta?.name,
    instrumentType: "unknown",
    exposure: { us_equity: 1 },
    source: "inferred",
  };
}

export function computeWeightedShock(
  exposure: ExposureProfile,
  bucketShocks: Partial<Record<ExposureBucket, number>>,
): number {
  let shock = 0;
  for (const [bucket, weight] of Object.entries(exposure)) {
    const w = weight ?? 0;
    const s = bucketShocks[bucket as ExposureBucket] ?? 0;
    shock += w * s;
  }
  return shock;
}

export function aggregatePortfolioMix(
  holdings: { value?: number; analysis?: FundAnalysis }[],
  cash: number,
): { bucket: ExposureBucket; weight: number; value: number }[] {
  let total = cash;
  for (const h of holdings) total += h.value ?? 0;

  const bucketValues = new Map<ExposureBucket, number>();
  if (cash > 0) bucketValues.set("cash", cash);

  for (const h of holdings) {
    const val = h.value ?? 0;
    const exp = h.analysis?.exposure ?? { us_equity: 1 };
    for (const [b, w] of Object.entries(exp)) {
      const bucket = b as ExposureBucket;
      bucketValues.set(bucket, (bucketValues.get(bucket) ?? 0) + val * (w ?? 0));
    }
  }

  return [...bucketValues.entries()]
    .map(([bucket, value]) => ({
      bucket,
      weight: total > 0 ? value / total : 0,
      value,
    }))
    .filter((s) => s.weight > 0.001)
    .sort((a, b) => b.weight - a.weight);
}
