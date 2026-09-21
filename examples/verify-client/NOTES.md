# /api/verify encrypted protocol — client notes

This describes the wire format these reference clients implement, and
what to do for platforms without a proper crypto library available.

## Protocol

Only applies when the server has **both** `API_ENCRYPTION_KEY` and
`API_HMAC_SECRET` set (see `.env.example`). If neither is set, `/api/verify`
accepts and returns plain JSON — fine for local dev, but not recommended
for production, since it means a proxy tool on the client's device can
read/rewrite the verdict even over HTTPS.

**Request**

```
POST /api/verify
Content-Type: application/json
X-Timestamp: <unix ms, string>
X-Signature: <hex HMAC-SHA256>

{"iv":"<base64>","tag":"<base64>","data":"<base64>"}
```

- `data` is AES-256-GCM ciphertext of `{"key":"...","device_id":"..."}` (UTF-8 JSON).
- `iv` is 12 random bytes, base64.
- `tag` is the 16-byte GCM auth tag, base64.
- `X-Signature` = `HMAC-SHA256(API_HMAC_SECRET, "${X-Timestamp}.${rawBodyString}")`,
  hex-encoded. `rawBodyString` is the *exact* JSON string sent as the body
  (not a re-serialized version — whitespace/key order matters since the
  server verifies the signature against the raw bytes it received).
- The server rejects requests whose timestamp is more than 5 minutes off
  from its own clock, and rejects a signature it's seen before (replay
  protection) — so don't reuse a request.

**Response** — same envelope shape, same header scheme, in the other
direction. Always verify `X-Signature` on the response **before**
decrypting or trusting anything in it. That's the step that actually
defeats a proxy tool rewriting `valid: false` into `valid: true` on the
client's device — the forged response won't have a valid signature
(it doesn't know `API_HMAC_SECRET`), so the client can detect and reject
it before ever looking at the decrypted content.

## Key management

- `API_ENCRYPTION_KEY` / `API_HMAC_SECRET` are **server secrets that your
  client also needs to know** — that's an inherent tension for any
  client-side license check (the client has to be able to talk to the
  server somehow). This scheme doesn't make key extraction from your
  client binary impossible, but it does make casual MITM/proxy tampering
  ineffective, which is the more common attack against license checks in
  practice.
- Don't ship the keys as an obvious plain string constant. At minimum:
  obfuscate/split them, or fetch them from a small bootstrap endpoint
  over a pinned connection at first run. For Android, consider the
  Android Keystore or splitting the key across native (JNI) code.
- Rotate both secrets if you ever suspect they've leaked — every
  connected client needs updating when you do, so plan for that.

## Language coverage

- **Node.js** (`verify-client.js`) — built-in `crypto` module, no deps.
- **Python** (`verify_client.py`) — needs `pip install cryptography requests`.
- **Kotlin/Android** (`VerifyClient.kt`) — built-in `javax.crypto`, needs
  OkHttp for networking (`com.squareup.okhttp3:okhttp`).

## Lua / Roblox (Luau)

Luau has no built-in AES-GCM or HMAC-SHA256 primitives, and hand-rolling
crypto in pure Lua without a test suite is a real way to end up with
something that *looks* like encryption but isn't — not something to ship
for something whose whole job is resisting tampering. This repo doesn't
include a Lua client for that reason. Two practical options instead:

1. **If your executor exposes a crypto library** (some do, e.g. a
   `crypt`/`syn.crypto` table with AES helpers — this varies a lot
   between Synapse X, KRNL, etc. and isn't standardized), port the
   request-building logic from `verify-client.js` using whatever
   primitives it exposes. The wire format above is exactly what you need
   to produce/consume.

2. **Put a small relay in front of `/api/verify`** — a tiny Node or
   Python service you control (can even be a few lines in a serverless
   function) that does the real encrypted+signed call to
   `/api/verify` using `verify-client.js`/`verify_client.py`, and
   returns a plain `{valid: true/false}` to the Roblox script over a
   normal HTTPS call. This is a common pattern for Roblox key systems
   generally (since `HttpService` in executors is often locked down or
   unreliable for anything beyond basic GET/POST), and it means the
   encryption keys never have to live inside a Lua script at all — only
   in the relay, which you control fully. If you want, I can build this
   relay as a small addition to this project (e.g.
   `POST /api/verify-lua` that takes plain `{key, device_id}` from the
   Roblox script over HTTPS, does the encrypted round-trip to `/api/verify`
   server-side, and returns a plain result) — say the word and I'll add it.
