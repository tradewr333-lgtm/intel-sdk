# Degenscan Intel poster (X + Telegram)

Posts one data snapshot per hour, generated from the Carry Oracle. No humans in the loop after setup. Every post ends with the disclaimer; posts never suggest direction or returns.

Rotation by UTC hour: cross-dex spreads → funding extremes without hedge → spot×perp → after-hours (Desk key) → eligibility (Desk key).

## Run

```bash
pip install -r requirements.txt
export DEGENSCAN_API_KEY=dsi_carrydesk_...        # the bot's own subscription
export X_API_KEY=... X_API_SECRET=... X_ACCESS_TOKEN=... X_ACCESS_SECRET=...   # X developer app (Free tier allows 1,500 posts/month = hourly)
export TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=@degenscan_intel
POSTER_DRY_RUN=1 python poster.py          # preview
python poster.py                           # post
```

Cron (hourly, at :07 so the :03 snapshot is in):

```
7 * * * * cd /opt/poster && POSTER_LANG=en python3 poster.py >> poster.log 2>&1
37 * * * * cd /opt/poster && POSTER_LANG=pt TELEGRAM_CHAT_ID=@degenscan_intel_br python3 poster.py >> poster.log 2>&1
```

On Render: a Cron Job service with the same command. State file (`POSTER_STATE`) prevents duplicate posts after restarts.
