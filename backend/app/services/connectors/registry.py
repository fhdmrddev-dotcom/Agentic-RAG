"""Phase 190 (CONN-02 / D-04) — capability -> adapter, and the closed key set.

This is the **SIXTH** consumer of the closed capability set. The five that shipped before
it are ``EXTERNAL_ACTION_CAPABILITIES`` itself (``harness/grounding.py``, the runtime home),
the backend ``Literal`` on ``ExternalActionPhaseConfig``, two author-facing copy tables with
a module-scope assert, and the client mirror fenced cross-language by a ``?raw`` read. D-04
requires the sixth to be keyed off **the same frozenset with the same static assert, never a
parallel list** — so the agreement below is DERIVED, and adding a fourth key is an
``AssertionError`` **at import**, which is a failure nobody can miss and nobody can defer.

── THE LOOKUP IS CLOSED, AND THE RAISE IS COPIED ─────────────────────────────────────────
``get_adapter`` raises the same shaped ``KeyError`` ``phase_types._exec_external_action``
raises for an unregistered capability, with the noun swapped. One vocabulary for one closed
set: a reader who has met one of these has met both.

── WHY LAZY IMPORT ───────────────────────────────────────────────────────────────────────
The adapter modules are imported ON RESOLUTION, in ``provider_gateway/dispatcher.py``'s
shape, for three reasons that are each independently sufficient:
  1. importing this module must not drag every vendor module into the import graph;
  2. an adapter module that does not exist yet cannot break this module's import — plans
     190-10 and 190-11 own ``jira_adapter`` and ``slack_adapter``, and their entries are
     declared HERE AND NOW so the key set is complete and the D-04 assert is meaningful
     from the first commit rather than growing quietly later;
  3. plan 190-14's fence asserts every capability RESOLVES to an importable adapter whose
     ``CAPABILITY`` equals its key — which is the check that turns (2) from a convenience
     into a promise with a date on it.

This module constructs no client and opens nothing (D-05 — see the package docstring).
"""

from __future__ import annotations

import importlib
import logging
from functools import lru_cache

from app.services.connectors.protocol import ConnectorAdapter
from app.services.harness.grounding import EXTERNAL_ACTION_CAPABILITIES

logger = logging.getLogger(__name__)

#: capability -> the dotted module path whose ``Adapter`` class implements it.
#:
#: The KEYS are the closed capability set and the assert below proves it — they are not a
#: hand-typed list that happens to agree today. The VALUES are module paths, which is the
#: one thing the frozenset cannot tell us. There is no ``.get()`` with a default anywhere
#: in this file: an unknown capability fails CLOSED, at a named site.
_ADAPTERS: dict[str, str] = {
    "send_email": "app.services.connectors.smtp_adapter",
    "create_ticket": "app.services.connectors.jira_adapter",
    "post_message": "app.services.connectors.slack_adapter",
}

# D-04 — DERIVED, never retyped. Static and data-independent: both operands are literals
# declared in the tree, so this can only fire when someone edits one of them, which is
# precisely when it should. A fourth capability added here without being added to the
# closed set (or vice versa) is an ImportError for the whole app, not a latent surface.
assert set(_ADAPTERS) == set(EXTERNAL_ACTION_CAPABILITIES), (
    "D-04: the adapter registry's key set disagrees with EXTERNAL_ACTION_CAPABILITIES "
    f"({sorted(set(_ADAPTERS) ^ set(EXTERNAL_ACTION_CAPABILITIES))}). The capability set "
    "is CLOSED and has one runtime home; a registry key with no capability is an adapter "
    "no step can ever reach, and a capability with no registry key is a step that resolves "
    "to nothing at send time"
)


@lru_cache(maxsize=None)
def _load_adapter(capability: str) -> ConnectorAdapter:
    """Import the adapter module and instantiate its ``Adapter``. Cached — adapters are
    stateless, and re-importing per send would put module-import cost on the hot path.
    """
    module = importlib.import_module(_ADAPTERS[capability])
    adapter: ConnectorAdapter = module.Adapter()
    claimed = getattr(adapter, "CAPABILITY", None)
    if claimed != capability:
        # The two spellings — the registry key and the adapter's own declaration — are
        # checked against each other rather than assumed equal. A mis-wired registry would
        # otherwise send a ticket through the mail adapter and report success.
        raise RuntimeError(
            f"adapter {_ADAPTERS[capability]!r} is registered under capability "
            f"{capability!r} but declares CAPABILITY={claimed!r}"
        )
    return adapter


def get_adapter(capability: str) -> ConnectorAdapter:
    """Return the adapter for ``capability``, or raise on anything outside the closed set."""
    if capability not in _ADAPTERS:
        raise KeyError(
            f"connector adapter lookup: capability {capability!r} is not registered "
            "in EXTERNAL_ACTION_CAPABILITIES (closed set — register it explicitly)"
        )
    return _load_adapter(capability)


__all__ = ["EXTERNAL_ACTION_CAPABILITIES", "get_adapter"]
