import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import http from "node:http";

// A tiny fake Intel API so the MCP server can be exercised end-to-end without network.
function fakeApi(): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      res.setHeader("content-type", "application/json");
      if (req.url?.startsWith("/v1/carry/stats")) return res.end(JSON.stringify({ funding: { rows: 1 } }));
      if (!req.headers["x-api-key"]) { res.statusCode = 402; return res.end(JSON.stringify({ x402Version: 2, accepts: [{ scheme: "exact", network: "eip155:8453", amount: "50000", asset: "USDC" }] })); }
      if (req.url?.startsWith("/v1/carry/xdex")) return res.end(JSON.stringify({ as_of: "t", count: 1, items: [{ base: "NBIS", legs: [] }] }));
      res.statusCode = 404; res.end("{}");
    });
    srv.listen(0, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${(srv.address() as { port: number }).port}`, close: () => srv.close() }));
  });
}

async function connect(env: Record<string, string>) {
  const transport = new StdioClientTransport({ command: "node", args: ["--import", "tsx", "src/server.ts"], env: { ...process.env, ...env } as Record<string, string> });
  const client = new Client({ name: "t", version: "0" });
  await client.connect(transport);
  return client;
}

test("lists carry/intel/oracle/keys tools", async () => {
  const api = await fakeApi();
  const c = await connect({ DEGENSCAN_BASE_URL: api.url, DEGENSCAN_API_KEY: "" });
  const tools = await c.listTools();
  const names = tools.tools.map((t) => t.name);
  for (const n of ["carry_stats", "carry_xdex", "carry_eligible", "carry_capacity", "intel_events", "oracle_forecast", "keys_buy_carry_month"]) assert.ok(names.includes(n), n);
  await c.close(); api.close();
});

test("calls a carry tool with a key and reports payment_required without one", async () => {
  const api = await fakeApi();
  const withKey = await connect({ DEGENSCAN_BASE_URL: api.url, DEGENSCAN_API_KEY: "dsi_carry_t" });
  const r = await withKey.callTool({ name: "carry_xdex", arguments: {} });
  const text = (r.content as Array<{ text: string }>)[0].text;
  assert.match(text, /NBIS/);
  await withKey.close();

  const noKey = await connect({ DEGENSCAN_BASE_URL: api.url, DEGENSCAN_API_KEY: "" });
  const r2 = await noKey.callTool({ name: "carry_xdex", arguments: {} });
  assert.equal(r2.isError, true);
  assert.match((r2.content as Array<{ text: string }>)[0].text, /payment_required/);
  await noKey.close(); api.close();
});
