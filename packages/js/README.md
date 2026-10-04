# degenscan-intel

Official JavaScript/TypeScript client for the **Degenscan Intel API** — Hyperliquid funding and carry data across **every dex (HIP-3 included)**, kept hourly beyond Hyperliquid's 500-hour window, plus an event feed, derivatives, Polymarket context and a calibrated forecast oracle.

Pay **per call in USDC via x402** (no account), or use an **API key** (prepaid pack, Carry Data US$100/month, Carry Desk US$450/month).

> Market data and analytics only — not a signal, not investment advice.

```bash
npm install degenscan-intel
# optional, only if you want to pay per call with a wallet:
npm install @x402/fetch @x402/evm viem          # Base (USDC)
npm install @x402/fetch @x402/svm @solana/kit @scure/base   # Solana (USDC)
```

## 30-second start

```ts
import { IntelClient } from "degenscan-intel";

// 1) With a key (Carry Data / Carry Desk / prepaid pack)
const intel = new IntelClient({ apiKey: process.env.DEGENSCAN_API_KEY });

const xdex = await intel.carry.xdex({ min_vol: 1_000_000 });
for (const p of xdex.items) {
  console.log(p.base, (p.spread_apr_14d * 100).toFixed(1) + "% a.a. 14d", p.legs.map(l => l.coin));
}

// 2) Or pay per call in USDC (Base) — no account, no key
const agent = new IntelClient({ x402: { evmPrivateKey: process.env.EVM_PRIVATE_KEY } });
const naked = await agent.carry.naked({ min_abs_apr: 1 });   // US$0.01 per call
```

## What you can call

| Group | Methods | Access |
|---|---|---|
| `carry` | `stats()` (free), `fundingMatrix()`, `xdex()`, `spotPerp()`, `history(coin)`, `naked()`, `watchdog()` | key `dsi_carry_…` / `dsi_carrydesk_…`, or x402 per call (US$0.01–0.05) |
| `carry` (Desk) | `eligible()`, `capacity({capital, lev, max_pairs})`, `realized(pair?)`, `afterhours(coin?)`, `alerts.create/list/delete` | key `dsi_carrydesk_…` |
| `intel` | `events()`, `impact()`, `graph()`, `regime()`, `explain()`, `polymarket()`, `polymarketTop()`, `price()`, `fundingAlerts()`, `whales()`, `derivs()`, `news()`, `filings()`, `calendar()`, `brief()` | prepaid key, x402 per call (US$0.001–0.10), or `freeTrial: true` (100 calls/day/IP) |
| `oracle` | `forecast()`, `status(id)`, `forecastAndWait()`, `board()`, `edge()`, `trackRecord()` (free) | prepaid key or x402 (US$0.25 per question) |
| `keys` | `me()`, `buyCarryMonth()` (100 USDC = 30 days), `buyCarryDeskMonth()` (450 USDC), `buyPack("pack_1k"\|"pack_10k"\|"pack_100k")` | x402 wallet |

Every route is documented with real responses at **https://intel.degenscan.io/docs/carry** and in `/openapi.json`. Unknown routes: `intel.request("GET", "/v1/...", { query })`.

### HIP-3 coins

Coins on builder-deployed dexes carry a prefix: `xyz:NBIS`, `io:NBIS`, `para:AVGO`, `mkts:US500`. Main-dex coins have none (`BTC`, `HYPE`).

### Errors

- `PaymentRequiredError` (HTTP 402): no key covers the route and no wallet is configured. `err.requirements.accepts[0]` tells you price, asset and network, so an agent can decide to pay.
- `IntelError`: any other non-2xx, with `status` and parsed `body`.

### Environment variables

`DEGENSCAN_API_KEY`, `DEGENSCAN_X402_EVM_KEY` (0x… private key, Base), `DEGENSCAN_X402_SVM_KEY` (base58, Solana). Constructor options override them.

### Buying access from code (agents)

```ts
const wallet = new IntelClient({ x402: { evmPrivateKey: process.env.EVM_PRIVATE_KEY } });
const key = await wallet.keys.buyCarryMonth();   // pays 100 USDC, returns { key: "dsi_carry_…" }
// store key.key — it is shown once. Then:
const intel = new IntelClient({ apiKey: key.key });
```

### Webhook alerts (Carry Desk)

```ts
await intel.carry.alerts.create({ type: "eligible_on", channel: "webhook", target: "https://your.app/hook" });
// payloads are signed: X-Carry-Signature = hex HMAC-SHA256(secret, raw body)
```

## MCP

Prefer tools over code? `npx degenscan-intel-mcp` (stdio) or the hosted server `https://intel.degenscan.io/mcp`.

## Links

Pricing https://intel.degenscan.io/carry · Docs https://intel.degenscan.io/docs/carry · Method https://intel.degenscan.io/docs/carry#method · llms.txt https://intel.degenscan.io/llms.txt · Operator: Marbella Collins LLC · contact@degenscan.io

*Market data and analytics only — not a signal, not investment advice.*
