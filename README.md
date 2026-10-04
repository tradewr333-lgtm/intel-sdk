# Degenscan Intel SDK

Official clients and tools for the **Degenscan Intel API** (https://intel.degenscan.io): Hyperliquid funding & carry data across **every dex (HIP-3 included)**, stored hourly beyond Hyperliquid's 500-hour window; cross-dex same-ticker spreads; spot×perp basis; eligibility filter, per-pair capacity, net realized carry, after-hours premium and webhook alerts (Carry Desk); plus an event feed, derivatives, Polymarket context and a calibrated forecast oracle.

Pay **per call in USDC via x402** (Base or Solana, no account) or use an **API key**.

| Package | Install | What |
|---|---|---|
| [`degenscan-intel`](packages/js) (npm) | `npm i degenscan-intel` | TypeScript/JS client, optional x402 autopay |
| [`degenscan-intel-mcp`](packages/mcp) (npm) | `npx -y degenscan-intel-mcp` | MCP server (stdio) for Claude, Cursor, Windsurf, Cline… |
| [`degenscan-intel`](packages/py) (PyPI) | `pip install degenscan-intel` | Python client (sync + async), optional x402 |
| [`bots/poster`](bots/poster) | — | Hourly data posts to X / Telegram |

Hosted MCP: `https://intel.degenscan.io/mcp` · Docs with real responses: https://intel.degenscan.io/docs/carry · Pricing: https://intel.degenscan.io/carry · `llms.txt`: https://intel.degenscan.io/llms.txt

Pricing: Carry Data **US$100/month** (100 USDC = 30 days) · Carry Desk **US$450/month** / US$4,500/year, 25 seats · prepaid packs US$5/40/300 · per call US$0.001–0.25.

Operator: Marbella Collins LLC · contact@degenscan.io · MIT license.

*Market data and analytics only — not a signal, not investment advice.*
