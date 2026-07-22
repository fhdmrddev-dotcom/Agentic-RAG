"""Phase 167 (INV-01 / INV-02) — invitation token crypto + idempotent JIT accept.

The security FOUNDATION every other 167 plan builds on (org.py endpoints in Plan 02, the
`/invite` landing in Plan 06). Three responsibilities, all over the ALREADY-COMPLETE
`org_invitations` table (mig 104) — ZERO migration:

1. Token crypto (D-167-02, T-161-04). The raw invite token is minted with the stdlib CSPRNG
   (`secrets.token_urlsafe(32)`) and lives ONLY in the returned link; the DB stores ONLY its
   one-way `sha256` digest (`token_hash`). Verification is a constant-time
   `hmac.compare_digest` compare. This is deliberately NOT the Phase-150 reversible MultiFernet
   MultiFernet cipher (the reversible Phase-150 secrets envelope) — a bearer capability you
   only ever COMPARE must never be stored
   in a form that can be decrypted back (§ Don't Hand-Roll).

2. The idempotent token-gated accept (D-167-05, INV-02). The invitee is NOT yet a member, so
   the user-JWT `org_members_insert` RLS policy (which needs `org:manage`) would DENY the write
   (Pitfall 2). The validated token IS the authorization: the membership INSERT therefore runs
   on the singleton asyncpg pool (the BYPASSRLS `postgres` role). Concurrent first-logins are
   converged to EXACTLY ONE membership by three cooperating guards, all inside one transaction:
     - `pg_advisory_xact_lock(hashtext(org_id||user_id))` serializes racing accepts on the
       same (org, user) — auto-released at COMMIT;
     - `INSERT … org_members … ON CONFLICT (org_id, user_id) DO NOTHING` is the hard
       DB-level convergence guarantee (backed by the mig-104 UNIQUE(org_id,user_id));
     - the status flip is guarded `WHERE status='pending'`, so a single-use token flips
       exactly once.
   The claimability check (`status='pending' AND expires_at > now()`) is RE-READ inside the
   lock so an expired / revoked / already-accepted invite can never be replayed (T-167-04).
   Join-additive (D-167-01): the invitee KEEPS their personal org and simply gains this one.

3. Adoption-state derivation. `active` (a membership row exists) / `pending` (a pending invite,
   no membership) / `not-yet-invited` (no invite) — a SERVER-computed projection, never a
   client flag.

Analog: `setup_store.py` (the one-way `secrets.token_urlsafe(32)` + `hmac.compare_digest`
precedent) — NOT the reversible Phase-150 Fernet envelope.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timezone

import asyncpg


# ── token crypto (D-167-02, stdlib one-way — NOT the reversible Phase-150 cipher) ──

def hash_token(raw: str) -> str:
    """The stored ``token_hash`` — a one-way ``sha256`` digest of the raw token (T-161-04)."""
    return hashlib.sha256(raw.encode()).hexdigest()


def mint_invite_token() -> tuple[str, str]:
    """Return ``(raw, token_hash)``.

    ``raw`` is a high-entropy ``secrets.token_urlsafe(32)`` value (~43 URL-safe chars) that
    goes into the invite link ONLY; ``token_hash == sha256(raw)`` is the only value ever
    persisted to ``org_invitations.token_hash`` (T-161-04). The raw token never round-trips
    back out of storage.
    """
    raw = secrets.token_urlsafe(32)
    return raw, hash_token(raw)


def verify_token(raw: str, stored_hash: str) -> bool:
    """Constant-time verify ``raw`` against a stored ``token_hash`` (defeats a timing side-channel).

    Hashes ``raw`` and compares with ``hmac.compare_digest`` — never the reversible cipher, and
    never a plain ``==`` (which short-circuits and leaks length/prefix timing, T-167-02).
    """
    return hmac.compare_digest(hash_token(raw), stored_hash)


# ── the idempotent token-gated accept (D-167-05, INV-02) ──────────────────────

def _rowcount(command_tag: object) -> int:
    """Parse the trailing row count out of an asyncpg command tag (``"INSERT 0 1"`` → 1)."""
    try:
        return int(str(command_tag).rsplit(" ", 1)[-1])
    except (ValueError, AttributeError):
        return 0


def _not_claimable_reason(status_now: str | None, expires_at, now: datetime) -> str:
    """Classify WHY an invite is not claimable (for an honest caller-facing signal)."""
    if status_now is None:
        return "not_found"
    if status_now == "revoked":
        return "revoked"
    if status_now == "accepted":
        return "already_accepted"
    if status_now == "expired":
        return "expired"
    if expires_at is not None and expires_at <= now:
        return "expired"
    return "not_claimable"


async def accept_invitation(
    pool: asyncpg.Pool, token_hash: str, user_id: str
) -> dict:
    """Idempotently join the invited org for ``token_hash`` on behalf of ``user_id`` (INV-02).

    Runs the whole check → lock → insert → flip as ONE transaction on the singleton pool (the
    token-authorized service-role/BYPASSRLS path — the invitee is not yet a member, so the
    user-JWT RLS write policy cannot be used, Pitfall 2). Returns a dict:

        {joined, claimable, org_id, role, status, reason}

    ``joined`` is True ONLY when THIS call inserted a NEW membership row; a second accept of the
    same single-use token (or a concurrent first-login) is a no-op (``joined=False``). An
    expired / revoked / already-accepted invite is ``claimable=False`` and inserts nothing.
    Every value is a ``$n`` bind — never f-string SQL.
    """
    async with pool.acquire() as conn:
        async with conn.transaction():
            # (a) Look the invite up by its one-way hash — we need org_id to key the lock.
            invite = await conn.fetchrow(
                "SELECT id, org_id, role, status, expires_at "
                "FROM public.org_invitations WHERE token_hash = $1",
                token_hash,
            )
            if invite is None:
                return {
                    "joined": False,
                    "claimable": False,
                    "org_id": None,
                    "role": None,
                    "status": None,
                    "reason": "not_found",
                }

            org_id = invite["org_id"]
            role = invite["role"]

            # (b) Serialize concurrent first-logins on this exact (org, user) so the
            #     re-check + insert + flip are atomic (transaction-scoped; auto-released at COMMIT).
            await conn.execute(
                "SELECT pg_advisory_xact_lock(hashtext($1))",
                str(org_id) + str(user_id),
            )

            # (c) RE-VALIDATE authoritatively INSIDE the lock — a racing accept that won the
            #     lock first may already have flipped this invite to 'accepted'.
            fresh = await conn.fetchrow(
                "SELECT status, expires_at FROM public.org_invitations WHERE id = $1",
                invite["id"],
            )
            status_now = fresh["status"] if fresh else None
            expires_at = fresh["expires_at"] if fresh else None
            now = datetime.now(timezone.utc)
            claimable = (
                status_now == "pending"
                and expires_at is not None
                and expires_at > now
            )
            if not claimable:
                return {
                    "joined": False,
                    "claimable": False,
                    "org_id": str(org_id),
                    "role": role,
                    "status": status_now,
                    "reason": _not_claimable_reason(status_now, expires_at, now),
                }

            # (d) The hard convergence guarantee: at most one membership per (org, user).
            insert_tag = await conn.execute(
                "INSERT INTO public.org_members (org_id, user_id, role) "
                "VALUES ($1, $2, $3) ON CONFLICT (org_id, user_id) DO NOTHING",
                org_id,
                user_id,
                role,
            )
            joined = _rowcount(insert_tag) == 1

            # (e) Single-use: only the FIRST accept flips the invite (guarded WHERE status).
            await conn.execute(
                "UPDATE public.org_invitations "
                "SET status = 'accepted', updated_at = now() "
                "WHERE id = $1 AND status = 'pending'",
                invite["id"],
            )

            return {
                "joined": joined,
                "claimable": True,
                "org_id": str(org_id),
                "role": role,
                "status": "accepted",
                "reason": "accepted",
            }


# ── the domain-gated idempotent SSO JIT (Phase 168, SSO-01) ───────────────────

async def provision_sso_membership(
    pool: asyncpg.Pool, org_id, user_id: str
) -> dict:
    """Idempotently join ``org_id`` on behalf of an authenticated SSO ``user_id`` (SSO-01).

    The sibling of ``accept_invitation``: SAME advisory-lock + ``ON CONFLICT DO NOTHING``
    convergence skeleton, but with the invite-specific machinery DROPPED — there is no token
    lookup, no invitation-status flip, no claimability check. The org is NOT resolved
    here: the Plan-04 endpoint resolves it from the authenticated SSO provider (email domain →
    provider → org, D-168-04) and passes the already-validated ``org_id`` in. This function's
    only job is the load-bearing idempotent, member-only insert.

    Runs on the singleton asyncpg pool (the BYPASSRLS ``postgres`` role): the SSO user is not
    yet a member, so the user-JWT ``org_members_insert`` RLS policy (which needs ``org:manage``)
    would DENY the write — exactly the same authorized service-role path as the 167 accept.

    Convergence for N concurrent first-logins (all inside one transaction):
      * ``pg_advisory_xact_lock(hashtext(org_id||user_id))`` serializes racing provisions on
        this exact (org, user) — auto-released at COMMIT (T-168-05);
      * ``INSERT … org_members … ON CONFLICT (org_id, user_id) DO NOTHING`` is the hard
        DB-level guarantee (backed by the mig-104 UNIQUE(org_id,user_id)) — exactly one row.

    The role is HARDCODED ``'member'`` — passed as the ``$3`` bind, NEVER a function parameter
    and NEVER derived from a SAML attribute (D-168-03 / T-168-03, the Phase-167 CR-01
    greenlist-leak class; fail-closed to the lowest privilege).

    Duplicate-email tolerance (T-168-08, RESEARCH Pitfall 3): the membership keys on
    ``(org_id, user_id)`` UUID — email is not in the key. A same-email password account is a
    DIFFERENT ``auth.users`` UUID, so it provisions an INDEPENDENT membership, never conflated.

    Join-additive (D-167-01): an SSO user who already had a personal (or any other) org KEEPS
    it and simply gains this one. Returns ``{org_id, user_id, role, joined}`` where ``joined``
    is True ONLY when THIS call inserted a NEW row (a re-provision / lost race is ``False``).
    Every value is a ``$n`` bind — never f-string SQL.
    """
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Serialize concurrent first-logins on this exact (org, user) so racing provisions
            # converge (transaction-scoped; auto-released at COMMIT).
            await conn.execute(
                "SELECT pg_advisory_xact_lock(hashtext($1))",
                str(org_id) + str(user_id),
            )

            # The hard convergence guarantee: at most one membership per (org, user). The role
            # is the HARDCODED literal 'member' — never a parameter, never a SAML attribute.
            insert_tag = await conn.execute(
                "INSERT INTO public.org_members (org_id, user_id, role) "
                "VALUES ($1, $2, $3) ON CONFLICT (org_id, user_id) DO NOTHING",
                org_id,
                user_id,
                "member",
            )
            joined = _rowcount(insert_tag) == 1

    return {
        "org_id": str(org_id),
        "user_id": user_id,
        "role": "member",
        "joined": joined,
    }


# ── adoption-state derivation (server-computed, never a client flag) ──────────

def derive_adoption_state(invite_status: str | None, has_membership: bool) -> str:
    """Project (membership presence × invite status) → the roster adoption chip.

    ``active`` when a membership row exists; else ``pending`` for a still-pending invite; else
    ``not-yet-invited``. Computed server-side only.
    """
    if has_membership:
        return "active"
    if invite_status == "pending":
        return "pending"
    return "not-yet-invited"
