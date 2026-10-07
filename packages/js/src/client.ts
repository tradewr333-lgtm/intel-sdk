import type {
  AfterhoursResponse,
  Alert,
  CapacityResponse,
  CarryStats,
  CreateAlertBody,
  EligibleResponse,
  ForecastRequest,
  ForecastResponse,
  FundingMatrixResponse,
  HistoryResponse,
  KeyInfo,
  NakedResponse,
  PaymentRequirements,
  RealizedResponse,
  SpotPerpResponse,
  WatchdogResponse,
  XdexResponse,
} from "./types.js";

export const DEFAULT_BASE_URL = "https://intel.degenscan.io";
export const DISCLAIMER =
  "Market data and analytics only — not a signal, not investment advice.";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Dynamic import by name so optional wallet libraries stay optional at build and run time. */
const dyn = (m: string): Promise<any> => import(/* webpackIgnore: true */ /* @vite-ignore */ m);

export interface X402Options {
  /** 0x-prefixed EVM private key. Pays USDC on Base (eip155:8453). */
  evmPrivateKey?: string;
  /** Base58 Solana private key (64-byte secret). Pays USDC on Solana. */
  svmPrivateKey?: string;
  /** Restrict to one network, e.g. "eip155:8453" or "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp". Default: all configured. */
  network?: string;
}

export interface IntelClientOptions {
  /** `dsi_…` key (prepaid pack, Carry Data `dsi_carry_…` or Carry Desk `dsi_carrydesk_…`). */
  apiKey?: string;
  /** Send `X-Free-Trial: 1` (100 calls/day/IP on the event feed; not oracle, not carry). */
  freeTrial?: boolean;
  /** Pay per call in USDC via x402 when no key covers the route. Requires @x402/fetch and @x402/evm or @x402/svm. */
  x402?: X402Options;
  baseUrl?: string;
  /** Custom fetch (tests, proxies). */
  fetch?: FetchLike;
  /** Request timeout in ms (default 30000; oracle forecasts use 120000). */
  timeoutMs?: number;
  userAgent?: string;
}

export class IntelError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly url: string;
  constructor(message: string, status: number, body: unknown, url: string) {
    super(message);
    this.name = "IntelError";
    this.status = status;
    this.body = body;
    this.url = url;
  }
}

/** Thrown on HTTP 402 when the client has no x402 wallet configured. `requirements` tells an agent the price. */
export class PaymentRequiredError extends IntelError {
  readonly requirements: PaymentRequirements | null;
  constructor(body: unknown, url: string) {
    const req = (body && typeof body === "object" ? (body as PaymentRequirements) : null) ?? null;
    const first = req?.accepts?.[0];
    const price = first?.amount ?? first?.maxAmountRequired;
    super(
      `Payment required for ${url}` +
        (price ? ` (${price} base units of ${first?.asset ?? "USDC"} on ${first?.network})` : "") +
        ". Pass an apiKey, or configure x402 to pay per call.",
      402,
      body,
      url,
    );
    this.name = "PaymentRequiredError";
    this.requirements = req;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

function qs(q?: Query): string {
  if (!q) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === "") continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export class IntelClient {
  readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly freeTrial: boolean;
  private readonly timeoutMs: number;
  private readonly userAgent: string;
  private readonly rawFetch: FetchLike;
  private readonly x402Opts?: X402Options;
  private payingFetch?: Promise<FetchLike>;

  constructor(opts: IntelClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.apiKey = opts.apiKey ?? process.env.DEGENSCAN_API_KEY ?? undefined;
    this.freeTrial = opts.freeTrial ?? false;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.userAgent = opts.userAgent ?? "degenscan-intel-js/0.1.0";
    this.rawFetch = opts.fetch ?? ((u, i) => globalThis.fetch(u, i));
    const env: X402Options = {
      evmPrivateKey: process.env.DEGENSCAN_X402_EVM_KEY,
      svmPrivateKey: process.env.DEGENSCAN_X402_SVM_KEY,
    };
    const merged = { ...env, ...(opts.x402 ?? {}) };
    this.x402Opts = merged.evmPrivateKey || merged.svmPrivateKey ? merged : undefined;
  }

  /** Lazily build an x402-paying fetch from optional peer dependencies. */
  private getPayingFetch(): Promise<FetchLike> {
    if (!this.x402Opts) return Promise.resolve(this.rawFetch);
    if (!this.payingFetch) {
      const o = this.x402Opts;
      this.payingFetch = (async () => {
        const schemes: Array<{ network: string; client: unknown }> = [];
        // Dynamic imports keep wallet libraries optional for key-only users.
        const fetchMod = (await dyn("@x402/fetch")) as {
          wrapFetchWithPaymentFromConfig: (f: FetchLike, cfg: { schemes: unknown[] }) => FetchLike;
        };
        if (o.evmPrivateKey) {
          const evm = (await dyn("@x402/evm")) as { ExactEvmScheme: new (acct: unknown) => unknown };
          const { privateKeyToAccount } = (await dyn("viem/accounts")) as {
            privateKeyToAccount: (k: `0x${string}`) => unknown;
          };
          const account = privateKeyToAccount(o.evmPrivateKey as `0x${string}`);
          schemes.push({ network: o.network?.startsWith("eip155") ? o.network : "eip155:*", client: new evm.ExactEvmScheme(account) });
        }
        if (o.svmPrivateKey) {
          const svm = (await dyn("@x402/svm")) as {
            toClientSvmSigner: (kp: unknown) => unknown;
          };
          const svmClient = (await dyn("@x402/svm/exact/client")) as {
            ExactSvmScheme: new (signer: unknown) => unknown;
          };
          const kit = (await dyn("@solana/kit")) as {
            createKeyPairSignerFromBytes: (b: Uint8Array) => Promise<unknown>;
          };
          const { base58 } = (await dyn("@scure/base")) as { base58: { decode: (s: string) => Uint8Array } };
          const kp = await kit.createKeyPairSignerFromBytes(base58.decode(o.svmPrivateKey));
          schemes.push({ network: o.network?.startsWith("solana") ? o.network : "solana:*", client: new svmClient.ExactSvmScheme(svm.toClientSvmSigner(kp)) });
        }
        return fetchMod.wrapFetchWithPaymentFromConfig(this.rawFetch, { schemes });
      })();
    }
    return this.payingFetch;
  }

  /** Low-level request. Public so new routes can be called before the SDK catches up. */
  async request<T = unknown>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    opts: { query?: Query; body?: unknown; timeoutMs?: number; pay?: boolean } = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}${qs(opts.query)}`;
    const headers: Record<string, string> = {
      accept: "application/json",
      "user-agent": this.userAgent,
    };
    if (this.apiKey) headers["x-api-key"] = this.apiKey;
    if (this.freeTrial) headers["x-free-trial"] = "1";
    if (opts.body !== undefined) headers["content-type"] = "application/json";

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? this.timeoutMs);
    try {
      const doFetch = opts.pay === false ? this.rawFetch : await this.getPayingFetch();
      const res = await doFetch(url, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: ctrl.signal,
      });
      const data = await parseBody(res);
      if (res.status === 402) throw new PaymentRequiredError(data, url);
      if (!res.ok) {
        const errField = data && typeof data === "object" && "error" in data ? (data as { error: unknown }).error : undefined;
        const msg = errField ? String(errField) : `HTTP ${res.status} for ${url}`;
        throw new IntelError(msg, res.status, data, url);
      }
      return data as T;
    } finally {
      clearTimeout(t);
    }
  }

  /* ------------------------------ Carry Oracle ------------------------------ */

  readonly carry = {
    /** Free. Dataset size, tiers, links. */
    stats: () => this.request<CarryStats>("GET", "/v1/carry/stats", { pay: false }),
    /** Current annualized funding for all perps on all dexes. */
    fundingMatrix: (q?: { dex?: string; min_vol?: number }) =>
      this.request<FundingMatrixResponse>("GET", "/v1/carry/funding-matrix", { query: q }),
    /** Same ticker on 2+ HIP-3 dexes: funding spread now/14d, basis, liquidity. */
    xdex: (q?: { min_vol?: number; limit?: number }) =>
      this.request<XdexResponse>("GET", "/v1/carry/xdex", { query: q }),
    /** Spot × perp on the main dex. */
    spotPerp: () => this.request<SpotPerpResponse>("GET", "/v1/carry/spot-perp"),
    /** Hourly series since 2026-09-13. HIP-3 coins carry a dex prefix, e.g. "xyz:NBIS". */
    history: (coin: string, q?: { hours?: number }) =>
      this.request<HistoryResponse>("GET", `/v1/carry/history/${encodeURIComponent(coin)}`, { query: q }),
    /** Funding extremes with no hedge leg on Hyperliquid. */
    naked: (q?: { min_abs_apr?: number }) =>
      this.request<NakedResponse>("GET", "/v1/carry/naked", { query: q }),
    /** Market health per dex and per market. */
    watchdog: () => this.request<WatchdogResponse>("GET", "/v1/carry/watchdog"),

    /* Carry Desk (dsi_carrydesk_ key) */
    /** Eligibility filter with every rule auditable; thresholds can be overridden. */
    eligible: (q?: { entry_apr?: number; min_corr?: number; fee_bps?: number; only?: "eligible" }) =>
      this.request<EligibleResponse>("GET", "/v1/carry/eligible", { query: q }),
    /** How much capital fits per pair (1 % vol, 25 % depth@20bps, 5 % OI) and what is left out. */
    capacity: (q?: { capital?: number; lev?: 1 | 2 | 3 | 5; max_pairs?: number }) =>
      this.request<CapacityResponse>("GET", "/v1/carry/capacity", { query: q }),
    /** Net realized carry over 168/336/720 h (past performance; no guarantee). */
    realized: (pairKey?: string) =>
      this.request<RealizedResponse>(
        "GET",
        pairKey ? `/v1/carry/realized/${encodeURIComponent(pairKey)}` : "/v1/carry/realized",
      ),
    /** Premium of US equities on HIP-3 dexes vs last NYSE regular-session close. */
    afterhours: (coin?: string) =>
      this.request<AfterhoursResponse>(
        "GET",
        coin ? `/v1/carry/afterhours/${encodeURIComponent(coin)}` : "/v1/carry/afterhours",
      ),
    /** Micro-routes (US$0.001–0.002, cached 60 s, Base + Solana): built for agent loops. */
    now: (coin: string) => this.request("GET", `/v1/carry/now/${encodeURIComponent(coin)}`),
    top: (q?: { n?: number }) => this.request("GET", "/v1/carry/top", { query: q }),
    spread: (base: string) => this.request("GET", `/v1/carry/spread/${encodeURIComponent(base)}`),
    alerts: {
      list: () => this.request<{ items: Alert[] } | Alert[]>("GET", "/v1/carry/alerts"),
      create: (body: CreateAlertBody) => this.request<Alert>("POST", "/v1/carry/alerts", { body }),
      delete: (id: string) => this.request<{ ok: boolean }>("DELETE", `/v1/carry/alerts/${encodeURIComponent(id)}`),
    },
  };

  /* ------------------------------- Event feed ------------------------------- */

  readonly intel = {
    pulse: () => this.request("GET", "/v1/pulse"),
    events: (q?: { since?: string; universe?: string; kinds?: string; min_severity?: number; min_confidence?: number; q?: string; limit?: number }) =>
      this.request("GET", "/v1/events", { query: q }),
    impact: (asset: string, q?: { since?: string }) => this.request("GET", `/v1/impact/${encodeURIComponent(asset)}`, { query: q }),
    graph: (asset: string, q?: { depth?: 1 | 2 | 3 }) => this.request("GET", `/v1/graph/${encodeURIComponent(asset)}`, { query: q }),
    regime: () => this.request("GET", "/v1/regime"),
    explain: (eventId: string) => this.request("GET", `/v1/explain/${encodeURIComponent(eventId)}`),
    polymarket: (market: string, q?: { since?: string; limit?: number }) =>
      this.request("GET", `/v1/polymarket/${encodeURIComponent(market)}`, { query: q }),
    polymarketTop: (q?: { sort?: "volume_24h" | "liquidity" | "change_24h"; limit?: number; tag?: string }) =>
      this.request("GET", "/v1/polymarket/top", { query: q }),
    price: (symbol: string) => this.request("GET", `/v1/price/${encodeURIComponent(symbol)}`),
    fundingAlerts: (q?: { min_abs_rate_1h?: number; limit?: number }) => this.request("GET", "/v1/funding/alerts", { query: q }),
    whales: (q?: { min_usd?: number; chains?: string; limit?: number }) => this.request("GET", "/v1/whales", { query: q }),
    derivs: (symbol: string, q?: { since?: string }) => this.request("GET", `/v1/derivs/${encodeURIComponent(symbol)}`, { query: q }),
    news: (ticker: string, q?: { since?: string; limit?: number }) => this.request("GET", `/v1/news/${encodeURIComponent(ticker)}`, { query: q }),
    filings: (ticker: string, q?: { since?: string; forms?: string }) => this.request("GET", `/v1/filings/${encodeURIComponent(ticker)}`, { query: q }),
    calendar: (q?: { days?: number; types?: string; universe?: string }) => this.request("GET", "/v1/calendar", { query: q }),
    brief: (asset: string, q?: { since?: string }) => this.request("GET", `/v1/brief/${encodeURIComponent(asset)}`, { query: q }),
    /** Crypto-dollar (USDT/USDC-BRL) and BTC premium in Brazil vs BCB PTAX. US$0.002. */
    brPremium: () => this.request("GET", "/v1/br/premium"),
    /** Stablecoin supply, 1d/7d/30d net change, depegs. US$0.002. */
    stablecoins: () => this.request("GET", "/v1/stablecoins"),
    /** U.S. Treasury auction results (high yield, bid-to-cover, bidder split) and upcoming auctions. US$0.003. */
    treasuryAuctions: () => this.request("GET", "/v1/treasury/auctions"),
    /** Stablecoin pool APYs above a TVL floor, 30d mean, reward share, outlier flag. US$0.003. */
    defiYields: (q?: { min_tvl?: number; include_extreme?: boolean; limit?: number }) => this.request("GET", "/v1/defi/yields", { query: q }),
    /** Micro-routes, US$0.001 each: active Hyperliquid markets per dex; PTAX + USDT/BRL premium; total stablecoin supply; next Treasury auctions. */
    hlMarkets: () => this.request("GET", "/v1/hl/markets"),
    brPtax: () => this.request("GET", "/v1/br/ptax"),
    stablecoinsTotal: () => this.request("GET", "/v1/stablecoins/total"),
    treasuryNext: () => this.request("GET", "/v1/treasury/next"),
    universe: () => this.request("GET", "/v1/universe", { pay: false }),
    sources: () => this.request("GET", "/v1/sources", { pay: false }),
  };

  /* --------------------------------- Oracle --------------------------------- */

  readonly oracle = {
    /** US$0.25. Async: poll `status(id)` until status is "done". Refuses (no charge) when a key fact cannot be verified. */
    forecast: (body: ForecastRequest) =>
      this.request<ForecastResponse>("POST", "/v1/oracle/forecast", { body, timeoutMs: 120_000 }),
    status: (id: string) => this.request<ForecastResponse>("GET", `/v1/oracle/forecast/${encodeURIComponent(id)}`, { pay: false }),
    board: () => this.request("GET", "/v1/oracle/board"),
    boardSlug: (slug: string) => this.request("GET", `/v1/oracle/board/${encodeURIComponent(slug)}`),
    edge: (q?: { min_abs?: number; limit?: number }) => this.request("GET", "/v1/oracle/edge", { query: q }),
    trackRecord: () => this.request("GET", "/v1/oracle/track-record", { pay: false }),
    /** Convenience: submit and poll until done/refused (default every 5 s, up to 6 min). */
    forecastAndWait: async (body: ForecastRequest, opts: { intervalMs?: number; maxMs?: number } = {}) => {
      const start = Date.now();
      let r = await this.oracle.forecast(body);
      const terminal = new Set(["done", "refused", "error", "failed"]);
      while (!terminal.has(r.status) && Date.now() - start < (opts.maxMs ?? 360_000)) {
        await new Promise((res) => setTimeout(res, opts.intervalMs ?? 5_000));
        r = await this.oracle.status(r.id);
      }
      return r;
    },
  };

  /* ---------------------------------- Keys ---------------------------------- */

  readonly keys = {
    /** Remaining budget / tier of the configured key. */
    me: () => this.request<KeyInfo>("GET", "/v1/keys/me", { pay: false }),
    /** Free trial key: 200 calls, 7 days, no card (Carry Data routes + event feed; not the oracle). 1 per e-mail. */
    trial: (email: string) => this.request<KeyInfo>("POST", "/v1/keys/trial", { body: { email }, pay: false }),
    /** 100 USDC = 30 days of Carry Data, unlimited. Needs x402 configured. Returns the new key: store it. */
    buyCarryMonth: () => this.request<KeyInfo>("POST", "/v1/keys/x402/carry_month"),
    /** 450 USDC = 30 days of Carry Desk (25 seats per wave). Needs x402 configured. */
    buyCarryDeskMonth: () => this.request<KeyInfo>("POST", "/v1/keys/x402/carry_desk_month"),
    /** Prepaid credits: pack_1k (US$5), pack_10k (US$40), pack_100k (US$300). Needs x402 configured. */
    buyPack: (pack: "pack_1k" | "pack_10k" | "pack_100k") => this.request<KeyInfo>("POST", `/v1/keys/x402/${pack}`),
  };
}

export function createClient(opts?: IntelClientOptions): IntelClient {
  return new IntelClient(opts);
}
