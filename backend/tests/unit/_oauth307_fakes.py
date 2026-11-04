"""Phase 307-02 — an in-memory async Redis for the OAuth suites.

Implements exactly the commands the OAuth store and the door limiter use: ``setex`` / ``get`` /
``delete`` / ``exists`` and a MULTI pipeline of ``get`` / ``delete`` / ``incr`` / ``expire`` /
``setex``. A pipeline's ``execute`` runs every queued command with no ``await`` between them, so it
is atomic on one event loop exactly as MULTI/EXEC is on a server. ``broken=True`` makes every
command raise ``ConnectionError`` (the fail-closed paths).
"""
from __future__ import annotations

from typing import Any


class FakePipe:
    def __init__(self, redis: "FakeRedis", transaction: bool):
        self.redis = redis
        self.transaction = transaction
        self.ops: list[tuple] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def get(self, key):
        self.ops.append(("get", key))
        return self

    def delete(self, key):
        self.ops.append(("delete", key))
        return self

    def incr(self, key):
        self.ops.append(("incr", key))
        return self

    def expire(self, key, seconds):
        self.ops.append(("expire", key, seconds))
        return self

    def setex(self, key, seconds, value):
        self.ops.append(("setex", key, seconds, value))
        return self

    async def execute(self):
        self.redis._check()
        self.redis.pipelines.append({"transaction": self.transaction, "ops": [o[0] for o in self.ops]})
        out: list[Any] = []
        for op in self.ops:
            out.append(self.redis._apply(op))
        self.ops = []
        return out


class FakeRedis:
    def __init__(self, *, broken: bool = False):
        self.broken = broken
        self.store: dict[str, Any] = {}
        self.ttls: dict[str, int] = {}
        self.calls: list[tuple] = []
        self.pipelines: list[dict] = []

    def _check(self):
        if self.broken:
            raise ConnectionError("redis down")

    def _apply(self, op):
        name = op[0]
        if name == "get":
            return self.store.get(op[1])
        if name == "delete":
            existed = op[1] in self.store
            self.store.pop(op[1], None)
            self.ttls.pop(op[1], None)
            return 1 if existed else 0
        if name == "incr":
            self.store[op[1]] = int(self.store.get(op[1], 0)) + 1
            return self.store[op[1]]
        if name == "expire":
            self.ttls[op[1]] = op[2]
            return True
        if name == "setex":
            self.store[op[1]] = op[3]
            self.ttls[op[1]] = op[2]
            return True
        raise AssertionError(op)

    async def setex(self, key, seconds, value):
        self._check()
        self.calls.append(("setex", key, seconds))
        return self._apply(("setex", key, seconds, value))

    async def get(self, key):
        self._check()
        self.calls.append(("get", key))
        return self.store.get(key)

    async def delete(self, key):
        self._check()
        self.calls.append(("delete", key))
        return self._apply(("delete", key))

    async def exists(self, key):
        self._check()
        self.calls.append(("exists", key))
        return 1 if key in self.store else 0

    def pipeline(self, transaction: bool = True):
        return FakePipe(self, transaction)

    async def eval(self, script, numkeys, *args):
        """The one Lua script the OAuth store runs (``oauth:take-code``), applied with no ``await``
        between its commands — atomic on one event loop, as a script is on a server."""
        self._check()
        keys, argv = args[:numkeys], args[numkeys:]
        if "oauth:take-code" not in script:
            raise AssertionError(f"unknown script: {script[:40]!r}")
        self.calls.append(("eval", "oauth:take-code"))
        value = self.store.get(keys[0])
        if value is not None:
            self._apply(("delete", keys[0]))
            self._apply(("setex", keys[1], int(argv[0]), value))
        return value
