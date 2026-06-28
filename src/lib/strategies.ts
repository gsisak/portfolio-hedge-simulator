import type { ExposureBucket } from "./types";

export type StrategyId =
  | "buy_and_hold"
  | "annual_rebalance"
  | "defensive_rotation"
  | "dca_equity"
  | "income_reinvest";

export interface InvestmentStrategy {
  id: StrategyId;
  name: string;
  description: string;
  /** Target bucket weights for rebalance strategy (sum ~1) */
  targetMix?: Partial<Record<ExposureBucket, number>>;
  /** Monthly $ contribution for DCA */
  monthlyContribution?: number;
}

export const INVESTMENT_STRATEGIES: InvestmentStrategy[] = [
  {
    id: "buy_and_hold",
    name: "Buy & Hold",
    description: "No changes during the forecast — pure scenario impact.",
  },
  {
    id: "annual_rebalance",
    name: "Annual Rebalance (60/40)",
    description:
      "At the start of each year, rebalance to 60% stocks / 40% bonds+cash.",
    targetMix: {
      us_equity: 0.45,
      intl_equity: 0.15,
      investment_grade_bond: 0.3,
      cash: 0.1,
    },
  },
  {
    id: "defensive_rotation",
    name: "Defensive Rotation",
    description:
      "After a down year (>10%), shift 10% of equity value into bonds before the next year.",
  },
  {
    id: "dca_equity",
    name: "DCA into Equities",
    description: "Add $500/month split across equity holdings throughout the forecast.",
    monthlyContribution: 500,
  },
  {
    id: "income_reinvest",
    name: "Reinvest Income",
    description:
      "Bond/dividend income (~3%/yr on bond portion) reinvested into the portfolio each year.",
  },
];

export function getStrategy(id: StrategyId): InvestmentStrategy {
  return INVESTMENT_STRATEGIES.find((s) => s.id === id) ?? INVESTMENT_STRATEGIES[0];
}
