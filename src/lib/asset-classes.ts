import type { AssetClass } from "./types";

/** Legacy asset class for display grouping */
export function getAssetClass(symbol: string): AssetClass {
  const upper = symbol.toUpperCase();
  const bond = ["BND", "AGG", "VBTLX", "FXNAX", "TLT", "SHY", "IEF", "BNDX", "TIP", "SCHP"];
  const gold = ["GLD", "IAU"];
  const commodity = ["PDBC", "DBC", "USO"];
  const tips = ["TIP", "SCHP", "VAIPX", "TIPS"];
  const inverse = ["SQQQ", "SH", "SPXS", "SDS", "TECS", "AIBD", "GPTS", "QID"];
  const ai = ["NVDA", "MSFT", "PLTR", "ORCL", "SMCI", "AMD", "META", "GOOGL", "GOOG", "AMZN"];

  if (upper === "CASH") return "cash";
  if (tips.includes(upper)) return "tips";
  if (gold.includes(upper)) return "gold";
  if (commodity.includes(upper)) return "commodity";
  if (bond.includes(upper)) return "bond";
  if (inverse.includes(upper)) return "inverse";
  if (ai.includes(upper)) return "ai";
  return "equity";
}

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  equity: "Equity",
  tips: "Inflation-Linked Bonds",
  gold: "Gold",
  commodity: "Commodities",
  bond: "Bonds",
  cash: "Cash",
  inverse: "Inverse / Short ETFs",
  ai: "AI / Tech",
};
