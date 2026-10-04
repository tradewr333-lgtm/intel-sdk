import { test } from "node:test";
import assert from "node:assert/strict";
import { IntelClient, PaymentRequiredError, IntelError } from "../src/index.js";

function mockFetch(handler: (url: string, init?: RequestInit) => { status: number; body: unknown }) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const f = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = handler(url, init);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json" } });
  };
  return { f, calls };
}

test("sends X-API-KEY and query params on carry routes", async () => {
  const { f, calls } = mockFetch(() => ({ status: 200, body: { as_of: "x", count: 0, items: [] } }));
  const c = new IntelClient({ apiKey: "dsi_carry_test", fetch: f });
  const r = await c.carry.xdex({ min_vol: 1_000_000, limit: 5 });
  assert.equal(r.count, 0);
  assert.equal(calls[0].url, "https://intel.degenscan.io/v1/carry/xdex?min_vol=1000000&limit=5");
  const h = calls[0].init!.headers as Record<string, string>;
  assert.equal(h["x-api-key"], "dsi_carry_test");
});

test("encodes HIP-3 coin prefix in history path", async () => {
  const { f, calls } = mockFetch(() => ({ status: 200, body: { coin: "xyz:NBIS", items: [] } }));
  const c = new IntelClient({ apiKey: "k", fetch: f });
  await c.carry.history("xyz:NBIS", { hours: 24 });
  assert.equal(calls[0].url, "https://intel.degenscan.io/v1/carry/history/xyz%3ANBIS?hours=24");
});

test("402 without wallet throws PaymentRequiredError carrying requirements", async () => {
  const req = { x402Version: 2, accepts: [{ scheme: "exact", network: "eip155:8453", amount: "50000", asset: "USDC" }] };
  const { f } = mockFetch(() => ({ status: 402, body: req }));
  const c = new IntelClient({ fetch: f });
  await assert.rejects(c.carry.xdex(), (e: unknown) => {
    assert.ok(e instanceof PaymentRequiredError);
    assert.equal(e.status, 402);
    assert.equal(e.requirements?.accepts?.[0].network, "eip155:8453");
    assert.match(e.message, /Payment required/);
    return true;
  });
});

test("non-2xx becomes IntelError with body", async () => {
  const { f } = mockFetch(() => ({ status: 403, body: { error: "subscription_required" } }));
  const c = new IntelClient({ apiKey: "dsi_x", fetch: f });
  await assert.rejects(c.carry.eligible(), (e: unknown) => e instanceof IntelError && e.status === 403 && /subscription_required/.test(e.message));
});

test("POST alerts sends JSON body", async () => {
  const { f, calls } = mockFetch(() => ({ status: 200, body: { id: "a1", type: "eligible_on", channel: "webhook", target: "https://x" } }));
  const c = new IntelClient({ apiKey: "dsi_carrydesk_x", fetch: f });
  const a = await c.carry.alerts.create({ type: "eligible_on", channel: "webhook", target: "https://x" });
  assert.equal(a.id, "a1");
  assert.equal(calls[0].init!.method, "POST");
  assert.equal(JSON.parse(String(calls[0].init!.body)).type, "eligible_on");
});

test("free-trial header on event feed", async () => {
  const { f, calls } = mockFetch(() => ({ status: 200, body: { ok: true } }));
  const c = new IntelClient({ freeTrial: true, fetch: f });
  await c.intel.events({ since: "4h", universe: "BTC" });
  const h = calls[0].init!.headers as Record<string, string>;
  assert.equal(h["x-free-trial"], "1");
  assert.equal(calls[0].url, "https://intel.degenscan.io/v1/events?since=4h&universe=BTC");
});
