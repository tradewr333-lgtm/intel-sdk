# Passo a passo para o Renato — o que eu preciso de você, uma vez só

Cada passo é uma credencial ou uma conta. Depois de cada uma, eu executo o resto sem você. Ordem = impacto. Nenhum passo exige reunião com ninguém.

## Passo 1 · GitHub (hoje) — destrava registros, catálogos e PRs

1. Crie a organização **`degenscan`** no GitHub (ou use a sua conta `tradewr333-lgtm`; o nome do servidor MCP no registro fica `io.github.<dono>/intel`).
2. Crie o repo público vazio **`intel-sdk`** (MIT).
3. Gere um **fine-grained token**: Settings → Developer settings → Personal access tokens → Fine-grained → repositório `intel-sdk` → permissões *Contents: Read and write*, *Pull requests: Read and write*, *Metadata: Read*. Validade 90 dias.
4. Para os PRs nos repos de terceiros (awesome lists, x402-agent-tools): um token clássico com escopo `public_repo` (ou eu preparo os forks e você clica "Create pull request" — 1 clique cada).
5. Me mande o token aqui. Eu subo o repo, abro os PRs e registro no MCP registry.

## Passo 2 · npm (hoje) — publica `degenscan-intel` e `degenscan-intel-mcp`

1. Conta em npmjs.com (pode ser `degenscan`). Ative 2FA.
2. Access Tokens → Generate → **Granular** → packages & scopes: read and write → "Bypass 2FA" marcado (token de automação).
3. Me mande o token. Publico as duas libs; `npx degenscan-intel-mcp` passa a funcionar no mundo todo.

## Passo 3 · PyPI (hoje) — publica `degenscan-intel`

1. Conta em pypi.org. Account settings → API tokens → Add token (escopo: toda a conta na primeira publicação; depois restringir ao projeto).
2. Me mande o token.

## Passo 4 · X (amanhã) — conta que posta sozinha

1. Crie a conta **@degenscan_intel** (bio: "Hyperliquid funding & carry data, every dex, every hour. API · MCP · x402. Market data only — not investment advice." · link `intel.degenscan.io/carry`).
2. developer.x.com → "Sign up for Free" com essa conta → crie um App → User authentication settings: *Read and write*, tipo *Web App*, callback `https://intel.degenscan.io` → Keys and tokens: gere **API Key/Secret** e **Access Token/Secret** (com Read and Write).
3. Me mande as 4 chaves. O plano Free permite 1.500 posts/mês — o suficiente para 1 por hora.
4. Opcional: um post fixado seu no @twrulianov apontando para a conta nova. Zero tempo depois disso.

## Passo 5 · Telegram (amanhã, 5 min)

1. No @BotFather: `/newbot` → nome "Degenscan Intel" → guarde o **token**.
2. Crie o canal público **@degenscan_intel** (e, se quiser, **@degenscan_intel_br** em português). Adicione o bot como administrador com permissão de postar.
3. Me mande o token e os @ dos canais.

## Passo 6 · Onde o bot roda (amanhã) — 1 serviço Cron

Render → New → **Cron Job** → repo `tradewr333-lgtm/intel-sdk`, comando `pip install -r bots/poster/requirements.txt && python bots/poster/poster.py`, schedule `7 * * * *`, variáveis de ambiente dos passos 4 e 5 + `DEGENSCAN_API_KEY` (uma chave **Desk** do próprio Intel, emitida pelo construtor, para o bot ter after-hours e eligible). Segundo cron às `37 * * * *` com `POSTER_LANG=pt` e o canal BR. Eu preparo o `render.yaml`; você só aprova.

## Passo 7 · E-mail frio (esta semana)

1. Compre um domínio só para isso (ex.: `getdegenscan.com`) no mesmo registrador do principal.
2. Conta no **Instantly** (instantly.ai, plano Growth ~US$ 37/mês) → "Email accounts" → "Add new" → Google Workspace ou o provedor deles (mais barato: "Instantly done-for-you accounts", 3 caixas) → o próprio Instantly configura DNS, aquecimento e rotação.
3. Me dê acesso (convite de usuário para `tradewr333@gmail.com`'s org não serve; crie o login e me passe, ou me adicione como membro). Eu importo a lista, ligo a sequência de `EMAIL_SEQUENCIA.md` e cuido das respostas por e-mail.
4. Para encher a lista: conta no **Clay** (Starter ~US$ 134/mês) ou **Apollo** (grátis até 50 e-mails/mês) só para enriquecer os "não encontrado" da planilha. Opcional; a lista atual já tem 79.

## Passo 8 · Construtor do Intel (encaminhar)

Mande ao construtor `docs/LEADERBOARD.md` (página pública + SEO + llms.txt/x402/stats) e peça uma chave Desk para o bot. Isso é o único item que depende de terceiro.

## Passo 9 · Opcional, 1 unidade do seu tempo

Um vídeo no canal: "A API que eu construí para agentes de IA pagarem sozinhos em USDC" — mostrando `npx degenscan-intel-mcp` no Claude Desktop puxando o xdex. Público-alvo são os devs do seu público. Sem promessa de rendimento, com a frase obrigatória na descrição.

---

**O que já está pronto sem nenhum token (neste zip):** cliente npm com testes, servidor MCP com teste ponta a ponta, cliente Python com testes e wheel, bot de postagem testado em modo dry-run, textos de todos os catálogos, espec. do leaderboard, sequência de e-mail. O que falta é só publicar, e publicar depende dos tokens acima.

*Informação e análise, não é recomendação de investimento.*
