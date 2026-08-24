---
phase: 190-live-connector-slice-connector-security-stretch
plan: 07
subsystem: backend-security
tags: [egress, dns-pinning, toctou, ssrf, redirects, decompression-bomb, tls-sni, smtp, conn-03, red-first, falsification, wave-2]

# Dependency graph
requires:
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 02
    provides: "PinnedDestination(ip, hostname, port, scheme), validate_destination, EgressRefused and the closed six-code table — including `redirected`, declared there and RAISED here"
provides:
  - "send_pinned_http — the ONLY place a connector HTTP socket is opened (D-05); validates once, connects to the validated IP, restores TLS identity via extensions['sni_hostname'] + Host, refuses redirects explicitly, caps the wire AND the decompressed body, and returns an UNINTERPRETED (status, headers, body)"
  - "open_pinned_smtp — the ONLY place a connector SMTP socket is opened; _host set BEFORE connect(validated_ip, port), implicit-TLS 465 and STARTTLS 587, blocking half wrapped in run_in_threadpool"
  - "EgressResponseTooLarge / EgressResponseUndecodable — named terminals, so a capped read is distinguishable from a transport failure"
  - "PinnedResponse — deliberately carries NO success flag (T13)"
  - "backend/tests/unit/test_190_residual_fence.py — RESIDUAL-190-01 with two positive controls, driven RED against a simulated library change"
  - "The raise site for `redirected` — the code 190-02 declared and left unraised"
affects: [190-08, 190-10, 190-11, 190-13, 190-14, 190-secure-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Validate once -> rewrite the URL to the IP literal -> restore identity by name: the TCP target is the validated address, the certificate is still checked against the hostname"
    - "Cap the response TWICE — wire bytes via aiter_raw and decompressed bytes via a bounded zlib decompressobj — because either cap alone has a measured hole"
    - "trust_env=False on a security client: an ambient HTTPS_PROXY would route a pinned connection through a host nothing validated, with every test still green"
    - "A residual risk on a non-public library attribute is mitigated by an inspect-source fence with its own positive control, driven RED against a SIMULATED upgrade"
    - "Resolve not-yet-existing symbols through a named `_require` helper so the RED is N named failures instead of one collection error that silences the whole file"

key-files:
  created:
    - backend/tests/unit/test_190_residual_fence.py
  modified:
    - backend/app/security/egress.py
    - backend/tests/unit/test_190_egress.py

key-decisions:
  - "A 3xx RAISES EgressRefused(reason_code='redirected') rather than being returned to the caller — the plan's task text said return it, but handing a bare 30x to an adapter leaves the bypass one adapter line away, and 190-02 explicitly owed this plan the raise site"
  - "The body is read with aiter_raw + a bounded zlib decompress, NOT httpx's aiter_bytes — MEASURED: httpx delivered a 5 MB gzip bomb as ONE decoded chunk, so a between-chunks cap has already paid for the memory before it runs"
  - "trust_env=False on the AsyncClient — an environment proxy is an un-validated hop that would silently defeat the pin"
  - "Accept-Encoding: identity is requested by default, shrinking the bomb surface to servers that ignore it (which _decode_bounded still handles)"
  - "PinnedResponse carries no success flag: Slack's 200-with-ok:false and Jira's status codes disagree, and flattening that here IS the T13 defect"
  - "tls_mode is DERIVED from the validated scheme; an explicit tls_mode that disagrees raises rather than winning, because two sources of truth is how smtps:// becomes a cleartext session"
  - "The six new tests resolve the binders through _require rather than a module-scope import, deliberately choosing six NAMED failures over one collection error"

patterns-established:
  - "A plant harness must use read_bytes/write_bytes and print the raw AND LF-normalised md5 either side — a byte-exact in-process restore is stronger than a git-checkout restore on Windows, and it shows"
  - "When prose in production source would trip the very grep it describes, rewrite the sentence rather than accepting the conflict"

requirements-completed: [CONN-03]

# Metrics
duration: 62min
completed: 2026-08-08
---

# Phase 190 Plan 07: The Two DNS-Pinned Transport Binders Summary

**The connector socket now goes to the address that was validated, not to whatever DNS says
next — and that is a measurement rather than a claim: with `copy_with(host=ip)` deleted from
production source the suite named `slack.com` where `142.250.185.78` belonged, with
`follow_redirects=True` the captured log shows **twenty real requests to
`http://169.254.169.254/latest/meta-data/`**, and with the size cap removed a 5 KB body that
expands to 5 MB sailed through. All three restored byte-identically.**

## Performance

- **Duration:** ~62 min
- **Tasks:** 3, each committed individually
- **Files:** 3 (1 created, 2 modified) — **1052 insertions / 4 deletions**, zero files deleted
- **Suite:** `test_190_egress.py` + `test_190_residual_fence.py` → **82 passed, 0 failed**
- **Dependencies added:** none (`git diff --numstat` over all three commits on
  `backend/requirements.txt` and `frontend/package.json` prints nothing — T-190-SC)

## Task Commits

| Task | Name | Commit |
|---|---|---|
| 1 | The six binder cases, RED first | `2c437a69` |
| 2 | The two binders in `egress.py`, corpus driven green | `31eeae5a` |
| 3 | The RESIDUAL-190-01 fence + the three falsification plants | `673599b9` |

---

## ⭐ THE RED THAT MATTERS — and why it is not the usual weak one

`test_190_egress.py` already existed, so a module-scope
`from app.security.egress import send_pinned_http` would have produced a **collection error**:
one error, **zero** failing tests, and the 71 validator cases from plan 190-02 silenced. Plans
190-01 and 190-02 both recorded that shape as the weak kind of RED — it measures the import
system. The binders are therefore resolved through a `_require(name)` helper, and the Task-1
observation is:

```
>       send_pinned_http = _require("send_pinned_http")
tests\unit\test_190_egress.py:1039:
E       AssertionError: app.security.egress.send_pinned_http does not exist yet - plan 190-07
        owns it. D-05: the two transport binders live in egress.py and NOWHERE else; no
        connector adapter may construct an httpx or smtplib client.
E       assert None is not None
tests\unit\test_190_egress.py:677: AssertionError
FAILED …::test_T2_the_socket_goes_to_the_CALL_ONE_ip_not_a_reresolved_one
FAILED …::test_T2b_the_TLS_identity_survives_the_pin
FAILED …::test_T3_a_302_to_the_metadata_endpoint_is_NOT_followed
FAILED …::test_T11_an_oversized_response_is_capped_and_fails_cleanly
FAILED …::test_T11b_a_gzip_bomb_is_capped_on_the_DECOMPRESSED_size
FAILED …::test_every_pinned_call_carries_a_timeout
6 failed, 71 passed, 1 warning in 0.75s     (exit code 1)
```

Six **named** failures, the corpus green either side of them. `_require` also asserts
`__all__` membership, so a binder that exists but is not exported fails here rather than in an
adapter three plans later. (Line-number honesty, the 190-01 lesson: pasting this into the file
moved both frames; iterated to the fixed point `:1039` / `:677`, re-run confirming.)

---

## THE THREE FALSIFICATION PLANTS (T2 · T3 · T11)

Each is a real edit to **`backend/app/security/egress.py` itself**, run plant → observe →
restore, by a harness using `read_bytes`/`write_bytes` (190-06's measured lesson:
`read_text`/`write_text` normalises LF → CRLF and silently breaks byte identity).

### PLANT T2 — `url.copy_with(host=pinned.ip)` replaced by the hostname URL → **2 failed, 75 passed**

```
    assert 'slack.com' == '142.250.185.78'
      - 142.250.185.78
      + slack.com
------------------------------ Captured log call ------------------------------
INFO  httpx:_client.py:1740 HTTP Request: POST https://slack.com/api/chat.postMessage "HTTP/1.1 200 OK"
E   AssertionError: the TCP target is not the validated IP
tests\unit\test_190_egress.py:807: AssertionError
FAILED tests/unit/test_190_egress.py::test_T2_the_socket_goes_to_the_CALL_ONE_ip_not_a_reresolved_one
FAILED tests/unit/test_190_egress.py::test_T2b_the_TLS_identity_survives_the_pin
2 failed, 75 passed, 1 warning in 0.39s
```

**Read the captured log line, not only the assertion.** Under the plant httpx logs
`POST https://slack.com/…` — the request goes out **by name**, which is precisely the
re-resolution the pin removes. The stub's second DNS answer is `127.0.0.1`.

### PLANT T3 — `follow_redirects=True` → **1 failed, 76 passed**

```
E   httpx.TooManyRedirects: Exceeded maximum allowed redirects.
------------------------------ Captured log call ------------------------------
INFO  httpx:_client.py:1740 HTTP Request: POST https://142.250.185.78/api/chat.postMessage "HTTP/1.1 302 Found"
INFO  httpx:_client.py:1740 HTTP Request: GET http://169.254.169.254/latest/meta-data/ "HTTP/1.1 302 Found"
INFO  httpx:_client.py:1740 HTTP Request: GET http://169.254.169.254/latest/meta-data/ "HTTP/1.1 302 Found"
… (twenty in total)
C:\…\httpx\_client.py:1687: httpx.TooManyRedirects: Exceeded maximum allowed redirects.
FAILED tests/unit/test_190_egress.py::test_T3_a_302_to_the_metadata_endpoint_is_NOT_followed
1 failed, 76 passed, 1 warning in 0.69s
```

**This is the strongest evidence in the plan and it is stronger than the assertion that
caught it.** The failure is not "an assertion about redirects was violated" — it is twenty
logged HTTP requests to the cloud metadata endpoint, each one a validated destination handing
the connection to an unvalidated one. Note also that the FIRST line still reads
`https://142.250.185.78/…`: the pin held, and the redirect walked straight around it. **A pin
without `follow_redirects=False` is not a guard.**

### PLANT T11 — all three size caps removed → **2 failed, 75 passed**

(the `Content-Length` pre-check, the `aiter_raw` wire cap, and `decompress`'s `max_length`)

```
E   Failed: DID NOT RAISE <class 'Exception'>
INFO  httpx:_client.py:1740 HTTP Request: POST https://142.250.185.78/api/chat.postMessage "HTTP/1.1 200 OK"
tests\unit\test_190_egress.py:941: Failed: DID NOT RAISE
E   Failed: DID NOT RAISE <class 'Exception'>
tests\unit\test_190_egress.py:989: Failed: DID NOT RAISE
FAILED tests/unit/test_190_egress.py::test_T11_an_oversized_response_is_capped_and_fails_cleanly
FAILED tests/unit/test_190_egress.py::test_T11b_a_gzip_bomb_is_capped_on_the_DECOMPRESSED_size
2 failed, 75 passed, 1 warning in 0.66s
```

Both cases go RED together, which is the point of having two: the 200 KB body and the 5 KB
body that becomes 5 MB are the same DoS wearing different clothes.

### The two RESIDUAL-190-01 fence plants — each turned exactly its own case RED

| Plant | Simulates | Result |
|---|---|---|
| **A** — `_smtp_connect_source()` retargeted at `smtplib.SMTP.__init__` | a future CPython whose `connect()` **does** assign `self._host` | `assert '_host' not in "    def __i…s]' % addr\n"` → **1 failed, 4 passed** |
| **B** — `_httpcore_connection_source()` with `.replace("sni_hostname", "REMOVED")` | an httpx upgrade that drops the request extension | `assert 'sni_hostname' in 'from __future__ import annotations…'` → **1 failed, 4 passed** |

⚠ **Stated rather than smoothed:** pytest printed its own containment diff in place of the
custom `RESIDUAL-190-01 … HAS FIRED` message, because the compared source is thousands of
characters long. The message is in the file and will be shown by `-vv`; what the transcript
above proves is *which* case went red, which is the load-bearing part.

### The restore proof — byte-exact, and stronger than 190-02 could manage

| File | raw md5 before → after | LF-normalised md5 | `git diff --numstat` |
|---|---|---|---|
| `backend/app/security/egress.py` | `5284827f9c0be6baee9945694c246d9f` → **identical** | `c99c42e0178a0da49b09661e1518429d` → **identical** | empty |
| `backend/tests/unit/test_190_residual_fence.py` | `6b16c94a18a31d7fd93826acd6813ab3` → **identical** | identical | empty |

`git hash-object backend/app/security/egress.py` → `cd4d21fff3a1fd675cb3496b6b9233fdc037b8f8`.

⚠ **190-02 recorded that the plan's "md5 identical after restore" criterion is unsatisfiable
on this platform because `git checkout` re-applies CRLF. That is true of a git-based restore
— and it is avoidable.** This plan's harness holds the original bytes in memory and writes
them back with `write_bytes`, so git never touches the file and the **raw** md5 matches too.
Recommended for every future plant round in this repo.

`grep -c PLANT` → **0** in `backend/app/security/egress.py` and **0** in
`backend/tests/unit/test_190_egress.py`. (`test_190_residual_fence.py` carries **2**, both
prose — the docstring naming PLANT A and PLANT B, exactly the legibility 190-06 argued for;
the acceptance criterion names the other two files.)

---

## ⭐ RESIDUAL-190-01 — the block `/gsd:secure-phase 190` should carry, verbatim

> ### RESIDUAL-190-01 — both DNS-pin recipes depend on non-public attributes
>
> **Status:** accepted residual risk, fenced. Not a defect, not an open threat.
>
> **The risk.** `smtplib.SMTP._host` is a private attribute, and `SMTP.connect()`'s
> non-assignment of it is an implementation detail rather than a documented contract;
> `httpcore`'s `sni_hostname` request extension is an httpx/httpcore internal convention
> rather than a versioned public API. A CPython or httpx minor upgrade could silently break
> the pin **while every functional test still passes** — an un-pinned connection simply
> re-resolves the hostname and still works. There is no error, no failed test and no log
> line; the only consequence is that the DNS-rebinding TOCTOU window `egress.py` exists to
> close is quietly re-opened.
>
> **The two attributes it depends on.**
> 1. `smtplib.SMTP._host` — set by `egress._open_pinned_smtp_blocking` before
>    `connect(validated_ip, port)`; read by `SMTP_SSL._get_socket` and `SMTP.starttls` as
>    `wrap_socket(..., server_hostname=self._host)`.
> 2. `request.extensions["sni_hostname"]` — set by `egress.send_pinned_http`; read by
>    `httpcore._async.connection` and passed into `start_tls(server_hostname=...)`.
>
> **The fence that guards it:** `backend/tests/unit/test_190_residual_fence.py` — asserts
> `"_host" not in inspect.getsource(smtplib.SMTP.connect)` and
> `"sni_hostname" in inspect.getsource(httpcore._async.connection)`, each with its own
> positive control, and each observed RED against a simulated library change.
>
> **Trigger:** any Python or httpx **version bump in requirements.txt**.
>
> ⚠ **Measured caveat on that trigger, which makes the fence more load-bearing, not less:**
> `backend/requirements.txt:38` reads `httpx>=0.28.0` — an unpinned upper bound (D-071.3-10,
> after the Docling rip removed the `<0.29` cap). An httpx move can therefore land on any
> fresh install or container rebuild **with nobody editing `requirements.txt` at all**, so a
> reviewer-facing trigger alone would never fire. What actually protects the pin is that the
> fence runs on every test run, against the **installed** library rather than the declared
> one.
>
> **Environment when written (re-derived, not inherited):** httpx **0.28.1**, httpcore
> **1.0.9**, CPython **3.12.6**.

---

## Accomplishments

- **`egress.py` 421 → 755 lines.** The module docstring's SCOPE paragraph, which previously
  read *"this module validates and pins. It opens NOTHING"*, was rewritten in the same commit
  that made it false — the binders are now named there, and so is RESIDUAL-190-01.
- **The pin is three lines and each one is load-bearing:** `copy_with(host=pinned.ip)` (the
  TCP target), `Host: hostname` (HTTP identity), `extensions["sni_hostname"]` (TLS identity).
  T2 falsifies the first; T2b asserts the other two directly, because *a pin that loses SNI is
  a worse bug than the one it fixes* — it points certificate hostname verification at an
  address no certificate carries, and the "fix" somebody reaches for next is `verify=False`.
- **The SMTP pin is asserted at the only moment it can be:** the fake records `self._host`
  **inside `connect()`**, because `SMTP_SSL` wraps the socket there — a test that read the
  attribute afterwards would pass over exactly the defect it was written for.
- **`follow_redirects=False` is proved two independent ways**: behaviourally (one request
  reached the transport) and by **reading the recorded `client.send` kwargs** through a spy.
  The behavioural half alone stays green over a binder that passes nothing, and would flip the
  day httpx changes its default.
- **`EgressRefused(reason_code="redirected")` now has a raise site** — the code 190-02
  declared and left unraised, closing that Known Stub.
- **Timeouts are asserted three ways**: `timeout` is keyword-only **with no default** on both
  binders (`inspect.signature`), the request carries `extensions["timeout"]` with all four
  phases bounded, and the smtplib construction receives it as a keyword.
- **`smtplib` never touches the event loop** — the blocking half is a module-private function
  and the only exported entry point is `async`, going through `run_in_threadpool` with
  SEED-065's measured incident quoted at the call site.

## Deviations from Plan

### 1. [Rule 2 — missing critical functionality] A 3xx RAISES rather than being returned

The plan's Task-1 text says *"assert the client returns the 30x to the caller"*. **It raises
`EgressRefused(reason_code="redirected")` instead**, and the test asserts that.

- **Why:** phase rule 2 and 190-02's own hand-off both say *this plan owns the `redirected`
  raise site*; a code declared in a closed table and never raised is a stub. More
  importantly, handing a bare 302 back to an adapter leaves the bypass **one adapter line
  away** — the next author writes `if resp.status_code == 302: follow(resp.headers["location"])`
  and the guard is gone. The security property the plan actually asks for is preserved and
  asserted verbatim: exactly one request reached the transport, and `follow_redirects=False`
  was read off the recorded send call.
- **The refusal names no URL** — only the Location **host**, and only in the log line (D-08);
  the test asserts `169.254.169.254` does not appear in the exception message.

### 2. [Rule 2] The body is read with `aiter_raw` + a bounded `zlib`, not `aiter_bytes`

- **Found during:** a pre-Task-1 probe, run rather than assumed.
- **Measured:** a 5 MB body of one repeated byte gzips to **5 129 bytes**, and
  `response.aiter_bytes()` delivered the **entire 5 MB as ONE chunk**. A cap applied between
  chunks has therefore already spent the memory before it runs — it caps the *return value*,
  not the cost, which is T11's DoS with a tidier traceback.
- **Fix:** cap the **wire** bytes with `aiter_raw`, then expand with
  `zlib.decompressobj().decompress(raw, max_bytes + 1)`, which bounds the **output**. Both
  caps exist because each alone has a hole. `EgressResponseUndecodable` was added for an
  encoding this module will not expand or a body that ends mid-stream, because returning
  still-compressed bytes to an adapter is a silent wrong answer.
- **Also measured:** `httpx.Response(..., content=b"…")` is already consumed and `aiter_raw()`
  raises `StreamConsumed`, so the test fixtures use real streams — recorded in `_ChunkStream`'s
  docstring, since it is the sort of thing that costs the next author twenty minutes.

### 3. [Rule 2] `trust_env=False` on the client

Not in the plan. An ambient `HTTPS_PROXY`/`ALL_PROXY` would route the connection through a
host **nothing validated** — the pin would be silently worthless with every test still green,
which is the same failure mode as RESIDUAL-190-01 and deserved the same treatment. Stated at
the line as a security setting rather than tidiness. `Accept-Encoding: identity` is requested
by default for the same defence-in-depth reason.

### 4. [Rule 2] `tls_mode` is derived, and a contradicting value raises

The plan's signature takes `tls_mode`, but the destination string already carries its scheme
and `validate_destination` refuses anything that is not `smtps://` or `smtp+starttls://`. Two
sources of truth for "is this session encrypted" is how an `smtps://` destination quietly
becomes a cleartext one, so the parameter is kept, derived when absent, and **raises** when
it disagrees with the validated scheme.

### 5. [Recorded] An acceptance criterion needed a sentence rewritten, not a conflict declared

Task 2's criterion requires `grep -c "\.sendmail(" egress.py` → `0`, while the docstring
naturally wants to *say* the binder calls no such API. Measured at **1** on the first run —
the prose tripping the grep it describes. 190-06 hit this shape and had to STATE the conflict;
here the sentence was simply rewritten to describe the ban without spelling the token, with a
comment saying why. Final count: **0**.

### 6. [Measured correction] RESIDUAL-190-01's stated trigger cannot fire for httpx

`requirements.txt:38` is `httpx>=0.28.0` with **no upper bound**, so "watch for a version bump
in `requirements.txt`" would never fire — the version can move on a rebuild with no file
change. Recorded in the fence docstring and in the SECURITY.md block above rather than left
to be discovered when it matters.

---

## Verification (run, not quoted)

| Check | Result |
|---|---|
| `pytest tests/unit/test_190_egress.py tests/unit/test_190_residual_fence.py -q` | **82 passed, 0 failed** |
| `pytest tests/unit/test_190_egress.py -q` | **77 passed** (71 inherited + 6 new) |
| `pytest tests/unit/test_190_residual_fence.py -q` | **5 passed** (plan asks ≥ 2, each with its control in the same test) |
| `pytest tests/test_harness_engine.py -q` | **46 passed** — matches §M2 / 190-01 / 190-02 exactly |
| `grep -c PLANT` egress.py / test_190_egress.py | **0 / 0** |
| `grep -c "follow_redirects=False" egress.py` | **3** (≥ 1 required) |
| `grep -c "sni_hostname" egress.py` | **3** |
| `grep -cE "run_in_threadpool\|asyncio.to_thread" egress.py` | **3** |
| `grep -c "\.sendmail(" egress.py` | **0** |
| `grep -c "RESIDUAL-190-01"` egress.py / fence | **3 / 4** |
| `'copy_with' in src, 'Timeout' in src` (send_pinned_http) | **True True** |
| `'send_pinned_http' in __all__, 'open_pinned_smtp' in __all__` | **True True** |
| `inspect.iscoroutinefunction(open_pinned_smtp)` | **True** |
| `git diff --numstat` over all 3 commits — requirements.txt / package.json | **empty** (T-190-SC) |
| File deletions in any of the three commits | **none** |

**Known pre-existing REDs, unchanged and not regressions** (both documented in 190-02 / 190-06
as owed by **190-13**): `test_189_no_egress.py::test_a_bound_connection_under_the_armed_sentinel_MUST_attempt_egress`
(the executor still sends nothing) and the three `test_190_egress_ordering.py` cases.

## Threat-model dispositions honoured

| Threat ID | How it was met |
|---|---|
| T-190-07-T2 | `copy_with(host=pinned.ip)`; resolver stub answers public then `127.0.0.1`; the socket asserted to the call-1 address AND the destination asserted resolved exactly **once**. Plant observed RED, with the plant's own log line showing the request going out by NAME |
| T-190-07-T2b | `extensions["sni_hostname"]` + `Host` (httpx) and `_host` captured **at connect time** (smtplib), asserted directly |
| T-190-07-T3 | `follow_redirects=False` passed explicitly, read off the **recorded send call**; a 3xx raises `redirected`. Plant observed RED — twenty logged requests to the metadata endpoint |
| T-190-07-T11 | Wire cap (`aiter_raw`) + decompressed cap (bounded `zlib`) + `Content-Length` pre-check + explicit `httpx.Timeout`; the stream's own pull count proves the read was abandoned, not buffered. Plant observed RED on both cases |
| T-190-07-RES | RESIDUAL-190-01 named, fenced with two positive controls, both driven RED against a simulated upgrade, and the block above drafted for SECURITY.md with its trigger and its measured caveat |
| T-190-07-BLOCK | The blocking connect is module-private; the only export is `async` and goes through `run_in_threadpool` (D-v2.5-01, SEED-065 quoted at the line) |
| T-190-SC | Zero installs — `httpx` was already declared; `smtplib`, `ssl`, `zlib`, `socket` are stdlib |

## Known Stubs

**None, and one CLOSED.** `redirected` — declared in `REFUSAL_REASONS` by 190-02 and recorded
there as *"RAISED in plan 190-07"* — is now raised in `send_pinned_http`, with a driven case.
All six codes in UI-SPEC §4c's closed table now have a raise site.

Two things are **deliberately absent** rather than stubbed, and belong to named later plans:
the **standing `connectors/**` source fence** (190-14's `test_190_connector_source_fence.py`
— this file fences the half that can be falsified today, with its matcher's non-inertness
proved) and every **adapter** (190-08 / 190-10 / 190-11). No adapter exists to bypass the
binders yet, which is why the D-05 fence here states its non-vacuity rather than assuming it.

## Threat Flags

**None outside this plan's `<threat_model>`.** This plan opened no network endpoint, no auth
path, no file access and no schema change. It does introduce the first outbound-socket code in
the connector slice — which is precisely what T2 / T2b / T3 / T11 / RES were written against,
each dispositioned above.

## Scope / rule notes

- **D-32 scope fence honoured:** no adapter, no MCP client, no webhook, no public API, no
  retries/queue, no expression language, no migration, no frontend file opened.
- **G-5 hot-file ledger:** `backend/app/security/egress.py` is 2 plans old (190-02, 190-07) —
  under the ≥ 3 threshold; no refactor recommendation is due.
- **CLAUDE.md `graphify update .` run** after the production-source change (`graphify-out/` is
  untracked, so no artefact entered any commit).
- **No `xfail`, `skip` or `skipif`** in either test file.

## Next Phase Readiness

**Ready.** What downstream plans inherit and owe:

| Owed by | What |
|---|---|
| **190-08** (SMTP adapter) | `await open_pinned_smtp("send_email", "smtps://<org host>", 465, timeout=…, allowed_host=<org host>)` returns an OPEN session. Compose with `EmailMessage`, send with `send_message` — the raw-string send API is banned by the D-05 fence, and `EmailMessage` already raises on CR/LF (§R13). **`allowed_host=` is not optional**: without it the guard fails closed |
| **190-10 / 190-11** (Slack / Jira) | `send_pinned_http` returns `PinnedResponse(status_code, headers, body)` and **interprets nothing**. Slack success is `status == 200 AND json()["ok"] is True` (T13); Jira uses real status codes. `auth=(email, api_token)` is passed through to httpx — do not hand-roll base64 |
| **190-13** | Unchanged: the W0-3 ordering RED, the D-16 golden-run gate in the same commit as the send, and importing `validate_destination` / `resolve_connection` into `phase_types`' own namespace |
| **190-14** | The standing `connectors/**` fence. The banned-token tuple and its non-inertness control are already written here and can be lifted verbatim |
| **`/gsd:secure-phase`** | T2, T3 and T11 each have a driven falsification above; RESIDUAL-190-01's SECURITY.md block is drafted verbatim, including the literal trigger *version bump in requirements.txt* and the measured caveat that the httpx bound is unpinned |

**One thing not to re-litigate:** the body reader does not use `aiter_bytes()` for a measured
reason. Switching to it re-opens the decompression bomb, and the test that would catch it is
`test_T11b`.

## State bookkeeping — hand-edited, and why

**The SDK state verbs were NOT called.** D-190-DEF-01 has four recorded occurrences this
phase, the most recent (190-06) where both verbs *reported doing nothing* while deleting 39
lines including `stopped_at` and three history blocks. `STATE.md` and `ROADMAP.md` were copied
aside first and edited by hand, per the plan-03/04/05/06 convention, then diffed:

| File | `git diff --numstat` | What the deletions are |
|---|---|---|
| `.planning/STATE.md` | **18 / 7** | 3 frontmatter lines replaced (the old `last_activity` preserved as `last_activity_prev`, the old `stopped_at` **demoted to a 7th history block**, not dropped) + 4 Current-Position lines rewritten. History blocks **6 → 7**. |
| `.planning/ROADMAP.md` | **2 / 2** | the `190-07` checkbox and the progress cell, both rewritten in place |

⚠ **Measured, and deliberately NOT "fixed":** `STATE.md`'s YAML frontmatter was **already
unparseable before this plan touched it** (`yaml.safe_load` on the pre-edit copy fails at line
13 with *"found character '`' that cannot start any token"*). After the hand-edit it still
fails, now at line 7. **Repairing it is the obvious move and 190-06 measured it to be the
wrong one:** the SDK verbs parse the markdown BODY, so fixing the frontmatter would not have
prevented any of the four corruptions and could turn a loud error into a silent successful
rewrite of the body. Recorded rather than tidied.

**`REQUIREMENTS.md` deliberately NOT marked.** This plan's frontmatter claims CONN-03, but the
phase convention set by 190-01 (D-190-DEF-02) and followed by 190-05 / 190-06 marks CONN-02
and CONN-03 **together at phase close**. CONN-03 SC#2 — the unconditional egress guard on a
real send — is unmet until 190-13 lands the send at all; marking it now would assert a
capability that does not exist, in the phase whose whole discipline is not over-claiming.

## Self-Check: PASSED

| Claim | Result |
|---|---|
| `backend/app/security/egress.py` | FOUND (755 L) |
| `backend/tests/unit/test_190_egress.py` | FOUND (1105 L) |
| `backend/tests/unit/test_190_residual_fence.py` | FOUND (225 L) |
| commit `2c437a69` (Task 1) | FOUND |
| commit `31eeae5a` (Task 2) | FOUND |
| commit `673599b9` (Task 3) | FOUND |
| `egress.py` contains `sni_hostname` | CONFIRMED (3) |
| Suite green | 82 passed, 0 failed |
| No file deletions in any commit | CONFIRMED |
| `grep -c PLANT` egress.py / test_190_egress.py | 0 / 0 |

---
*Phase: 190-live-connector-slice-connector-security-stretch*
*Completed: 2026-08-08*
