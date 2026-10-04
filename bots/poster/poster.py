#!/usr/bin/env python3
"""Degenscan Intel — automatic content poster (X + Telegram).

Runs once per invocation (cron it hourly). Reads the Carry Oracle via the official
client, builds short posts from DATA ONLY, posts to X (API v2) and/or a Telegram
channel, and keeps a small state file so the same snapshot is never posted twice.

Every post ends with the mandatory disclaimer. No returns are promised, no
direction is suggested, no "enter now". Posts are observations of public data.

Env:
  DEGENSCAN_API_KEY          dsi_carry_ or dsi_carrydesk_ key (the bot's own subscription)
  X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET   (X developer app, OAuth 1.0a user context)
  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID                         (channel like @degenscan_intel)
  POSTER_STATE=/var/lib/degenscan-poster/state.json            (default ./state.json)
  POSTER_LANG=en|pt                                           (default en; pt posts in Portuguese)
  POSTER_DRY_RUN=1                                            print, do not post
  POSTER_KIND=auto|xdex|naked|spotperp|afterhours|eligible    (default auto: rotates by hour)
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
from degenscan_intel import Intel as IntelClient, IntelError  # PyPI degenscan-intel >= 0.3.0

DISCLAIMER_EN = "Market data and analytics only — not a signal, not investment advice."
DISCLAIMER_PT = "Informação e análise, não é recomendação de investimento."
SITE = "intel.degenscan.io/carry"

LANG = os.environ.get("POSTER_LANG", "en")
DRY = os.environ.get("POSTER_DRY_RUN") == "1"
STATE = Path(os.environ.get("POSTER_STATE", "state.json"))


def disclaimer() -> str:
    return DISCLAIMER_PT if LANG == "pt" else DISCLAIMER_EN


def pct(x: float | None, digits: int = 1) -> str:
    return "n/a" if x is None else f"{x * 100:+.{digits}f}%"


def usd(x: float | None) -> str:
    if x is None:
        return "n/a"
    if x >= 1e9:
        return f"${x / 1e9:.1f}B"
    if x >= 1e6:
        return f"${x / 1e6:.1f}M"
    if x >= 1e3:
        return f"${x / 1e3:.0f}k"
    return f"${x:.0f}"


# ------------------------------------------------------------------ builders

def post_xdex(intel: IntelClient) -> tuple[str, str] | None:
    r = intel.carry_xdex(limit=5)
    items = r.get("items") or []
    if not items:
        return None
    lines = []
    for it in items[:4]:
        legs = it.get("legs") or []
        legtxt = " vs ".join(l["coin"] for l in legs[:2]) if legs else it.get("base", "?")
        lines.append(f"{it.get('base', '?')}: {pct(it.get('spread_apr_14d'))} a.a. 14d · now {pct(it.get('spread_apr_now'))} · basis {it.get('basis_pct', 0):+.2f}% ({legtxt})")
    head = "Hyperliquid cross-dex funding spreads (same ticker, 2 dexes), 14-day avg:" if LANG == "en" else "Spreads de funding entre dexes da Hyperliquid (mesmo ativo, 2 dexes), média 14d:"
    return (f"xdex:{r.get('as_of')}", "\n".join([head, *lines, SITE, disclaimer()]))


def post_naked(intel: IntelClient) -> tuple[str, str] | None:
    r = intel.carry_naked(min_abs_apr=1.0)
    items = sorted(r.get("items") or [], key=lambda i: -abs(i.get("funding_apr_now") or 0))[:4]
    if not items:
        return None
    head = "Funding extremes with NO hedge leg on Hyperliquid right now (no spot, no second dex):" if LANG == "en" else "Funding extremo SEM perna de hedge na Hyperliquid agora (sem spot, sem segundo dex):"
    lines = [f"{i['coin']}: {pct(i.get('funding_apr_now'), 0)} a.a. now · {pct(i.get('funding_apr_14d'), 0)} 14d · OI {usd(i.get('oi_usd'))}" for i in items]
    tail = "Observation only. Spikes like these usually last hours." if LANG == "en" else "Só observação. Picos assim costumam durar horas."
    return (f"naked:{r.get('as_of')}", "\n".join([head, *lines, tail, SITE, disclaimer()]))


def post_spotperp(intel: IntelClient) -> tuple[str, str] | None:
    r = intel.carry_spot_perp()
    items = sorted(r.get("items") or [], key=lambda i: -(i.get("funding_apr_14d") or 0))[:4]
    if not items:
        return None
    head = "Spot × perp funding on Hyperliquid main dex, 14-day avg (perp short, spot long):" if LANG == "en" else "Funding spot × perp no dex principal da Hyperliquid, média 14d:"
    lines = [f"{i['base']}: {pct(i.get('funding_apr_14d'))} a.a. · {int((i.get('hours_positive_14d') or 0) * 100)}% positive hours · basis {i.get('basis_pct', 0):+.2f}%" for i in items]
    return (f"spotperp:{r.get('as_of')}", "\n".join([head, *lines, SITE, disclaimer()]))


def post_afterhours(intel: IntelClient) -> tuple[str, str] | None:
    try:
        r = intel.carry_afterhours()
    except IntelError:
        return None  # Desk-only; skip if the bot's key is Data
    items = r.get("items") or []
    rows = []
    for i in items:
        p = i.get("premium_now") if isinstance(i, dict) else None
        if p is not None:
            rows.append((i.get("coin"), p))
    rows.sort(key=lambda t: -abs(t[1]))
    if not rows:
        return None
    head = "US equities on Hyperliquid HIP-3 vs last NYSE close (after-hours premium):" if LANG == "en" else "Ações americanas na Hyperliquid (HIP-3) vs último fechamento da NYSE (prêmio after-hours):"
    lines = [f"{c}: {pct(p)}" for c, p in rows[:5]]
    return (f"afterhours:{r.get('as_of')}", "\n".join([head, *lines, SITE, disclaimer()]))


def post_eligible(intel: IntelClient) -> tuple[str, str] | None:
    try:
        r = intel.carry_eligible(only="eligible")
    except IntelError:
        return None
    items = r.get("items") or []
    head = f"Carry eligibility filter (6 rules, all auditable): {len(items)} pair(s) pass right now." if LANG == "en" else f"Filtro de elegibilidade de carry (6 regras, todas auditáveis): {len(items)} par(es) passam agora."
    lines = [f"{i.get('base') or i.get('pair_key')}: score {i.get('score', 0):.2f}" for i in items[:5]]
    return (f"eligible:{r.get('as_of')}", "\n".join([head, *lines, SITE, disclaimer()]))


def post_stats(intel: IntelClient) -> tuple[str, str] | None:
    """Free route: dataset size. Used as the first/fallback post and when no carry key is configured."""
    r = intel.carry_stats()
    f = r.get("funding") or {}
    head = "Hyperliquid funding dataset, every dex, every hour:" if LANG == "en" else "Dataset de funding da Hyperliquid, todos os dexes, hora a hora:"
    lines = [
        f"{f.get('rows', 0):,} hourly funding rows · {f.get('coins', 0)} perps · {f.get('dexes', 0)} dexes",
        (f"since {str(f.get('first_hour', ''))[:10]} — beyond Hyperliquid's 500 h API window" if LANG == "en" else f"desde {str(f.get('first_hour', ''))[:10]} — além da janela de 500 h da API da Hyperliquid"),
        "API · MCP (npx degenscan-intel-mcp) · x402 pay-per-call",
    ]
    return (f"stats:{f.get('last_hour')}", "\n".join([head, *lines, SITE, disclaimer()]))


BUILDERS = {"stats": post_stats, "xdex": post_xdex, "naked": post_naked, "spotperp": post_spotperp, "afterhours": post_afterhours, "eligible": post_eligible}
ROTATION = ["xdex", "naked", "spotperp", "afterhours", "eligible", "xdex", "naked", "spotperp"]


# ------------------------------------------------------------------ senders

def send_x(text: str) -> str:
    """Post via X API v2 with OAuth 1.0a user context. Returns tweet id."""
    from requests_oauthlib import OAuth1  # type: ignore
    import requests  # type: ignore

    auth = OAuth1(os.environ["X_API_KEY"], os.environ["X_API_SECRET"], os.environ["X_ACCESS_TOKEN"], os.environ["X_ACCESS_SECRET"])
    r = requests.post("https://api.x.com/2/tweets", json={"text": text}, auth=auth, timeout=30)
    r.raise_for_status()
    return r.json()["data"]["id"]


def send_telegram(text: str) -> str:
    tok, chat = os.environ["TELEGRAM_BOT_TOKEN"], os.environ["TELEGRAM_CHAT_ID"]
    r = httpx.post(f"https://api.telegram.org/bot{tok}/sendMessage", json={"chat_id": chat, "text": text, "disable_web_page_preview": True}, timeout=30)
    r.raise_for_status()
    return str(r.json()["result"]["message_id"])


def fit_x(text: str) -> str:
    """X version: no URL (X pay-per-use bills a post with a link at $0.20 vs $0.015 without — link stays in the bio),
    280-char limit for non-premium accounts; trim middle lines, never the disclaimer."""
    text = text.replace(SITE, "Link in bio." if LANG == "en" else "Link na bio.")
    if len(text) <= 280:
        return text
    lines = text.split("\n")
    head, tail = lines[0], lines[-2:]
    body = lines[1:-2]
    while body and len("\n".join([head, *body, *tail])) > 280:
        body.pop()
    return "\n".join([head, *body, *tail])


# ------------------------------------------------------------------ main

def main() -> int:
    key_env = os.environ.get("DEGENSCAN_API_KEY") or None
    intel = IntelClient(api_key=key_env, free_trial=not key_env)
    state = json.loads(STATE.read_text()) if STATE.exists() else {"posted": []}
    kind = os.environ.get("POSTER_KIND", "auto")
    if kind == "auto":
        kind = ROTATION[datetime.now(timezone.utc).hour % len(ROTATION)]
    try:
        built = BUILDERS[kind](intel)
    except Exception as e:  # no carry key yet (402/403) -> fall back to the free stats post
        print(f"[{kind}] {e}; falling back to stats")
        kind, built = "stats", post_stats(intel)
    if not built:
        print(f"[{kind}] nothing to post")
        return 0
    key, text = built
    if key in state["posted"]:
        print(f"[{kind}] already posted {key}")
        return 0
    print(text)
    if DRY:
        return 0
    out = {}
    errors = {}
    if os.environ.get("X_API_KEY"):
        try:
            out["x"] = send_x(fit_x(text))
        except Exception as e:  # e.g. 402 = X pay-per-use credits exhausted; keep posting elsewhere
            errors["x"] = str(e)
    if os.environ.get("TELEGRAM_BOT_TOKEN"):
        try:
            out["telegram"] = send_telegram(text)
        except Exception as e:
            errors["telegram"] = str(e)
    if not out:
        raise RuntimeError(f"no channel accepted the post: {errors}")
    if errors:
        print(json.dumps({"errors": errors}), file=sys.stderr)
    state["posted"] = (state["posted"] + [key])[-500:]
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state))
    print(json.dumps({"kind": kind, "key": key, **out}))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # never crash the cron silently
        print(f"poster error: {e}", file=sys.stderr)
        sys.exit(1)
