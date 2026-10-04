"""degenscan-intel — client for Degenscan Intel (https://intel.degenscan.io)

Cross-asset market-event intelligence for AI trading agents: ~40 primary sources (SEC EDGAR,
Federal Reserve, Federal Register, ECB/BoE/BoJ, FTC/DOJ/FDA/CFTC, USGS, NOAA, Nasdaq halts,
DefiLlama, Polymarket, Hyperliquid) normalized into one event schema and scored against an
exposure graph into per-asset impacts.

Three ways to pay, all automatic:
  * ``private_key``  -> pays each call in USDC on Base via x402 (HTTP 402 -> sign -> 200). Needs ``pip install degenscan-intel[x402]``.
  * ``api_key``      -> prepaid pack bought with USDC (``buy_pack``) or a Stripe subscription.
  * ``free_trial``   -> 100 free calls/day per IP (sends ``X-Free-Trial: 1``). Default when nothing else is set.

Carry Oracle (0.3.0+): Hyperliquid funding across every dex (HIP-3 included), stored hourly beyond the
500 h window; cross-dex spreads; spot x perp; eligibility, capacity, realized carry, after-hours, alerts.

Information and analytics only — not investment advice. Operator: Marbella Collins LLC.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any, Iterable, Optional

import httpx

__all__ = ["Intel", "AsyncIntel", "IntelError", "__version__"]
__version__ = "0.3.0"
DEFAULT_BASE_URL = "https://intel.degenscan.io"


class IntelError(Exception):
    def __init__(self, message: str, status: int, body: Any = None):
        super().__init__(message)
        self.status = status
        self.body = body


def _q(params: dict[str, Any]) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in params.items():
        if v is None:
            continue
        out[k] = ",".join(map(str, v)) if isinstance(v, (list, tuple)) else str(v)
    return out


class AsyncIntel:
    """Async client. Use ``Intel`` for a blocking wrapper."""

    def __init__(self, *, base_url: str = DEFAULT_BASE_URL, private_key: Optional[str] = None, api_key: Optional[str] = None,
                 free_trial: Optional[bool] = None, timeout: float = 20.0, client: Optional[httpx.AsyncClient] = None):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.private_key = private_key
        self.free_trial = free_trial if free_trial is not None else (not api_key and not private_key)
        self.timeout = timeout
        self._client = client

    # ---- transport ------------------------------------------------------------------
    async def _http(self) -> httpx.AsyncClient:
        if self._client is not None:
            return self._client
        if not self.private_key:
            self._client = httpx.AsyncClient(timeout=self.timeout)
            return self._client
        try:
            from eth_account import Account
            from x402 import SchemeRegistration, x402ClientConfig
            from x402.http.clients import wrapHttpxWithPaymentFromConfig
            from x402.mechanisms.evm.exact import ExactEvmScheme
            from x402.mechanisms.evm.signers import EthAccountSigner
        except ImportError as e:  # pragma: no cover
            raise ImportError("Per-call USDC payments need: pip install 'degenscan-intel[x402]'") from e
        pk = self.private_key.strip()
        if not pk.startswith("0x"):
            pk = "0x" + pk
        account = Account.from_key(pk)
        cfg = x402ClientConfig(schemes=[SchemeRegistration(network="eip155:8453", client=ExactEvmScheme(signer=EthAccountSigner(account)))])
        self._client = wrapHttpxWithPaymentFromConfig(cfg, timeout=self.timeout)
        return self._client

    def _headers(self, json_body: bool = False) -> dict[str, str]:
        h = {"accept": "application/json", "user-agent": f"degenscan-intel-py/{__version__}"}
        if json_body:
            h["content-type"] = "application/json"
        if self.api_key:
            h["x-api-key"] = self.api_key
        elif self.free_trial and not self.private_key:
            h["x-free-trial"] = "1"
        return h

    async def request(self, path: str, *, method: str = "GET", query: Optional[dict[str, Any]] = None, body: Any = None) -> Any:
        """Low-level request. Returns parsed JSON; raises IntelError on non-2xx (including an unpaid 402)."""
        client = await self._http()
        res = await client.request(method, self.base_url + path, params=_q(query or {}), headers=self._headers(body is not None),
                                   content=json.dumps(body) if body is not None else None)
        try:
            data = res.json() if res.content else None
        except ValueError:
            data = res.text
        if res.status_code >= 400:
            msg = ("Payment required — pass private_key (USDC on Base), api_key, or free_trial=True" if res.status_code == 402
                   else (data or {}).get("error", f"HTTP {res.status_code}") if isinstance(data, dict) else f"HTTP {res.status_code}")
            raise IntelError(msg, res.status_code, data)
        pr = res.headers.get("payment-response")
        if pr and isinstance(data, dict):
            data["_payment_response"] = pr
        return data

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()

    # ---- free -----------------------------------------------------------------------
    async def universe(self): return await self.request("/v1/universe")
    async def sources(self): return await self.request("/v1/sources")
    async def health(self): return await self.request("/health")
    async def plans(self): return await self.request("/v1/plans")
    async def packs(self): return await self.request("/v1/keys/packs")

    # ---- paid -----------------------------------------------------------------------
    async def pulse(self):
        """$0.001 — cheapest probe: event counts in the last hour by class + venues open."""
        return await self.request("/v1/pulse")

    async def events_since(self, since: str = "4h", universe: Optional[Iterable[str]] = None, min_confidence: Optional[float] = None,
                           kinds: Optional[Iterable[str]] = None, limit: Optional[int] = None):
        """$0.005 — all events since `since` touching your universe, with per-asset impacts."""
        return await self.request("/v1/events", query={"since": since, "universe": list(universe) if universe else None,
                                                       "min_confidence": min_confidence, "kinds": list(kinds) if kinds else None, "limit": limit})

    async def impact_for(self, asset_id: str, since: str = "24h", limit: Optional[int] = None):
        """$0.003 — net pressure on one asset and the events driving it."""
        return await self.request(f"/v1/impact/{asset_id}", query={"since": since, "limit": limit})

    async def exposure_graph(self, asset_id: str, depth: int = 2):
        """$0.002 — second-order exposure graph."""
        return await self.request(f"/v1/graph/{asset_id}", query={"depth": depth})

    async def regime(self):
        """$0.01 — venues open, 24h pressure by asset, top events, prediction markets."""
        return await self.request("/v1/regime")

    async def explain(self, event_id: str):
        """$0.02 — the reasoning behind one impact."""
        return await self.request(f"/v1/explain/{event_id}")

    async def polymarket(self, market: str, since: str = "48h", limit: Optional[int] = None):
        """$0.01 — Polymarket market (id, slug or question) -> odds + primary-source events that bear on it."""
        from urllib.parse import quote
        return await self.request(f"/v1/polymarket/{quote(market, safe='')}", query={"since": since, "limit": limit})

    async def news_for(self, ticker: str, since: str = "24h", limit: Optional[int] = None):
        """$0.002 — headlines on one asset with tier, corroboration and heuristic sentiment."""
        return await self.request(f"/v1/news/{ticker}", query={"since": since, "limit": limit})

    async def filings_for(self, ticker: str, since: str = "7d", forms: Optional[Iterable[str]] = None, limit: Optional[int] = None):
        """$0.002 — SEC filings (8-K, Form 4, 13D/G, S-1) on one issuer."""
        return await self.request(f"/v1/filings/{ticker}", query={"since": since, "forms": list(forms) if forms else None, "limit": limit})

    async def calendar(self, days: int = 7, types: Optional[Iterable[str]] = None, universe: Optional[Iterable[str]] = None):
        """$0.002 — upcoming macro prints, FOMC, earnings, auctions."""
        return await self.request("/v1/calendar", query={"days": days, "types": list(types) if types else None, "universe": list(universe) if universe else None})

    async def derivs_for(self, symbol: str, since: str = "24h"):
        """$0.003 — Hyperliquid perp microstructure: funding (1h/8h/annualized), predicted funding by venue, OI, premium, volume, flags + event pressure."""
        return await self.request(f"/v1/derivs/{symbol}", query={"since": since})

    async def brief(self, asset_id: str, since: str = "24h"):
        """$0.10 — one-call pre-trade briefing for one asset."""
        return await self.request(f"/v1/brief/{asset_id}", query={"since": since})

    # ---- oracle (2Realidade) --------------------------------------------------------
    async def oracle_forecast(self, question: str, *, resolves_at: Optional[str] = None, context: str = "", runs: Optional[int] = None,
                              population: Optional[int] = None, rounds: Optional[int] = None, interventions: Optional[list[dict[str, Any]]] = None,
                              method: Optional[str] = None):
        """$0.25 — calibrated YES-probability for a binary question (async). Returns {forecast_id, status, eta_s, poll}; then oracle_get / oracle_wait."""
        body = {k: v for k, v in dict(question=question, resolves_at=resolves_at, context=context or None, runs=runs, population=population,
                                       rounds=rounds, interventions=interventions, method=method).items() if v is not None}
        return await self.request("/v1/oracle/forecast", method="POST", body=body)

    async def oracle_get(self, forecast_id: str):
        """Free — poll a forecast: {status: queued|running|failed} or the full Forecast when status == 'done'."""
        return await self.request(f"/v1/oracle/forecast/{forecast_id}")

    async def oracle_wait(self, forecast_id: str, *, interval_s: float = 20.0, timeout_s: float = 600.0):
        """Free — poll until done. Returns the Forecast; raises IntelError on failed/timeout."""
        import time
        t0 = time.monotonic()
        while True:
            f = await self.oracle_get(forecast_id)
            if f.get("status") == "done":
                return f
            if f.get("status") == "failed":
                raise IntelError(f"forecast {forecast_id} failed: {f.get('error')}", 500)
            if time.monotonic() - t0 > timeout_s:
                raise IntelError(f"forecast {forecast_id} still {f.get('status')} after {timeout_s}s", 504)
            await asyncio.sleep(interval_s)

    async def oracle_board(self, slug: Optional[str] = None):
        """$0.002 — daily board of standing forecasts (or one by slug). No waiting."""
        return await self.request(f"/v1/oracle/board/{slug}" if slug else "/v1/oracle/board")

    async def oracle_track_record(self):
        """Free — public Brier track record overall, by domain and vs. market."""
        return await self.request("/v1/oracle/track-record")


    # ---- Carry Oracle (Hyperliquid funding across all dexes, HIP-3 included) --------------
    # Needs a Carry Data key (dsi_carry_...) or Carry Desk key (dsi_carrydesk_...), or private_key for
    # pay-per-call in USDC (US$0.01-0.05). HIP-3 coins carry a dex prefix: "xyz:NBIS", "io:SNDK".
    # Market data and analytics only - not a signal, not investment advice.
    async def carry_stats(self):
        """Free - dataset size (rows, coins, dexes, first/last hour), tiers and links."""
        return await self.request("/v1/carry/stats")

    async def carry_funding_matrix(self, dex: Optional[str] = None, min_vol: Optional[float] = None):
        """Current annualized funding (fraction; 0.12 = 12 % a.a.) for all perps on all dexes, with OI, volume and spot."""
        return await self.request("/v1/carry/funding-matrix", query={"dex": dex, "min_vol": min_vol})

    async def carry_xdex(self, min_vol: Optional[float] = None, limit: Optional[int] = None):
        """Same ticker on 2+ HIP-3 dexes: funding spread now/14d, share of positive hours, basis, liquidity of the thinner leg."""
        return await self.request("/v1/carry/xdex", query={"min_vol": min_vol, "limit": limit})

    async def carry_spot_perp(self):
        """Spot x perp on the main dex: funding now/14d, share of positive hours, basis, liquidity of both legs."""
        return await self.request("/v1/carry/spot-perp")

    async def carry_history(self, coin: str, hours: Optional[int] = None):
        """Hourly funding/premium/mark/OI/volume since 2026-09-13 - beyond Hyperliquid's own 500 h window."""
        return await self.request(f"/v1/carry/history/{coin}", query={"hours": hours})

    async def carry_naked(self, min_abs_apr: Optional[float] = None):
        """Funding extremes (default |apr| >= 0.5) with NO hedge leg on Hyperliquid. Raw observation, not a trade."""
        return await self.request("/v1/carry/naked", query={"min_abs_apr": min_abs_apr})

    async def carry_watchdog(self):
        """Market health per dex and per market: status, OI/volume and 7d change, growth mode, risk flags."""
        return await self.request("/v1/carry/watchdog")

    # Carry Desk (dsi_carrydesk_ key)
    async def carry_eligible(self, entry_apr: Optional[float] = None, min_corr: Optional[float] = None,
                             fee_bps: Optional[float] = None, only: Optional[str] = None):
        """Eligibility filter: every rule with measured value, threshold and pass; eligible, score, rank, since. Thresholds overridable. A filter, not a signal."""
        return await self.request("/v1/carry/eligible", query={"entry_apr": entry_apr, "min_corr": min_corr, "fee_bps": fee_bps, "only": only})

    async def carry_capacity(self, capital: Optional[float] = None, lev: Optional[int] = None, max_pairs: Optional[int] = None):
        """How much capital fits per pair (1 % vol, 25 % depth@20bps, 5 % OI) and what is left out (unallocated_by_liquidity_usd)."""
        return await self.request("/v1/carry/capacity", query={"capital": capital, "lev": lev, "max_pairs": max_pairs})

    async def carry_realized(self, pair_key: Optional[str] = None):
        """Net realized carry over 168/336/720 h after four taker fees and basis drift. Past performance; no guarantee."""
        return await self.request(f"/v1/carry/realized/{pair_key}" if pair_key else "/v1/carry/realized")

    async def carry_afterhours(self, coin: Optional[str] = None):
        """US equities on HIP-3 dexes vs the last NYSE regular-session close: reference, premium now, hourly series."""
        return await self.request(f"/v1/carry/afterhours/{coin}" if coin else "/v1/carry/afterhours")

    async def carry_alerts(self):
        return await self.request("/v1/carry/alerts")

    async def carry_alert_create(self, type: str, target: str, *, pair: Optional[str] = None, coin: Optional[str] = None,
                                 dex: Optional[str] = None, min_abs_apr: Optional[float] = None, min_abs_premium_pct: Optional[float] = None):
        """Webhook alert (HMAC-SHA256 signed, header X-Carry-Signature). type: eligible_on | eligible_off | naked_extreme | watchdog_flag | afterhours_premium."""
        flt = {k: v for k, v in {"pair": pair, "coin": coin, "dex": dex, "min_abs_apr": min_abs_apr, "min_abs_premium_pct": min_abs_premium_pct}.items() if v is not None}
        return await self.request("/v1/carry/alerts", method="POST", body={"type": type, "channel": "webhook", "target": target, "filter": flt})

    async def carry_alert_delete(self, alert_id: str):
        return await self.request(f"/v1/carry/alerts/{alert_id}", method="DELETE")

    async def buy_carry_month(self):
        """100 USDC = 30 days of Carry Data, unlimited (needs private_key). Returns the new key - store it, it is shown once."""
        if not self.private_key and self._client is None:
            raise IntelError("buy_carry_month needs a paying wallet (private_key) - it is paid in USDC", 400)
        return await self.request("/v1/keys/x402/carry_month", method="POST", body={})

    async def buy_carry_desk_month(self):
        """450 USDC = 30 days of Carry Desk (25 seats per wave; refused before charging when full)."""
        if not self.private_key and self._client is None:
            raise IntelError("buy_carry_desk_month needs a paying wallet (private_key) - it is paid in USDC", 400)
        return await self.request("/v1/keys/x402/carry_desk_month", method="POST", body={})

    # ---- keys -----------------------------------------------------------------------
    async def buy_pack(self, pack: str = "pack_1k"):
        """Buy a prepaid API key with USDC (needs private_key). pack_1k $5 · pack_10k $40 · pack_100k $300 -> {api_key, total_calls}."""
        if not self.private_key and self._client is None:
            raise IntelError("buy_pack needs a paying wallet (private_key) — it is paid in USDC", 400)
        return await self.request(f"/v1/keys/x402/{pack}", method="POST", body={})

    async def key_status(self):
        if not self.api_key:
            raise IntelError("key_status needs api_key", 400)
        return await self.request("/v1/keys/me")


class Intel:
    """Blocking client — same methods as AsyncIntel, without ``await``."""

    def __init__(self, **kwargs: Any):
        self._a = AsyncIntel(**kwargs)

    def __getattr__(self, name: str):
        attr = getattr(self._a, name)
        if not callable(attr):
            return attr

        def run(*args: Any, **kw: Any):
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None
            if loop and loop.is_running():
                raise RuntimeError("Inside an event loop use AsyncIntel and await the call")
            return asyncio.run(attr(*args, **kw))
        return run
