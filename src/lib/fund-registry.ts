export interface HoldingInput {
  symbol: string;
  shares: string;
}

/** Searchable fund registry: ticker + spoken aliases */
export const FUND_REGISTRY: {
  symbol: string;
  label: string;
  aliases: string[];
}[] = [
  { symbol: "VTTVX", label: "Vanguard Target Retirement 2025", aliases: ["target retirement 2025", "target 2025", "retirement 2025", "vttvx"] },
  { symbol: "VTHRX", label: "Vanguard Target Retirement 2030", aliases: ["target retirement 2030", "target 2030", "retirement 2030", "vthrx"] },
  { symbol: "VWENX", label: "Vanguard Wellington Admiral", aliases: ["wellington admiral", "wellington fund", "vwenx", "wellington"] },
  { symbol: "VOO", label: "Vanguard S&P 500 / Inst 500", aliases: ["inst 500", "institutional 500", "500 index", "s and p 500", "s&p 500", "sp 500", "voo", "vfiax", "fxaix", "m077", "vanguard 500"] },
  { symbol: "VXUS", label: "Vanguard Total International", aliases: ["total international", "total intl", "inst total intl", "international stock", "vxus", "vtiax", "vtsnx", "v016", "ex us", "ex-us"] },
  { symbol: "BND", label: "Vanguard Total Bond Market", aliases: ["total bond", "inst total bond", "bond market", "bond fund", "bnd", "vbtlx", "fxnax", "m089", "aggregate bond"] },
  { symbol: "DFAT", label: "DFA Targeted Value", aliases: ["dfa targeted value", "dfa target value", "targeted value", "dfat", "dtvlx", "dimensional targeted value"] },
  { symbol: "VMFXX", label: "Vanguard Money Market / Stable Value", aliases: ["retirement savings trust", "stable value", "money market", "vmfxx", "spaxx", "cash fund", "savings trust"] },
  { symbol: "VTI", label: "Vanguard Total Stock Market", aliases: ["total stock market", "total market", "vti", "vtsax"] },
  { symbol: "SPY", label: "SPDR S&P 500", aliases: ["spy", "spdr"] },
  { symbol: "QQQ", label: "Invesco QQQ", aliases: ["qqq", "nasdaq 100", "nasdaq100"] },
  { symbol: "GLD", label: "SPDR Gold", aliases: ["gold", "gld", "gold etf"] },
  { symbol: "TIP", label: "iShares TIPS", aliases: ["tips", "tip", "inflation protected", "inflation-protected"] },
  { symbol: "TLT", label: "iShares 20+ Year Treasury", aliases: ["long treasury", "tlt", "20 year treasury"] },
  { symbol: "AAPL", label: "Apple", aliases: ["apple", "aapl"] },
  { symbol: "MSFT", label: "Microsoft", aliases: ["microsoft", "msft"] },
  { symbol: "NVDA", label: "NVIDIA", aliases: ["nvidia", "nvda"] },
  { symbol: "AGG", label: "iShares Core US Aggregate Bond", aliases: ["agg", "ishares bond", "core aggregate"] },
  { symbol: "VFIFX", label: "Vanguard Target 2050", aliases: ["target 2050", "target retirement 2050", "vfifx"] },
  { symbol: "VBIAX", label: "Vanguard Balanced Index", aliases: ["balanced index", "vbiax", "balanced fund"] },
];

export const FUND_LABELS: Record<string, string> = Object.fromEntries(
  FUND_REGISTRY.flatMap((f) => [[f.symbol, f.label]]),
);

export function getAllAliasEntries(): { symbol: string; alias: string; label: string }[] {
  return FUND_REGISTRY.flatMap((f) =>
    f.aliases.map((alias) => ({ symbol: f.symbol, alias: alias.toLowerCase(), label: f.label })),
  );
}
