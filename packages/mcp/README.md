# degenscan-intel-mcp

MCP server for the **Degenscan Intel API**: Hyperliquid funding and carry data for **every dex (HIP-3 included)**, stored hourly beyond Hyperliquid's 500-hour window; cross-dex same-ticker spreads; spot×perp basis; eligibility filter, per-pair capacity, net realized carry, after-hours premium and webhook alerts (Carry Desk); plus an event feed, derivatives, Polymarket context and a calibrated forecast oracle.

Works in Claude Desktop, Claude Code, Cursor, Windsurf, Cline, Zed and any MCP client. Pay **per call in USDC via x402** or use an **API key**.

> Market data and analytics only — not a signal, not investment advice.

## Free trial key

Ask the assistant to call the `keys_trial` tool with your e-mail: it returns a `dsi_trial_` key (200 calls, 7 days, no card). Put it in `DEGENSCAN_API_KEY`. Or get it on https://intel.degenscan.io/carry.

## Install

```bash
npx -y degenscan-intel-mcp
```

### Claude Desktop / Claude Code / Cursor (`mcp.json` or `claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "degenscan-intel": {
      "command": "npx",
      "args": ["-y", "degenscan-intel-mcp"],
      "env": { "DEGENSCAN_API_KEY": "dsi_carry_..." }
    }
  }
}
```

Pay per call instead of a key (Base USDC):

```json
"env": { "DEGENSCAN_X402_EVM_KEY": "0x..." }
```

Solana USDC: `"DEGENSCAN_X402_SVM_KEY": "<base58 secret>"`. Free trial on the event feed (not carry, not oracle): `"DEGENSCAN_FREE_TRIAL": "1"`.

Prefer a hosted server? The same tools are served at `https://intel.degenscan.io/mcp` (streamable HTTP).

## Tools

New in 0.2.0: `keys_trial`, `intel_br_premium`, `intel_stablecoins`, `intel_treasury_auctions`, `intel_defi_yields`.

| Tool | What it returns | Access |
|---|---|---|
| `carry_stats` | dataset size, tiers, links | free |
| `carry_funding_matrix` | annualized funding for ~330 perps on all dexes, OI, volume, spot | Carry Data key or US$0.03 |
| `carry_xdex` | same ticker on 2+ HIP-3 dexes: spread now/14d, basis, liquidity | Carry Data key or US$0.05 |
| `carry_spot_perp` | spot × perp pairs on the main dex | Carry Data key or US$0.03 |
| `carry_history` | hourly series for one coin since 2026-09-13 (`xyz:NBIS` style prefixes) | Carry Data key or US$0.02 |
| `carry_naked` | funding extremes with no hedge leg | Carry Data key or US$0.01 |
| `carry_watchdog` | market health per dex/market, risk flags | Carry Data key or US$0.01 |
| `carry_eligible` | eligibility filter, every rule auditable, thresholds overridable | Carry Desk key |
| `carry_capacity` | how much capital fits per pair, what is left out | Carry Desk key |
| `carry_realized` | net realized carry 7/14/30d after fees and basis drift | Carry Desk key |
| `carry_afterhours` | US equities on HIP-3 vs last NYSE close | Carry Desk key |
| `carry_alert_create/list/delete` | HMAC-signed webhook alerts | Carry Desk key |
| `intel_events`, `intel_brief`, `intel_impact`, `intel_regime`, `intel_derivs`, `intel_price`, `intel_polymarket*`, `intel_news`, `intel_filings`, `intel_calendar`, `intel_whales` | event feed and context | prepaid key, x402 (US$0.001–0.10) or free trial |
| `oracle_forecast`, `oracle_board`, `oracle_edge`, `oracle_track_record` | calibrated yes/no forecasts, public scoreboard | prepaid key or x402 (US$0.25/question) |
| `keys_me`, `keys_buy_carry_month`, `keys_buy_carry_desk_month`, `keys_buy_pack` | key status; buy access from a wallet | x402 wallet |

When a tool needs payment and nothing is configured, it returns `payment_required` with the price, asset and network, so the agent (or you) can decide.

## Pricing

Carry Data **US$100/month** (or 100 USDC = 30 days) · Carry Desk **US$450/month** or US$4,500/year, 25 seats · prepaid packs US$5 / 40 / 300 · per call US$0.001–0.25. Card or USDC on Base/Solana. https://intel.degenscan.io/carry

Docs with real responses: https://intel.degenscan.io/docs/carry · Method: https://intel.degenscan.io/docs/carry#method · Operator: Marbella Collins LLC · contact@degenscan.io

*Market data and analytics only — not a signal, not investment advice.*
