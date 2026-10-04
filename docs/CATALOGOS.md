# Catálogos e registros — textos prontos para submissão

Ordem de impacto. Cada item diz o que precisa (token/conta) e o que colar. Tudo em inglês porque o público é global. Nunca remover a linha de disclaimer.

## 0 · Pré-requisito: repo público `github.com/tradewr333-lgtm/intel-sdk`

Conteúdo: este repositório (packages/js, packages/mcp, packages/py, bots/poster, docs). README raiz = `docs/README_REPO.md`. Licença MIT. Topics do repo: `hyperliquid`, `funding-rate`, `hip-3`, `x402`, `mcp`, `ai-agents`, `polymarket`, `market-data`, `usdc`.

## 1 · npm (precisa: token npm com publish, 2FA "automation")

```bash
cd packages/js && npm publish --access public
cd ../mcp && npm publish --access public
```

## 2 · PyPI (precisa: API token do PyPI)

```bash
cd packages/py && python -m build && python -m twine upload dist/*
```

## 3 · Registro MCP oficial (registry.modelcontextprotocol.io) — precisa: `mcp-publisher` + login GitHub do dono do repo

`server.json` (na raiz do repo):

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-09-29/server.schema.json",
  "name": "io.github.tradewr333-lgtm/intel",
  "description": "Hyperliquid funding & carry data across all dexes (HIP-3 included), cross-dex spreads, spot×perp, eligibility/capacity/realized/after-hours, event feed, Polymarket context and a forecast oracle. Pay per call in USDC via x402 or use an API key. Market data only — not investment advice.",
  "version": "0.1.0",
  "repository": { "url": "https://github.com/tradewr333-lgtm/intel-sdk", "source": "github" },
  "websiteUrl": "https://intel.degenscan.io",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "degenscan-intel-mcp",
      "version": "0.1.0",
      "transport": { "type": "stdio" },
      "environmentVariables": [
        { "name": "DEGENSCAN_API_KEY", "description": "dsi_ key (Carry Data / Carry Desk / prepaid pack). Optional if an x402 wallet is set.", "isRequired": false, "isSecret": true },
        { "name": "DEGENSCAN_X402_EVM_KEY", "description": "0x private key to pay per call in USDC on Base (optional).", "isRequired": false, "isSecret": true }
      ]
    }
  ],
  "remotes": [ { "type": "streamable-http", "url": "https://intel.degenscan.io/mcp" } ]
}
```

Comandos: `mcp-publisher init` (ou colar o JSON) → `mcp-publisher login github` → `mcp-publisher publish`. O nome `io.github.tradewr333-lgtm/intel` exige que o repo esteja na org/usuário `degenscan` do GitHub.

## 4 · Smithery (smithery.ai) — precisa: login GitHub

Adicionar `smithery.yaml` na raiz:

```yaml
startCommand:
  type: stdio
  configSchema:
    type: object
    properties:
      apiKey: { type: string, description: "Degenscan Intel key (dsi_...). Optional with x402 wallet." }
      x402EvmKey: { type: string, description: "0x private key to pay per call in USDC on Base (optional)." }
  commandFunction: |-
    (config) => ({ command: "npx", args: ["-y", "degenscan-intel-mcp"], env: { DEGENSCAN_API_KEY: config.apiKey || "", DEGENSCAN_X402_EVM_KEY: config.x402EvmKey || "" } })
```

Depois: smithery.ai → "Add server" → URL do repo.

## 5 · Glama (glama.ai/mcp/servers) — formulário de submissão com a URL do repo. Texto: o `description` do item 3.

## 6 · Cursor directory (cursor.directory/mcp) e PulseMCP, mcp.so, mcpservers.org — formulários; mesmo texto; config:

```json
{ "mcpServers": { "degenscan-intel": { "command": "npx", "args": ["-y", "degenscan-intel-mcp"], "env": { "DEGENSCAN_API_KEY": "" } } } }
```

## 7 · Diretórios x402 — PRs (precisa: token GitHub ou fork manual)

**`Br0ski777/x402-agent-tools`** e **`filip-study/awesome-agent-trading-x402-ping`** (entrada Markdown):

```
- **Degenscan Intel — Carry Oracle** — Hyperliquid funding across all dexes (main + HIP-3: xyz, io, para, mkts), same-ticker cross-dex spreads, spot×perp basis, hourly history beyond Hyperliquid's 500 h window; plus event feed, derivatives, Polymarket context and a forecast oracle. Pay per call in USDC (Base/Solana) via x402 — US$0.001–0.25 — or 100 USDC = 30 days unlimited carry (`POST /v1/keys/x402/carry_month`). Docs: https://intel.degenscan.io/docs/carry · MCP: `npx degenscan-intel-mcp` / https://intel.degenscan.io/mcp · llms.txt: https://intel.degenscan.io/llms.txt · x402: https://intel.degenscan.io/.well-known/x402. Market data and analytics only — not a signal, not investment advice.
```

**Coinbase x402 ecosystem** (github.com/coinbase/x402 → `ecosystem/` ou formulário "x402 Bazaar / ecosystem page"): mesmo texto, categoria "Market data / Services".

**awesome-x402 lists** (buscar `awesome-x402` no GitHub; submeter em cada uma): mesma entrada.

## 8 · Listas awesome de Hyperliquid — PRs

Buscar `awesome-hyperliquid`, `hyperliquid-tools`, `awesome-perp-dex`. Entrada:

```
- [Degenscan Intel Carry Oracle](https://intel.degenscan.io/carry) — hourly funding for every perp on every Hyperliquid dex (HIP-3 included) kept beyond the 500 h API window; cross-dex same-ticker spreads; spot×perp; eligibility filter, per-pair capacity, net realized carry, after-hours premium. API, MCP, x402 pay-per-call. Not investment advice.
```

## 9 · Agent frameworks como "skill"/plugin (PR ou issue; cada um traz dezenas de agentes)

- **Superior-Trade/superior-skills**: skill `degenscan-carry` apontando para o MCP.
- **Senpi-ai/senpi-skills**: idem.
- **alsk1992/CloddsBot**: data source "degenscan-intel".
- **ElizaOS plugin registry**: plugin que envolve o cliente npm (gerar depois; 1 dia de trabalho).
- **Virtuals ACP / agent marketplaces**: listar o serviço com preço por chamada.

## 10 · SEO/descoberta por LLM (sem token; depende do construtor)

- `llms.txt`: secção Carry completa (hoje não lista `/v1/carry/*`).
- `/.well-known/x402`: incluir as rotas carry com preços (hoje só lista o feed).
- Página pública `/carry/leaderboard` (ver LEADERBOARD.md).
- README do repo com as mesmas palavras-chave.

*Market data and analytics only — not a signal, not investment advice.*
