# degenscan-intel (Python)

Official Python client for the **Degenscan Intel API** — Hyperliquid funding and carry data across **every dex (HIP-3 included)**, stored hourly beyond Hyperliquid's 500-hour window; cross-dex same-ticker spreads; spot×perp basis; eligibility filter, per-pair capacity, net realized carry, after-hours premium and webhook alerts (Carry Desk); plus an event feed, derivatives, Polymarket context and a calibrated forecast oracle.

Pay **per call in USDC via x402** (no account) or use an **API key**.

> Market data and analytics only — not a signal, not investment advice.

```bash
pip install degenscan-intel
pip install "degenscan-intel[x402-evm]"   # optional: pay per call with a Base wallet
pip install "degenscan-intel[x402-svm]"   # optional: Solana wallet
```

## 30-second start

```python
from degenscan_intel import IntelClient

intel = IntelClient(api_key="dsi_carry_...")          # or env DEGENSCAN_API_KEY

for p in intel.carry_xdex(min_vol=1_000_000)["items"]:
    print(p["base"], f'{p["spread_apr_14d"]*100:.1f}% a.a. (14d)', [l["coin"] for l in p["legs"]])

hist = intel.carry_history("xyz:NBIS", hours=24 * 14)   # HIP-3 coins carry a dex prefix
```

Pay per call in USDC from an agent (async client):

```python
import asyncio
from degenscan_intel import AsyncIntelClient

async def main():
    async with AsyncIntelClient(x402_evm_key="0x...") as intel:     # env DEGENSCAN_X402_EVM_KEY also works
        naked = await intel.carry_naked(min_abs_apr=1.0)             # US$0.01 per call
        key = await intel.buy_carry_month()                          # 100 USDC → 30 days unlimited; store key["key"]

asyncio.run(main())
```

## Methods

| Group | Methods | Access |
|---|---|---|
| Carry Data | `carry_stats()` (free), `carry_funding_matrix()`, `carry_xdex()`, `carry_spot_perp()`, `carry_history(coin)`, `carry_naked()`, `carry_watchdog()` | `dsi_carry_…` / `dsi_carrydesk_…` key, or x402 US$0.01–0.05 per call |
| Carry Desk | `carry_eligible()`, `carry_capacity(capital, lev, max_pairs)`, `carry_realized(pair)`, `carry_afterhours(coin)`, `carry_alert_create/list/delete` | `dsi_carrydesk_…` key |
| Feed | `events()`, `impact()`, `graph()`, `regime()`, `explain()`, `polymarket()`, `polymarket_top()`, `price()`, `funding_alerts()`, `whales()`, `derivs()`, `news()`, `filings()`, `calendar()`, `brief()` | prepaid key, x402 (US$0.001–0.10) or `free_trial=True` (100/day/IP) |
| Oracle | `oracle_forecast()`, `oracle_status(id)`, `oracle_forecast_and_wait()`, `oracle_board()`, `oracle_edge()`, `oracle_track_record()` (free) | prepaid key or x402 (US$0.25) |
| Keys | `keys_me()`, `buy_carry_month()`, `buy_carry_desk_month()`, `buy_pack("pack_1k"|"pack_10k"|"pack_100k")` | x402 wallet |

Errors: `PaymentRequiredError` (HTTP 402, `.requirements` has price/asset/network) and `IntelError` (`.status`, `.body`).

Real responses and method: https://intel.degenscan.io/docs/carry · Pricing: https://intel.degenscan.io/carry · MCP: `npx degenscan-intel-mcp` or `https://intel.degenscan.io/mcp` · Operator: Marbella Collins LLC · contact@degenscan.io

*Market data and analytics only — not a signal, not investment advice.*
