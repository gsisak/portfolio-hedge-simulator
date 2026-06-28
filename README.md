# Portfolio Hedge Simulator

Stress-test your portfolio against macro and thematic risks: high inflation, market crashes, AI bubble deflation, stagflation, and OpenAI/ChatGPT failure scenarios.

**Educational tool only — not investment advice.**

## Features

- **Fund-aware shocks** — each holding analyzed by asset mix (equities, bonds, TIPS, gold, etc.); bond funds don't take full equity crash hits
- **Multi-year forecast** — 1, 3, 5, or 10-year compound paths (crash → recovery → growth)
- **Portfolio mix analysis** — see your weighted exposure before running scenarios
- **Live prices** — Fetches current quotes via Yahoo Finance
- **Short interest screener** — Top 50 most-shorted stocks (seed data)

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/simulate` | POST | Run portfolio simulation |
| `/api/simulate` | GET | List available scenarios |
| `/api/shorts` | GET | Top shorted stocks (`?limit=50&sector=Technology`) |
| `/api/quotes` | GET | Live quotes (`?symbols=AAPL,MSFT`) |

### Example: simulate

```bash
curl -X POST http://localhost:3000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "holdings": [{"symbol": "AAPL", "shares": 50}, {"symbol": "NVDA", "shares": 20}],
    "cash": 10000,
    "fetchPrices": true
  }'
```

## Scenarios

| ID | Scenario |
|----|----------|
| `inflation_spike` | High inflation (+6% CPI, 12 months) |
| `market_crash` | S&P -30% crash |
| `ai_bust` | AI bubble deflates (-40% AI basket) |
| `stagflation` | Inflation up, growth down |
| `openai_indirect` | OpenAI/ChatGPT failure (indirect via MSFT, NVDA) |

## Monetization path

- **Freemium SaaS** — basic sim free, Pro for Monte Carlo + FINRA live data + PDF reports
- **API tier** — sell aggregated short-interest + scenario signals to fintechs
- **Newsletter** — weekly hedge playbook tied to current macro regime

## Production upgrades

1. Replace seed short-interest with [FINRA Equity Short Interest API](https://www.finra.org/finra-data/browse-catalog/equity-short-interest/data)
2. Add Monte Carlo simulation (10k paths)
3. Historical backtest mode (2008, 2022 replay)
4. User accounts + saved portfolios (Supabase)
5. Stripe billing for Pro tier

## Disclaimer

This application provides educational simulations only. It does not constitute investment advice. Past scenarios do not guarantee future results. Consult a licensed financial advisor before making investment decisions.
