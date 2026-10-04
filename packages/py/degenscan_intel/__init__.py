"""degenscan-intel — official Python client for the Degenscan Intel API.

Hyperliquid funding & carry data across every dex (HIP-3 included), stored hourly
beyond Hyperliquid's 500 h window; cross-dex spreads; spot×perp; eligibility,
capacity, realized carry, after-hours premium and alerts (Carry Desk); plus an
event feed, derivatives, Polymarket context and a calibrated forecast oracle.

Pay per call in USDC via x402 (no account) or use an API key.

Market data and analytics only — not a signal, not investment advice.
"""

from .client import (
    DISCLAIMER,
    DEFAULT_BASE_URL,
    AsyncIntelClient,
    IntelClient,
    IntelError,
    PaymentRequiredError,
)

__all__ = [
    "AsyncIntelClient",
    "IntelClient",
    "IntelError",
    "PaymentRequiredError",
    "DISCLAIMER",
    "DEFAULT_BASE_URL",
]
__version__ = "0.1.0"
