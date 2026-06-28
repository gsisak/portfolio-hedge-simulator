import { NextResponse } from "next/server";
import { analyzeHoldings } from "@/lib/fund-analyzer";
import { SCENARIOS, getScenario } from "@/lib/scenarios";
import { simulateAllScenarios, simulatePortfolio } from "@/lib/simulator";
import type { Portfolio } from "@/lib/types";

interface SimulateRequest {
  holdings: Array<{ symbol: string; shares: number }>;
  cash?: number;
  scenarioId?: string;
  fetchPrices?: boolean;
  forecastYears?: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SimulateRequest;

    if (!body.holdings?.length && !body.cash) {
      return NextResponse.json(
        { error: "Provide at least one holding or cash amount" },
        { status: 400 },
      );
    }

    const { holdings, priceMeta, analyses } = await analyzeHoldings(
      body.holdings ?? [],
      body.fetchPrices !== false,
    );

    const portfolio: Portfolio = {
      holdings,
      cash: body.cash ?? 0,
    };

    const forecastYears = Math.max(
      1,
      Math.min(body.forecastYears ?? 5, 10),
    );

    if (body.scenarioId) {
      const scenario = getScenario(body.scenarioId);
      if (!scenario) {
        return NextResponse.json(
          { error: `Unknown scenario: ${body.scenarioId}` },
          { status: 400 },
        );
      }
      const result = simulatePortfolio(portfolio, scenario, forecastYears);
      return NextResponse.json({ result, meta: { priceMeta, analyses, forecastYears } });
    }

    const results = simulateAllScenarios(portfolio, SCENARIOS, forecastYears);
    const portfolioValue = results[0]?.startValue ?? 0;
    const fallbackCount = priceMeta.filter((p) => !p.live).length;

    return NextResponse.json({
      results,
      scenarios: SCENARIOS,
      meta: {
        portfolioValue,
        cash: portfolio.cash,
        priceMeta,
        analyses,
        forecastYears,
        portfolioMix: results[0]?.portfolioMix ?? [],
        priceSource:
          fallbackCount > 0
            ? `Yahoo Finance (${fallbackCount} ticker(s) used $100 fallback)`
            : "Yahoo Finance (live)",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Simulation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ scenarios: SCENARIOS });
}
