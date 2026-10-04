/** Shared types for the Degenscan Intel API (https://intel.degenscan.io). */

export type Dex = "main" | "xyz" | "io" | "para" | "mkts" | (string & {});

export interface Disclaimed {
  disclaimer?: string;
}

/* ----------------------------- Carry Oracle ----------------------------- */

export interface FundingMatrixItem {
  coin: string;
  dex: Dex;
  base: string;
  funding_1h: number;
  /** Annualized funding as a fraction (0.12 = 12 % a.a.). */
  funding_apr: number;
  mark: number | null;
  oi_usd: number | null;
  vol24_usd: number | null;
  spot: { pair: string; mark: number; vol24_usd?: number } | null;
}
export interface FundingMatrixResponse extends Disclaimed {
  as_of: string;
  count: number;
  items: FundingMatrixItem[];
}

export interface XdexLeg {
  coin: string;
  dex: Dex;
  funding_apr: number;
  funding_apr_14d: number;
  hours_positive_14d: number;
  hours_14d: number;
  vol24_usd: number;
  oi_usd: number;
  mark: number;
}
export interface XdexItem {
  base: string;
  legs: XdexLeg[];
  spread_apr_now: number;
  spread_apr_14d: number;
  basis_pct: number;
  min_leg_vol24_usd: number;
  [k: string]: unknown;
}
export interface XdexResponse extends Disclaimed {
  as_of: string;
  delay_h?: number;
  count: number;
  items: XdexItem[];
}

export interface SpotPerpItem {
  base: string;
  perp: string;
  funding_apr: number;
  funding_apr_14d: number;
  hours_positive_14d: number;
  hours_14d: number;
  perp_mark: number;
  spot_mark: number;
  spot_pair: string;
  basis_pct: number;
  perp_vol24_usd: number;
  spot_vol24_usd: number;
  oi_usd: number;
}
export interface SpotPerpResponse extends Disclaimed {
  as_of: string;
  count: number;
  items: SpotPerpItem[];
}

export interface HistoryPoint {
  at: string;
  funding_1h: number;
  funding_apr: number;
  premium: number | null;
  mark: number | null;
  oi_usd: number | null;
  vol24_usd: number | null;
  src: "history" | "snapshot" | (string & {});
}
export interface HistoryResponse {
  coin: string;
  dex: Dex;
  base: string;
  hours: number;
  items: HistoryPoint[];
}

export interface NakedItem {
  coin: string;
  dex: Dex;
  funding_apr_now: number;
  funding_apr_14d: number;
  hours_above_threshold_14d: number;
  hours_14d: number;
  oi_usd: number;
  vol24h_usd: number;
  why_no_hedge: "no_spot" | "no_xdex_pair" | "no_spot_no_xdex_pair" | (string & {});
}
export interface NakedResponse extends Disclaimed {
  as_of: string;
  threshold_apr: number;
  count: number;
  items: NakedItem[];
}

export interface WatchdogDex {
  dex: Dex;
  markets: number;
  active: number;
  zero_oi: number;
  delisted: number;
  oi_usd: number;
  vol24h_usd: number;
  risk_flags: string[];
}
export interface WatchdogMarket {
  coin: string;
  dex: Dex;
  status: "active" | "paused" | "delisted" | "zero_oi" | (string & {});
  growth_mode: boolean | null;
  max_leverage: number | null;
  oi_usd: number | null;
  oi_change_7d_pct: number | null;
  vol24h_usd: number | null;
  vol_change_7d_pct: number | null;
  last_funding_at: string | null;
  tracked_since: string | null;
  risk_flags: string[];
}
export interface WatchdogResponse extends Disclaimed {
  as_of: string;
  note?: string;
  dexes: WatchdogDex[];
  markets: WatchdogMarket[];
}

export interface EligibleCheck {
  value: number | null;
  threshold: number;
  pass: boolean;
}
export interface EligibleItem {
  pair_key?: string;
  base?: string;
  kind: "xdex" | "spot_perp" | (string & {});
  legs?: Array<{ coin: string; dex: Dex; side: "long" | "short" }>;
  checks: Record<string, EligibleCheck>;
  eligible: boolean;
  score: number | null;
  rank: number | null;
  since: string | null;
  [k: string]: unknown;
}
export interface EligibleResponse extends Disclaimed {
  as_of: string;
  params?: Record<string, number | string>;
  count: number;
  items: EligibleItem[];
}

export interface CapacityResponse extends Disclaimed {
  as_of: string;
  capital?: number;
  lev?: number;
  max_pairs?: number;
  allocations?: unknown[];
  unallocated_by_liquidity_usd?: number;
  items?: unknown[];
  [k: string]: unknown;
}

export interface RealizedWindow {
  hours: number;
  funding_received?: number;
  four_taker_fees?: number;
  basis_drift?: number;
  net_pct_of_notional?: number;
  net_pct_of_margin?: number;
  max_adverse_basis?: number;
  [k: string]: unknown;
}
export interface RealizedResponse extends Disclaimed {
  as_of: string;
  items?: unknown[];
  [k: string]: unknown;
}

export interface AfterhoursResponse extends Disclaimed {
  as_of: string;
  items?: unknown[];
  [k: string]: unknown;
}

export type AlertType =
  | "eligible_on"
  | "eligible_off"
  | "naked_extreme"
  | "watchdog_flag"
  | "afterhours_premium";
export interface AlertFilter {
  pair?: string;
  coin?: string;
  dex?: Dex;
  min_abs_apr?: number;
  min_abs_premium_pct?: number;
}
export interface CreateAlertBody {
  type: AlertType;
  filter?: AlertFilter;
  channel: "webhook";
  target: string;
}
export interface Alert extends CreateAlertBody {
  id: string;
  created_at?: string;
  secret?: string;
  [k: string]: unknown;
}

export interface CarryStats {
  funding: { rows: number; coins: number; dexes: number; first_hour: string; last_hour: string };
  spot: { rows: number; pairs: number };
  last_snapshot: { at: string; perps: number; spot: number; dexes: string[] };
  access?: string;
  tiers?: unknown;
  disclaimer?: string;
  [k: string]: unknown;
}

/* --------------------------------- Keys --------------------------------- */

export interface KeyInfo {
  key?: string;
  tier?: string;
  credits?: number;
  budget?: number;
  expires_at?: string | null;
  [k: string]: unknown;
}

/* -------------------------------- Oracle -------------------------------- */

export interface ForecastRequest {
  question: string;
  resolves_at?: string;
  context?: string;
  runs?: number;
  population?: number;
  rounds?: number;
  interventions?: string[];
  method?: "social_sim" | "expert_panel" | "hybrid";
}
export interface ForecastResponse {
  id: string;
  status: "queued" | "running" | "done" | "refused" | (string & {});
  probability?: number;
  ci80?: [number, number];
  base_rate?: number;
  market_odds?: number;
  drivers?: unknown[];
  panel?: unknown[];
  hash?: string;
  [k: string]: unknown;
}

/* ------------------------------- Payments ------------------------------- */

/** The x402 v2 requirements the server returns with a 402. */
export interface PaymentRequirements {
  x402Version?: number;
  accepts?: Array<{
    scheme: string;
    network: string;
    amount?: string;
    maxAmountRequired?: string;
    asset?: string;
    payTo?: string;
    resource?: string;
    description?: string;
    [k: string]: unknown;
  }>;
  error?: string;
  [k: string]: unknown;
}
