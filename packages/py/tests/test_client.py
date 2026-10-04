import json
import httpx
import pytest
from degenscan_intel import IntelClient, AsyncIntelClient, PaymentRequiredError, IntelError


def handler(req: httpx.Request) -> httpx.Response:
    if req.url.path == "/v1/carry/stats":
        return httpx.Response(200, json={"funding": {"rows": 163224}})
    if not req.headers.get("x-api-key"):
        return httpx.Response(402, json={"x402Version": 2, "accepts": [{"scheme": "exact", "network": "eip155:8453", "amount": "50000", "asset": "USDC"}]})
    if req.url.path == "/v1/carry/xdex":
        assert req.url.params["min_vol"] == "1000000"
        return httpx.Response(200, json={"as_of": "t", "count": 1, "items": [{"base": "NBIS"}]})
    if req.url.path == "/v1/carry/history/xyz:NBIS":
        return httpx.Response(200, json={"coin": "xyz:NBIS", "items": []})
    if req.url.path == "/v1/carry/alerts" and req.method == "POST":
        body = json.loads(req.content)
        assert body["type"] == "eligible_on" and body["channel"] == "webhook"
        return httpx.Response(200, json={"id": "a1", **body})
    if req.url.path == "/v1/carry/eligible":
        return httpx.Response(403, json={"error": "subscription_required"})
    return httpx.Response(404, json={})


def test_sync_key_and_params():
    c = IntelClient("dsi_carry_t", transport=httpx.MockTransport(handler))
    assert c.carry_stats()["funding"]["rows"] == 163224
    assert c.carry_xdex(min_vol=1_000_000)["items"][0]["base"] == "NBIS"
    assert c.carry_history("xyz:NBIS", hours=24)["coin"] == "xyz:NBIS"
    assert c.carry_alert_create("eligible_on", "https://x")["id"] == "a1"
    with pytest.raises(IntelError) as e:
        c.carry_eligible()
    assert e.value.status == 403 and "subscription_required" in str(e.value)


def test_402_without_wallet():
    c = IntelClient(None, transport=httpx.MockTransport(handler))
    c.api_key = None
    c._http.headers.pop("x-api-key", None)
    with pytest.raises(PaymentRequiredError) as e:
        c.carry_xdex()
    assert e.value.requirements["accepts"][0]["network"] == "eip155:8453"


async def test_async_client():
    async with AsyncIntelClient("dsi_carry_t", transport=httpx.MockTransport(handler)) as c:
        r = await c.carry_xdex(min_vol=1_000_000)
        assert r["count"] == 1
