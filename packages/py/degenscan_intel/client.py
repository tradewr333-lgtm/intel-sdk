from __future__ import annotations

import asyncio
import os
import time
from typing import Any, Literal, Mapping, Optional

import httpx

DEFAULT_BASE_URL = "https://intel.degenscan.io"
DISCLAIMER = "Market data and analytics only — not a signal, not investment advice."
_UA = "degenscan-intel-py/0.1.0"

Query = Mapping[str, Any] | None


class IntelError(Exception):
    """Non-2xx response from the API."""

    def __init__(self, message: str, status: int, body: Any, url: str):
        super().__init__(message)
        self.status = status
        self.body = body
        self.url = url


class PaymentRequiredError(IntelError):
    """HTTP 402 with no key covering the route and no x402 wallet configured.

    `requirements["accepts"][0]` carries amount, asset and network so an agent can decide to pay.
    """

    def __init__(self, body: Any, url: str):
        req = body if isinstance(body, dict) else None
        first = (req or {}).get("accepts", [{}])[0] if req else {}
        price = first.get("amount") or first.get("maxAmountRequired")
        hint = f" ({price} base units of {first.get('asset', 'USDC')} on {first.get('network')})" if price else ""
        super().__init__(
            f"Payment required for {url}{hint}. Pass api_key, or configure x402 to pay per call.",
            402,
            body,
            url,
        )
        self.requirements = req


def _clean(q: Query) -> dict[str, Any]:
    return {k: v for k, v in (q or {}).items() if v is not None and v != ""}


def _raise_for(res: httpx.Response, url: str) -> Any:
    try:
        data = res.json() if res.content else None
    except ValueError:
        data = res.text
    if res.status_code == 402:
        raise PaymentRequiredError(data, url)
    if res.status_code >= 400:
        msg = data.get("error") if isinstance(data, dict) and data.get("error") else f"HTTP {res.status_code} for {url}"
        raise IntelError(str(msg), res.status_code, data, url)
    return data


def _headers(api_key: Optional[str], free_trial: bool) -> dict[str, str]:
    h = {"accept": "application/json", "user-agent": _UA}
    if api_key:
        h["x-api-key"] = api_key
    if free_trial:
        h["x-free-trial"] = "1"
    return h


def _build_x402_client(evm_key: Optional[str], svm_key: Optional[str], network: Optional[str]):
    """Build an x402Client with the configured wallets. Requires `pip install degenscan-intel[x402-evm]` and/or `[x402-svm]`."""
    from x402 import x402Client  # type: ignore

    client = x402Client()
    if evm_key:
        from eth_account import Account  # type: ignore
        from x402.mechanisms.evm.exact import register_exact_evm_client  # type: ignore
        from x402.mechanisms.evm.signers import EthAccountSigner  # type: ignore

        register_exact_evm_client(
            client,
            EthAccountSigner(Account.from_key(evm_key)),
            networks=network if network and network.startswith("eip155") else None,
        )
    if svm_key:
        from x402.mechanisms.svm.exact import register_exact_svm_client  # type: ignore
        from x402.mechanisms.svm.signers import KeypairSigner  # type: ignore

        register_exact_svm_client(
            client,
            KeypairSigner.from_base58(svm_key),
            networks=network if network and network.startswith("solana") else None,
        )
    return client


class _Routes:
    """Route table shared by the sync and async clients. `self._get/_post/_delete` are bound by the subclass."""

    # ------------------------------ Carry Oracle ------------------------------
    def carry_stats(self):
        """Free: dataset size, tiers, links."""
        return self._get("/v1/carry/stats", pay=False)

    def carry_funding_matrix(self, dex: str | None = None, min_vol: float | None = None):
        """Current annualized funding for all perps on all dexes (fraction: 0.12 = 12 % a.a.)."""
        return self._get("/v1/carry/funding-matrix", {"dex": dex, "min_vol": min_vol})

    def carry_xdex(self, min_vol: float | None = None, limit: int | None = None):
        """Same ticker on 2+ HIP-3 dexes: spread now/14d, basis, liquidity."""
        return self._get("/v1/carry/xdex", {"min_vol": min_vol, "limit": limit})

    def carry_spot_perp(self):
        return self._get("/v1/carry/spot-perp")

    def carry_history(self, coin: str, hours: int | None = None):
        """Hourly series since 2026-09-13. HIP-3 coins take a prefix: 'xyz:NBIS'."""
        return self._get(f"/v1/carry/history/{coin}", {"hours": hours})

    def carry_naked(self, min_abs_apr: float | None = None):
        return self._get("/v1/carry/naked", {"min_abs_apr": min_abs_apr})

    def carry_watchdog(self):
        return self._get("/v1/carry/watchdog")

    # Carry Desk
    def carry_eligible(self, entry_apr: float | None = None, min_corr: float | None = None, fee_bps: float | None = None, only: Literal["eligible"] | None = None):
        return self._get("/v1/carry/eligible", {"entry_apr": entry_apr, "min_corr": min_corr, "fee_bps": fee_bps, "only": only})

    def carry_capacity(self, capital: float | None = None, lev: int | None = None, max_pairs: int | None = None):
        return self._get("/v1/carry/capacity", {"capital": capital, "lev": lev, "max_pairs": max_pairs})

    def carry_realized(self, pair_key: str | None = None):
        return self._get(f"/v1/carry/realized/{pair_key}" if pair_key else "/v1/carry/realized")

    def carry_afterhours(self, coin: str | None = None):
        return self._get(f"/v1/carry/afterhours/{coin}" if coin else "/v1/carry/afterhours")

    def carry_alerts_list(self):
        return self._get("/v1/carry/alerts")

    def carry_alert_create(self, type: str, target: str, *, pair: str | None = None, coin: str | None = None, dex: str | None = None, min_abs_apr: float | None = None, min_abs_premium_pct: float | None = None):
        body = {"type": type, "channel": "webhook", "target": target, "filter": _clean({"pair": pair, "coin": coin, "dex": dex, "min_abs_apr": min_abs_apr, "min_abs_premium_pct": min_abs_premium_pct})}
        return self._post("/v1/carry/alerts", body)

    def carry_alert_delete(self, alert_id: str):
        return self._delete(f"/v1/carry/alerts/{alert_id}")

    # ------------------------------- Event feed -------------------------------
    def pulse(self):
        return self._get("/v1/pulse")

    def events(self, since: str | None = None, universe: str | None = None, kinds: str | None = None, min_severity: float | None = None, min_confidence: float | None = None, q: str | None = None, limit: int | None = None):
        return self._get("/v1/events", {"since": since, "universe": universe, "kinds": kinds, "min_severity": min_severity, "min_confidence": min_confidence, "q": q, "limit": limit})

    def impact(self, asset: str, since: str | None = None):
        return self._get(f"/v1/impact/{asset}", {"since": since})

    def graph(self, asset: str, depth: int | None = None):
        return self._get(f"/v1/graph/{asset}", {"depth": depth})

    def regime(self):
        return self._get("/v1/regime")

    def explain(self, event_id: str):
        return self._get(f"/v1/explain/{event_id}")

    def polymarket(self, market: str, since: str | None = None, limit: int | None = None):
        return self._get(f"/v1/polymarket/{market}", {"since": since, "limit": limit})

    def polymarket_top(self, sort: str | None = None, limit: int | None = None, tag: str | None = None):
        return self._get("/v1/polymarket/top", {"sort": sort, "limit": limit, "tag": tag})

    def price(self, symbol: str):
        return self._get(f"/v1/price/{symbol}")

    def funding_alerts(self, min_abs_rate_1h: float | None = None, limit: int | None = None):
        return self._get("/v1/funding/alerts", {"min_abs_rate_1h": min_abs_rate_1h, "limit": limit})

    def whales(self, min_usd: float | None = None, chains: str | None = None, limit: int | None = None):
        return self._get("/v1/whales", {"min_usd": min_usd, "chains": chains, "limit": limit})

    def derivs(self, symbol: str, since: str | None = None):
        return self._get(f"/v1/derivs/{symbol}", {"since": since})

    def news(self, ticker: str, since: str | None = None, limit: int | None = None):
        return self._get(f"/v1/news/{ticker}", {"since": since, "limit": limit})

    def filings(self, ticker: str, since: str | None = None, forms: str | None = None):
        return self._get(f"/v1/filings/{ticker}", {"since": since, "forms": forms})

    def calendar(self, days: int | None = None, types: str | None = None, universe: str | None = None):
        return self._get("/v1/calendar", {"days": days, "types": types, "universe": universe})

    def brief(self, asset: str, since: str | None = None):
        return self._get(f"/v1/brief/{asset}", {"since": since})

    # --------------------------------- Oracle ---------------------------------
    def oracle_forecast(self, question: str, *, resolves_at: str | None = None, context: str | None = None, runs: int | None = None, population: int | None = None, rounds: int | None = None, interventions: list[str] | None = None, method: str | None = None):
        """US$0.25. Async on the server: poll `oracle_status(id)`; or use `oracle_forecast_and_wait`."""
        body = _clean({"question": question, "resolves_at": resolves_at, "context": context, "runs": runs, "population": population, "rounds": rounds, "interventions": interventions, "method": method})
        return self._post("/v1/oracle/forecast", body, timeout=120.0)

    def oracle_status(self, forecast_id: str):
        return self._get(f"/v1/oracle/forecast/{forecast_id}", pay=False)

    def oracle_board(self):
        return self._get("/v1/oracle/board")

    def oracle_board_slug(self, slug: str):
        return self._get(f"/v1/oracle/board/{slug}")

    def oracle_edge(self, min_abs: float | None = None, limit: int | None = None):
        return self._get("/v1/oracle/edge", {"min_abs": min_abs, "limit": limit})

    def oracle_track_record(self):
        return self._get("/v1/oracle/track-record", pay=False)

    # ---------------------------------- Keys ----------------------------------
    def keys_me(self):
        return self._get("/v1/keys/me", pay=False)

    def buy_carry_month(self):
        """100 USDC = 30 days of Carry Data. Needs x402. Returns the new key — store it."""
        return self._post("/v1/keys/x402/carry_month", None)

    def buy_carry_desk_month(self):
        """450 USDC = 30 days of Carry Desk (25 seats per wave)."""
        return self._post("/v1/keys/x402/carry_desk_month", None)

    def buy_pack(self, pack: Literal["pack_1k", "pack_10k", "pack_100k"]):
        return self._post(f"/v1/keys/x402/{pack}", None)


class IntelClient(_Routes):
    """Synchronous client.

    >>> intel = IntelClient(api_key="dsi_carry_...")
    >>> intel.carry_xdex(min_vol=1_000_000)["items"][0]["base"]

    Pay per call in USDC (Base): `IntelClient(x402_evm_key="0x...")` (needs `degenscan-intel[x402-evm]`).
    """

    _TERMINAL = {"done", "refused", "error", "failed"}

    def __init__(self, api_key: str | None = None, *, free_trial: bool = False, x402_evm_key: str | None = None, x402_svm_key: str | None = None, x402_network: str | None = None, base_url: str | None = None, timeout: float = 30.0, transport: httpx.BaseTransport | None = None):
        self.base_url = (base_url or os.environ.get("DEGENSCAN_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        self.api_key = api_key or os.environ.get("DEGENSCAN_API_KEY") or None
        self.free_trial = free_trial
        self.timeout = timeout
        evm = x402_evm_key or os.environ.get("DEGENSCAN_X402_EVM_KEY")
        svm = x402_svm_key or os.environ.get("DEGENSCAN_X402_SVM_KEY")
        self._x402 = (evm, svm, x402_network) if (evm or svm) else None
        self._http = httpx.Client(base_url=self.base_url, headers=_headers(self.api_key, free_trial), timeout=timeout, transport=transport)

    def _send(self, method: str, path: str, query: Query = None, body: Any = None, *, pay: bool = True, timeout: float | None = None) -> Any:
        if pay and self._x402:
            # Delegate to the async client so pay-per-call works from sync code too.
            async def _run():
                async with AsyncIntelClient(self.api_key, free_trial=self.free_trial, x402_evm_key=self._x402[0], x402_svm_key=self._x402[1], x402_network=self._x402[2], base_url=self.base_url, timeout=self.timeout) as a:
                    return await a._send(method, path, query, body, pay=True, timeout=timeout)
            return asyncio.run(_run())
        res = self._http.request(method, path, params=_clean(query), json=body, timeout=timeout or self.timeout)
        return _raise_for(res, str(res.request.url))

    def _get(self, path: str, query: Query = None, *, pay: bool = True):
        return self._send("GET", path, query, pay=pay)

    def _post(self, path: str, body: Any, *, timeout: float | None = None):
        return self._send("POST", path, None, body, timeout=timeout)

    def _delete(self, path: str):
        return self._send("DELETE", path)

    def oracle_forecast_and_wait(self, question: str, *, interval: float = 5.0, max_wait: float = 360.0, **kw) -> dict:
        r = self.oracle_forecast(question, **kw)
        start = time.time()
        while r.get("status") not in self._TERMINAL and time.time() - start < max_wait:
            time.sleep(interval)
            r = self.oracle_status(r["id"])
        return r

    def close(self):
        self._http.close()

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


class AsyncIntelClient(_Routes):
    """Async client; the one to use for x402 pay-per-call."""

    _TERMINAL = {"done", "refused", "error", "failed"}

    def __init__(self, api_key: str | None = None, *, free_trial: bool = False, x402_evm_key: str | None = None, x402_svm_key: str | None = None, x402_network: str | None = None, base_url: str | None = None, timeout: float = 30.0, transport: httpx.AsyncBaseTransport | None = None):
        self.base_url = (base_url or os.environ.get("DEGENSCAN_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        self.api_key = api_key or os.environ.get("DEGENSCAN_API_KEY") or None
        self.free_trial = free_trial
        self.timeout = timeout
        headers = _headers(self.api_key, free_trial)
        evm = x402_evm_key or os.environ.get("DEGENSCAN_X402_EVM_KEY")
        svm = x402_svm_key or os.environ.get("DEGENSCAN_X402_SVM_KEY")
        self._http = httpx.AsyncClient(base_url=self.base_url, headers=headers, timeout=timeout, transport=transport)
        self._paying: Optional[httpx.AsyncClient] = None
        if evm or svm:
            from x402.http.clients.httpx import x402AsyncTransport  # type: ignore

            x402_client = _build_x402_client(evm, svm, x402_network)
            self._paying = httpx.AsyncClient(base_url=self.base_url, headers=headers, timeout=timeout, transport=x402AsyncTransport(x402_client, transport))

    async def _send(self, method: str, path: str, query: Query = None, body: Any = None, *, pay: bool = True, timeout: float | None = None) -> Any:
        http = self._paying if (pay and self._paying is not None) else self._http
        res = await http.request(method, path, params=_clean(query), json=body, timeout=timeout or self.timeout)
        return _raise_for(res, str(res.request.url))

    def _get(self, path: str, query: Query = None, *, pay: bool = True):
        return self._send("GET", path, query, pay=pay)

    def _post(self, path: str, body: Any, *, timeout: float | None = None):
        return self._send("POST", path, None, body, timeout=timeout)

    def _delete(self, path: str):
        return self._send("DELETE", path)

    async def oracle_forecast_and_wait(self, question: str, *, interval: float = 5.0, max_wait: float = 360.0, **kw) -> dict:
        r = await self.oracle_forecast(question, **kw)
        start = time.time()
        while r.get("status") not in self._TERMINAL and time.time() - start < max_wait:
            await asyncio.sleep(interval)
            r = await self.oracle_status(r["id"])
        return r

    async def aclose(self):
        await self._http.aclose()
        if self._paying is not None:
            await self._paying.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        await self.aclose()
