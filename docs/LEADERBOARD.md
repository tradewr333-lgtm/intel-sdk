# Espec. para o construtor do Intel: página pública `/carry/leaderboard` + SEO

**Objetivo:** uma página que devs linkam e o Google/LLMs indexam, atualizada de hora em hora a partir do mesmo scan, sem dar o dataset de graça. Mostra o *topo* (5 linhas por tabela), com 1 hora de atraso, e manda o resto para a assinatura.

## 1 · Conteúdo (server-rendered, HTML estático regenerado após cada snapshot; sem JS obrigatório)

1. **Cabeçalho:** "Hyperliquid funding leaderboard — all dexes (HIP-3 included) · updated hourly · {as_of} UTC". Contador do dataset (linhas, perps, dexes, primeira hora) vindo de `/v1/carry/stats`.
2. **Top 5 cross-dex spreads** (de `xdex`): base · pernas (dex) · spread 14d · spread agora · basis · liquidez mínima. Coluna extra "data points since" = horas no histórico.
3. **Top 5 spot × perp** (14d).
4. **Top 5 funding extremes without hedge** (`naked`), com `why_no_hedge` em texto.
5. **Dex health** (`watchdog` por dex): mercados ativos, OI, volume, flags.
6. **After-hours (Desk) — só títulos**: "N US equities trading X% away from last NYSE close right now. Full table in Carry Desk." (número agregado, sem listar os coins).
7. **Eligibility — só contagem**: "{n} pairs pass the 6-rule carry filter right now. See the rules →" (link para `/docs/carry#method`).
8. Bloco "Get the full dataset": Carry Data US$100/mês, Desk US$450/mês, pay-per-call x402; botões para `/carry`; snippets `npm i degenscan-intel`, `pip install degenscan-intel`, `npx degenscan-intel-mcp`.
9. Rodapé com o disclaimer PT+EN e "Operator: Marbella Collins LLC".

Regras: 1 h de atraso em relação à API paga; top 5, nunca a tabela inteira; nenhuma palavra de direção ("long", "short", "entre"); valores com sinal e unidade.

## 2 · SEO

- **URL:** `/carry/leaderboard` (canônica). Alias `/hyperliquid-funding-rates` → 301 para a canônica.
- **`<title>`:** `Hyperliquid funding rates leaderboard — all dexes, HIP-3 included | Degenscan Intel`
- **meta description:** `Hourly funding for every Hyperliquid perp on every dex (xyz, io, para, mkts and main), cross-dex spreads, spot×perp basis and market health. History beyond Hyperliquid's 500-hour window. Market data only — not investment advice.`
- **H1:** `Hyperliquid funding rates, every dex, every hour`
- **H2s:** `Cross-dex funding spreads (HIP-3)` · `Spot × perp funding` · `Funding extremes without a hedge` · `Dex health` · `Get the full history`
- **Palavras-chave a cobrir no texto corrido (1 parágrafo cada, naturalmente):** hyperliquid funding rate history · hyperliquid funding api · HIP-3 funding · xyz vs io funding · trade.xyz funding rate · hyperliquid funding arbitrage data · delta neutral hyperliquid data · hyperliquid 500 hours funding history.
- **JSON-LD:** `Dataset` (name, description, url, temporalCoverage "2026-09-13/..", isAccessibleForFree false, license) + `Product` com `offers` (100 USD/month, 450 USD/month). Isso gera rich result de dataset.
- **`sitemap.xml`** com `/carry`, `/carry/leaderboard`, `/docs/carry`, `/previsoes`, `/pricing`. **`robots.txt`** permitindo tudo em `/carry*` e `/docs*`.
- **Open Graph / Twitter card** com uma imagem gerada a cada hora (PNG 1200×630 com as 5 linhas do xdex) — é o que faz o link render bem no X/Telegram quando o poster o compartilha.
- **Cache:** `Cache-Control: public, max-age=300`; ETag por `as_of`.

## 3 · Páginas-filha (mesma lógica, 1 por ativo, geradas do histórico)

`/carry/coin/{coin}` (ex.: `/carry/coin/xyz:NBIS`): gráfico simples (SVG server-side) do funding anualizado nas últimas 7 dias com 1 h de atraso, OI e volume, links para os pares xdex/spot-perp em que participa, e CTA. 330 páginas indexáveis com long-tail ("io:NBIS funding", "xyz:TSLA funding rate"). `title`: `{coin} funding rate history on Hyperliquid ({dex}) | Degenscan Intel`.

## 4 · Descoberta por agentes (no mesmo deploy)

- `llms.txt`: secção "Carry" com rotas, preços, `X-API-KEY`, x402 (`carry_month`, `carry_desk_month`, pay-per-call), link para `/docs/carry` e para os pacotes (`degenscan-intel` npm/PyPI, `degenscan-intel-mcp`).
- `/.well-known/x402`: adicionar as rotas carry e os preços por chamada.
- `/v1/carry/stats`: campos `tiers[]` (nome, preço, link, assentos livres do Desk) e `docs`.
- `/openapi.json`: exemplos de resposta nas rotas carry (já existem em `/docs/carry`).

*Informação e análise, não é recomendação de investimento.*
