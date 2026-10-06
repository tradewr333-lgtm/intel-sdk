# Sequência de e-mail frio automatizada (Instantly / Smartlead)

**Princípio:** nenhuma reunião, nenhuma call, nenhum "vamos conversar". Cada e-mail aponta para uma página que vende sozinha. A resposta esperada é "comprei", "manda os termos (Enterprise)" ou silêncio. Respostas caem na caixa fria; o vendedor (Claude) triagem e responde com texto, nunca marca reunião.

## Infra (uma vez)

1. Domínio secundário só para frio: `degenscan-intel.com` ou `getdegenscan.com` (nunca o domínio principal). SPF, DKIM, DMARC. 2–3 caixas (`renato@`, `data@`, `hello@`), aquecimento automático 14 dias na ferramenta.
2. Ferramenta: Instantly (US$ 37/mês) ou Smartlead (US$ 39/mês). Importar a planilha `Carry_Oracle_prospects_e_preco_04_10_2026.xlsx` (abas B2B + Devs) → enriquecer e-mails com Clay/Apollo/Hunter (os que estão "não encontrado").
3. Limites: 30 e-mails/dia por caixa, 3 passos, parar ao responder. Unsubscribe em todas.
4. Variáveis: `{first_name}`, `{company}`, `{hook}` (coluna "Por que compraria" da planilha, reescrita em 1 frase), `{segment}`.

## Atualização 07/10 — chave de teste grátis e leaderboard (usar em TODOS os passos)

Existe agora: **chave de teste grátis** (200 chamadas, 7 dias, sem cartão) em `intel.degenscan.io/carry` ou `POST /v1/keys/trial {email}`; e a **vitrine pública** `intel.degenscan.io/carry/leaderboard` (top 5 de cada tabela, 1 h de atraso) + `/carry/coin/{moeda}`. Todo e-mail do passo 1 termina com a linha:

> Try it first: free key with 200 calls, no card — intel.degenscan.io/carry · live sample: intel.degenscan.io/carry/leaderboard

Passo 2 passa a linkar a página da moeda do dia (`/carry/coin/xyz:NBIS`). Resposta a "tem teste grátis?": "Yes — 200 calls, no card: intel.degenscan.io/carry".

## Segmentos e assunto

| Segmento | Assunto A | Assunto B |
|---|---|---|
| vaults / gestoras | `Hyperliquid funding history past 500h, all dexes` | `{company} + HIP-3 carry data` |
| deployers HIP-3 | `your {dex} markets vs xyz/io funding, hourly` | `cross-dex funding for {company} markets` |
| devs / repos | `funding data for {repo} (HIP-3, >500h)` | `saw {repo} — carry API` |
| scanners / data providers | `HIP-3 carry layer for {company}` | `licensing: Hyperliquid cross-dex funding` |
| agentes / MCP | `x402 tool: Hyperliquid carry (pay per call)` | `MCP server: Hyperliquid funding, all dexes` |

## Passo 1 (dia 0) — por segmento

**vaults / gestoras**
> Hi {first_name} — {hook}
> Hyperliquid's API keeps 500 hours of funding. We keep every hour for all 330 perps on every dex (main + HIP-3) since 13 Sep, and serve cross-dex same-ticker spreads, spot×perp basis and 14-day stats as JSON. Real responses: intel.degenscan.io/docs/carry
> Carry Data is US$100/month flat; Carry Desk (eligibility filter with auditable rules, how much capital fits per pair, net realized carry, after-hours premium, webhook alerts) is US$450/month, 25 seats. Card or USDC, self-serve: intel.degenscan.io/carry
> No call needed — if anything is unclear, reply and I'll answer by email.
> Renato · Degenscan Intel (Marbella Collins LLC)
> Market data and analytics only — not a signal, not investment advice.

**deployers HIP-3**
> Hi {first_name} — your {dex} markets are in our dataset next to xyz/io/para/mkts listings of the same tickers, hour by hour, past Hyperliquid's 500 h window. The cross-dex view (funding spread, basis, liquidity of the thinner leg) is here with real responses: intel.degenscan.io/docs/carry
> US$100/month flat, or pay per call in USDC via x402, no account. Self-serve: intel.degenscan.io/carry
> Renato · Degenscan Intel · Market data and analytics only — not a signal, not investment advice.

**devs / repos**
> Hi {first_name} — saw {repo}. The data side you'd otherwise scrape is packaged: `npm i degenscan-intel` / `pip install degenscan-intel` / `npx degenscan-intel-mcp`. Hourly funding for every Hyperliquid perp on every dex (HIP-3 prefixes like xyz:NBIS), cross-dex spreads, spot×perp, history beyond 500 h.
> Pay per call in USDC (US$0.01–0.05) with no account, or US$100/month unlimited. Docs with real JSON: intel.degenscan.io/docs/carry
> Renato · Degenscan Intel · Market data and analytics only — not a signal, not investment advice.

**scanners / data providers**
> Hi {first_name} — {company} covers funding across venues; Hyperliquid's HIP-3 dexes are the gap (500 h window, nothing aligns the same ticker across xyz/io/para/mkts). We compute that layer hourly and license it: feed for resale, bulk history (CSV/Parquet), SLA. Terms by email — reply "license" and I'll send them. Public examples: intel.degenscan.io/docs/carry
> Renato · Degenscan Intel · Market data and analytics only — not a signal, not investment advice.

**agentes / MCP**
> Hi {first_name} — a tool your agents can pay for themselves: Hyperliquid carry data (all dexes, HIP-3 included, history >500 h) via x402 in USDC, US$0.01–0.05 per call, no account. MCP: `npx degenscan-intel-mcp` or https://intel.degenscan.io/mcp · llms.txt: intel.degenscan.io/llms.txt
> Renato · Degenscan Intel · Market data and analytics only — not a signal, not investment advice.

## Passo 2 (dia 3) — todos

> One number, in case it helps: on {date} the 6-rule eligibility filter passed {n} pairs and a US$100k allocation at 3x fit about half of it, the rest flagged "unallocated by liquidity". That's the `capacity` route — it shows what does NOT fit, which is the part nobody publishes. intel.degenscan.io/docs/carry#method
> Market data and analytics only — not a signal, not investment advice.

(`{n}` e `{date}` vêm do poster do dia; atualizar a variável semanalmente.)

## Passo 3 (dia 8) — todos

> Last one from me. If HIP-3 carry data isn't on your roadmap, no reply needed. If it is: intel.degenscan.io/carry (card or USDC, cancel anytime; Enterprise terms by email).
> Market data and analytics only — not a signal, not investment advice.

## Respostas (triagem pelo vendedor, por e-mail)

- "price?" → link `/carry` + 2 linhas.
- "license/terms" → PDF de termos Enterprise (a fazer: 1 página, a partir de US$ 1.500/mês ou revenue share; sem exclusividade; atribuição "data by Degenscan Intel").
- "demo/call?" → "No calls — everything is self-serve; here is a sample with real data: /docs/carry. Pay-per-call lets you test for a few cents."
- "can I get it free?" → "Yes: free trial key, 200 calls / 7 days, no card — intel.degenscan.io/carry. After that pay-per-call is cents, or US$100/month."
- objeções → tabela do relatório do construtor §9.

*Market data and analytics only — not a signal, not investment advice.*
