#!/usr/bin/env node
/**
 * degenscan-intel-mcp — stdio MCP server for the Degenscan Intel API.
 * Hyperliquid funding/carry across all dexes (HIP-3 included), event feed, oracle.
 * Config: DEGENSCAN_API_KEY, or DEGENSCAN_X402_EVM_KEY / DEGENSCAN_X402_SVM_KEY to pay per call in USDC.
 * Market data and analytics only — not a signal, not investment advice.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { IntelClient, PaymentRequiredError, IntelError, DISCLAIMER } from "degenscan-intel";

const intel = new IntelClient({
  apiKey: process.env.DEGENSCAN_API_KEY,
  freeTrial: process.env.DEGENSCAN_FREE_TRIAL === "1",
  baseUrl: process.env.DEGENSCAN_BASE_URL,
  userAgent: "degenscan-intel-mcp/0.1.0",
});

const server = new McpServer(
  { name: "degenscan-intel", version: "0.1.0" },
  {
    instructions:
      "Degenscan Intel: Hyperliquid funding & carry data for every dex (main + HIP-3: xyz, io, para, mkts), " +
      "stored hourly beyond Hyperliquid's 500 h window; cross-dex same-ticker spreads; spot×perp basis; " +
      "eligibility filter, capacity, realized carry, after-hours premium and alerts (Carry Desk); " +
      "plus an event feed, derivatives, Polymarket context and a forecast oracle. " +
      "HIP-3 coins use a dex prefix (xyz:NBIS). Carry routes need a dsi_carry_/dsi_carrydesk_ key or an x402 wallet " +
      "(US$0.01–0.05 per call). When a tool returns payment_required, tell the user the price and how to buy " +
      "(https://intel.degenscan.io/carry or keys_buy_carry_month). " + DISCLAIMER,
  },
);

type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

async function run(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const data = await fn();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  } catch (e) {
    if (e instanceof PaymentRequiredError) {
      const a = e.requirements?.accepts?.[0];
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "payment_required",
                message:
                  "No key covers this route and no x402 wallet is configured. Set DEGENSCAN_API_KEY " +
                  "(buy at https://intel.degenscan.io/carry: Carry Data US$100/mo, Carry Desk US$450/mo, " +
                  "prepaid packs US$5/40/300) or set DEGENSCAN_X402_EVM_KEY / DEGENSCAN_X402_SVM_KEY to pay per call in USDC.",
                price: a ? { amount: a.amount ?? a.maxAmountRequired, asset: a.asset, network: a.network } : undefined,
                requirements: e.requirements,
              },
              null,
              2,
            ),
          },
        ],
      };
    }
    if (e instanceof IntelError) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ error: e.message, status: e.status, body: e.body }) }] };
    }
    return { isError: true, content: [{ type: "text", text: JSON.stringify({ error: String((e as Error)?.message ?? e) }) }] };
  }
}

const ro = { readOnlyHint: true, openWorldHint: true } as const;

/* ------------------------------ Carry Oracle ------------------------------ */

server.registerTool("carry_stats", {
  title: "Carry dataset stats (free)",
  description: "Size of the Hyperliquid funding dataset (rows, coins, dexes, first/last hour), tiers and links. Free, no key.",
  inputSchema: {},
  annotations: ro,
}, () => run(() => intel.carry.stats()));

server.registerTool("carry_funding_matrix", {
  title: "Funding matrix (all perps, all dexes)",
  description: "Current annualized funding (fraction; 0.12 = 12 % a.a.) for all ~330 Hyperliquid perps on every dex, with OI, 24h volume and spot when it exists. Filter by dex or minimum volume. Carry Data key or x402 (US$0.03).",
  inputSchema: { dex: z.string().optional().describe("main | xyz | io | para | mkts"), min_vol: z.number().optional().describe("minimum 24h volume in USD") },
  annotations: ro,
}, (a) => run(() => intel.carry.fundingMatrix(a)));

server.registerTool("carry_xdex", {
  title: "Cross-dex spreads (same ticker on 2+ HIP-3 dexes)",
  description: "Same asset listed on two or more Hyperliquid dexes (e.g. xyz:NBIS vs io:NBIS): funding spread now and 14d, share of positive hours, basis between books, liquidity of the thinner leg. Carry Data key or x402 (US$0.05).",
  inputSchema: { min_vol: z.number().optional(), limit: z.number().int().optional() },
  annotations: ro,
}, (a) => run(() => intel.carry.xdex(a)));

server.registerTool("carry_spot_perp", {
  title: "Spot × perp (main dex)",
  description: "Spot vs perp pairs on the main dex (PURR, PUMP, ETH, HYPE…): funding now and 14d, share of positive hours, perp/spot basis, liquidity of both legs. Carry Data key or x402 (US$0.03).",
  inputSchema: {},
  annotations: ro,
}, () => run(() => intel.carry.spotPerp()));

server.registerTool("carry_history", {
  title: "Hourly funding history for one coin",
  description: "Hour-by-hour funding, premium, mark, OI and volume since 2026-09-13 — beyond Hyperliquid's own 500 h. HIP-3 coins take a prefix: xyz:NBIS, io:SNDK, para:AVGO. Carry Data key or x402 (US$0.02).",
  inputSchema: { coin: z.string().describe("e.g. BTC, HYPE, xyz:TSLA, io:NBIS"), hours: z.number().int().optional().describe("how many most-recent hours (default all)") },
  annotations: ro,
}, ({ coin, hours }) => run(() => intel.carry.history(coin, { hours })));

server.registerTool("carry_naked", {
  title: "Funding extremes with no hedge",
  description: "Perps with |annualized funding| above a threshold (default 0.5 = 50 % a.a.) that have NO hedge leg on Hyperliquid (no spot, no same ticker on another dex). Raw observation, not a trade. Carry Data key or x402 (US$0.01).",
  inputSchema: { min_abs_apr: z.number().optional().describe("fraction, default 0.5") },
  annotations: ro,
}, (a) => run(() => intel.carry.naked(a)));

server.registerTool("carry_watchdog", {
  title: "Market health per dex and market",
  description: "Per dex: markets, active/zero-OI/delisted counts, OI, volume, risk flags. Per market: status, growth mode, max leverage, 7-day OI/volume change, risk flags. Carry Data key or x402 (US$0.01).",
  inputSchema: {},
  annotations: ro,
}, () => run(() => intel.carry.watchdog()));

/* Carry Desk */

server.registerTool("carry_eligible", {
  title: "Eligibility filter (Carry Desk)",
  description: "For every xdex and spot×perp pair, each rule with measured value, threshold and pass/fail: spread 14d ≥ entry_apr, ≥65 % positive hours, 1h correlation ≥ min_corr (xdex), basis range ≤ 4 %, liquidity ≥ US$1M, fee break-even ≤ 7 days; plus eligible, score, rank, since. A filter and statistics, not an entry signal. Requires a dsi_carrydesk_ key.",
  inputSchema: {
    entry_apr: z.number().optional().describe("fraction, default 0.10"),
    min_corr: z.number().optional().describe("default 0.90"),
    fee_bps: z.number().optional().describe("taker fee per fill in bps, default 4.5"),
    only: z.enum(["eligible"]).optional(),
  },
  annotations: ro,
}, (a) => run(() => intel.carry.eligible(a)));

server.registerTool("carry_capacity", {
  title: "How much capital fits per pair (Carry Desk)",
  description: "Per leg: min(1 % of 24h volume, 25 % of book depth within 20 bps on the side you hit, 5 % of OI); margin at 1/2/3/5x. With capital/lev/max_pairs: ranked allocation and unallocated_by_liquidity_usd — what does NOT fit. Requires a dsi_carrydesk_ key.",
  inputSchema: { capital: z.number().optional(), lev: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5)]).optional(), max_pairs: z.number().int().optional() },
  annotations: ro,
}, (a) => run(() => intel.carry.capacity(a)));

server.registerTool("carry_realized", {
  title: "Net realized carry 7/14/30d (Carry Desk)",
  description: "What a delta-neutral pair would have earned over 168/336/720 h: funding received minus four taker fees minus basis drift, in % of notional and % of margin at 3x, with max adverse basis. Past performance; no guarantee. Requires a dsi_carrydesk_ key.",
  inputSchema: { pair_key: z.string().optional().describe("omit for all pairs") },
  annotations: ro,
}, ({ pair_key }) => run(() => intel.carry.realized(pair_key)));

server.registerTool("carry_afterhours", {
  title: "After-hours premium of US equities on HIP-3 (Carry Desk)",
  description: "US stocks/ETFs listed on HIP-3 dexes vs the last NYSE regular-session close: reference, premium now, hourly premium series since the close, funding in the window (NYSE calendar, holidays included). Requires a dsi_carrydesk_ key.",
  inputSchema: { coin: z.string().optional().describe("e.g. xyz:AMZN; omit for all") },
  annotations: ro,
}, ({ coin }) => run(() => intel.carry.afterhours(coin)));

server.registerTool("carry_alert_create", {
  title: "Create a webhook alert (Carry Desk)",
  description: "Evaluated after each hourly snapshot. Types: eligible_on, eligible_off, naked_extreme (needs min_abs_apr), watchdog_flag, afterhours_premium (needs min_abs_premium_pct). Webhooks are signed: X-Carry-Signature = hex HMAC-SHA256(secret, body). Up to 50 per key.",
  inputSchema: {
    type: z.enum(["eligible_on", "eligible_off", "naked_extreme", "watchdog_flag", "afterhours_premium"]),
    target: z.string().url().describe("HTTPS webhook URL"),
    pair: z.string().optional(), coin: z.string().optional(), dex: z.string().optional(),
    min_abs_apr: z.number().optional(), min_abs_premium_pct: z.number().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
}, ({ type, target, ...filter }) => run(() => intel.carry.alerts.create({ type, channel: "webhook", target, filter })));

server.registerTool("carry_alert_list", { title: "List alerts (Carry Desk)", description: "List configured webhook alerts.", inputSchema: {}, annotations: ro }, () => run(() => intel.carry.alerts.list()));
server.registerTool("carry_alert_delete", { title: "Delete an alert (Carry Desk)", description: "Delete a webhook alert by id.", inputSchema: { id: z.string() }, annotations: { destructiveHint: true } }, ({ id }) => run(() => intel.carry.alerts.delete(id)));

/* ------------------------------- Event feed ------------------------------- */

server.registerTool("intel_events", {
  title: "Market event feed",
  description: "Events from ~40 primary sources (SEC, Fed, ECB, US agencies, USGS, Polymarket, Hyperliquid, DefiLlama…) scored per asset. US$0.005 or free trial (100/day/IP).",
  inputSchema: { since: z.string().optional().describe("e.g. 4h, 24h, 7d"), universe: z.string().optional().describe("comma-separated, e.g. NVDA,BTC"), kinds: z.string().optional(), min_severity: z.number().optional(), min_confidence: z.number().optional(), q: z.string().optional(), limit: z.number().int().optional() },
  annotations: ro,
}, (a) => run(() => intel.intel.events(a)));

server.registerTool("intel_brief", { title: "Pre-trade brief for an asset", description: "Pressure, headlines, filings, exposure graph, Polymarket, calendar for one asset. US$0.10.", inputSchema: { asset: z.string(), since: z.string().optional() }, annotations: ro }, ({ asset, since }) => run(() => intel.intel.brief(asset, { since })));
server.registerTool("intel_impact", { title: "Net directional pressure for an asset", description: "US$0.003.", inputSchema: { asset: z.string(), since: z.string().optional() }, annotations: ro }, ({ asset, since }) => run(() => intel.intel.impact(asset, { since })));
server.registerTool("intel_regime", { title: "Market regime snapshot", description: "Venues, 24h pressure ranking, top events, prediction markets. US$0.01.", inputSchema: {}, annotations: ro }, () => run(() => intel.intel.regime()));
server.registerTool("intel_derivs", { title: "Perp microstructure for a symbol", description: "Hyperliquid OI, funding, basis and event pressure. US$0.003.", inputSchema: { symbol: z.string(), since: z.string().optional() }, annotations: ro }, ({ symbol, since }) => run(() => intel.intel.derivs(symbol, { since })));
server.registerTool("intel_price", { title: "Price", description: "Mark/mid + Coinbase spot, 24h change, basis, funding. US$0.001.", inputSchema: { symbol: z.string() }, annotations: ro }, ({ symbol }) => run(() => intel.intel.price(symbol)));
server.registerTool("intel_polymarket_top", { title: "Most active Polymarket markets", description: "US$0.002.", inputSchema: { sort: z.enum(["volume_24h", "liquidity", "change_24h"]).optional(), limit: z.number().int().optional(), tag: z.string().optional() }, annotations: ro }, (a) => run(() => intel.intel.polymarketTop(a)));
server.registerTool("intel_polymarket", { title: "Polymarket market context", description: "Odds plus relevant events for one market. US$0.01.", inputSchema: { market: z.string(), since: z.string().optional(), limit: z.number().int().optional() }, annotations: ro }, ({ market, ...q }) => run(() => intel.intel.polymarket(market, q)));
server.registerTool("intel_news", { title: "Headlines with tier and sentiment", description: "US$0.002.", inputSchema: { ticker: z.string(), since: z.string().optional(), limit: z.number().int().optional() }, annotations: ro }, ({ ticker, ...q }) => run(() => intel.intel.news(ticker, q)));
server.registerTool("intel_filings", { title: "SEC EDGAR filings", description: "8-K, Form 4, 13D/G, S-1. US$0.002.", inputSchema: { ticker: z.string(), since: z.string().optional(), forms: z.string().optional() }, annotations: ro }, ({ ticker, ...q }) => run(() => intel.intel.filings(ticker, q)));
server.registerTool("intel_calendar", { title: "Macro/earnings calendar", description: "Macro prints, FOMC, auctions, earnings. US$0.002.", inputSchema: { days: z.number().int().optional(), types: z.string().optional(), universe: z.string().optional() }, annotations: ro }, (a) => run(() => intel.intel.calendar(a)));
server.registerTool("intel_whales", { title: "Large stablecoin transfers", description: "USDC/USDT transfers ≥ min_usd on Base/Ethereum. US$0.002.", inputSchema: { min_usd: z.number().optional(), chains: z.string().optional(), limit: z.number().int().optional() }, annotations: ro }, (a) => run(() => intel.intel.whales(a)));

/* --------------------------------- Oracle --------------------------------- */

server.registerTool("oracle_forecast", {
  title: "Ask the forecast oracle (yes/no question)",
  description: "Calibrated probability with base rate, Polymarket odds, drivers and live-verified facts; the forecast is hashed before resolution and the scoreboard is public. Refuses (no charge) when a key fact cannot be verified. US$0.25. Takes 1–5 minutes; this tool waits.",
  inputSchema: { question: z.string(), resolves_at: z.string().optional().describe("ISO datetime"), context: z.string().optional(), method: z.enum(["social_sim", "expert_panel", "hybrid"]).optional() },
  annotations: ro,
}, (a) => run(() => intel.oracle.forecastAndWait(a)));
server.registerTool("oracle_board", { title: "Oracle board", description: "Daily cached forecasts: probability, base rate, market odds, edge. US$0.002.", inputSchema: {}, annotations: ro }, () => run(() => intel.oracle.board()));
server.registerTool("oracle_edge", { title: "Where the oracle disagrees most with Polymarket", description: "US$0.002.", inputSchema: { min_abs: z.number().optional(), limit: z.number().int().optional() }, annotations: ro }, (a) => run(() => intel.oracle.edge(a)));
server.registerTool("oracle_track_record", { title: "Public track record (free)", description: "Brier score vs market, by domain. Free.", inputSchema: {}, annotations: ro }, () => run(() => intel.oracle.trackRecord()));

/* ---------------------------------- Keys ---------------------------------- */

server.registerTool("intel_br_premium", { title: "Crypto-dollar premium in Brazil", description: "USDT/USDC-BRL vs BCB PTAX and BTC-BRL vs global BTC. US$0.002.", inputSchema: {}, annotations: ro }, () => run(() => intel.intel.brPremium()));
server.registerTool("intel_stablecoins", { title: "Stablecoin supply", description: "Supply and 1d/7d/30d net change per stablecoin and total; depegs. US$0.002.", inputSchema: {}, annotations: ro }, () => run(() => intel.intel.stablecoins()));
server.registerTool("intel_treasury_auctions", { title: "U.S. Treasury auctions", description: "Recent results (high yield, bid-to-cover, bidder split) and upcoming auctions with size. US$0.003.", inputSchema: {}, annotations: ro }, () => run(() => intel.intel.treasuryAuctions()));
server.registerTool("intel_defi_yields", { title: "Stablecoin DeFi yields", description: "Pools above a TVL floor: APY, 30d mean, reward-token share, outlier flag. Not a risk rating. US$0.003.", inputSchema: { min_tvl: z.number().optional(), include_extreme: z.boolean().optional(), limit: z.number().int().optional() }, annotations: ro }, (a) => run(() => intel.intel.defiYields(a)));

server.registerTool("keys_trial", {
  title: "Get a free trial key (200 calls, 7 days)",
  description: "No card, no account. Returns a dsi_trial_ key valid for Carry Data routes and the event feed (not the oracle, not Carry Desk). Save it and set DEGENSCAN_API_KEY. One per e-mail.",
  inputSchema: { email: z.string() }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
}, ({ email }) => run(() => intel.keys.trial(email)));
server.registerTool("keys_me", { title: "Key status", description: "Remaining credits / tier / expiry of the configured key. Free.", inputSchema: {}, annotations: ro }, () => run(() => intel.keys.me()));
server.registerTool("keys_buy_carry_month", {
  title: "Buy 30 days of Carry Data (100 USDC via x402)",
  description: "Pays 100 USDC from the configured x402 wallet and returns a dsi_carry_ key (shown once — save it, then set DEGENSCAN_API_KEY). Unlimited calls for 30 days.",
  inputSchema: {}, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
}, () => run(() => intel.keys.buyCarryMonth()));
server.registerTool("keys_buy_carry_desk_month", {
  title: "Buy 30 days of Carry Desk (450 USDC via x402)",
  description: "Pays 450 USDC and returns a dsi_carrydesk_ key (25 seats per wave; refused before charging when full).",
  inputSchema: {}, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
}, () => run(() => intel.keys.buyCarryDeskMonth()));
server.registerTool("keys_buy_pack", {
  title: "Buy prepaid credits (x402)",
  description: "pack_1k = US$5 (1,000 credits), pack_10k = US$40, pack_100k = US$300. 1 credit per feed call, 125 per oracle question, 10–50 per carry call.",
  inputSchema: { pack: z.enum(["pack_1k", "pack_10k", "pack_100k"]) }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
}, ({ pack }) => run(() => intel.keys.buyPack(pack)));

const transport = new StdioServerTransport();
await server.connect(transport);
