# 270 Wave-0 spike — what Storage does with `download=<filename>` (P-05)

Measured 2026-10-02, LOCAL stack only, storage-api `1.54.1` (`GET /storage/v1/version`).
Method: upload a 14-byte probe object to the local `documents` bucket, `create_signed_url(path, 60,
{"download": "Q3 report – Bob's (final).pdf"})` (space, en-dash, apostrophe, parentheses), then GET it with and
without an `Origin` header. Only headers are recorded here — no signed URL, no key.

## Measured headers

```
Content-Disposition: attachment; filename=Q3%20report%20%E2%80%93%20Bob's%20(final).pdf; filename*=UTF-8''Q3%20report%20%E2%80%93%20Bob's%20(final).pdf
Access-Control-Allow-Origin: *          (with and without Origin: http://localhost:5173)
Content-Type: application/pdf
OPTIONS preflight: 200, Access-Control-Allow-Origin: *
```

## Reading

- The header carries an RFC 5987 `filename*=UTF-8''…` parameter that percent-encodes the space, the en-dash
  (`%E2%80%93`) and keeps the apostrophe. Browsers prefer `filename*` over `filename=`, so the saved name is the
  original `Q3 report – Bob's (final).pdf` byte-exact. The plain `filename=` is percent-encoded literally (it would
  only be used by a client that ignores `filename*`; none of our supported browsers do).
- `Access-Control-Allow-Origin: *` is present, so a blob fetch would also work (not needed).

## Decision: NAVIGATION

`startDocumentDownload` saves via a transient `<a href=signedUrl>` that is appended, clicked and removed inside the
same call. The server-set `Content-Disposition` keeps the original filename; no bytes pass through page memory, and
the URL is never stored. The BLOB arm (`fetch` + `a.download = filename`) is NOT implemented.

## Owed

- The CLOUD half of this spike (hosted storage-api version may differ) is owed at the production parity step
  (270-05). If cloud mangles or drops `filename*`, switch the save step to BLOB — the change is contained in
  `frontend/src/lib/documentDownload.ts`.

## Cleanup

The scratch object (`<uuid>/spike-270/probe.pdf` in the local `documents` bucket) was deleted by the script's
`finally` block (`scratch deleted` printed). Nothing was left in storage and no key or signed URL is recorded here.
