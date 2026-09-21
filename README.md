# Key Management Platform

Full-stack license / key management system built with Next.js (App Router), TypeScript,
Tailwind CSS, Neon PostgreSQL and Drizzle ORM. Admins generate, manage, and revoke license
keys; external client apps verify keys (with per-device binding) through a public API.

---

## 1. Tech stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui-style components (Radix primitives)
- Neon serverless PostgreSQL
- Drizzle ORM
- Server Actions / Route Handlers for the backend
- HTTP-only, `SameSite` cookies for session auth (opaque token, hashed in DB — never a raw
  token or password stored anywhere)
- bcrypt for password hashing
- Zod for input validation
- Deployed on Vercel

---

## 2. Install dependencies

```bash
npm install
```

---

## 3. Set up Neon

1. Create a project at https://neon.tech.
2. Copy the **pooled** connection string from the Neon dashboard (Connection Details →
   "Pooled connection"). This is required for serverless compatibility.
3. You'll paste it into `DATABASE_URL` in the next step.

---

## 4. Environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable          | Description                                                            |
|-------------------|--------------------------------------------------------------------------|
| `DATABASE_URL`    | Neon pooled connection string                                          |
| `AUTH_SECRET`     | Random secret — generate with `openssl rand -base64 32`                |
| `APP_URL`         | Public URL of your deployment (`http://localhost:3000` for local dev)  |
| `ADMIN_EMAIL`     | Email for the admin account created by the seed script                 |
| `ADMIN_PASSWORD`  | Password for the admin account — only read once at seed time, hashed immediately, never logged |
| `CRON_SECRET` | Random secret sama dengan AUTH_SECRET - `openssl rand -base64 32` |

`.env` is already in `.gitignore` — **never commit it.**

---

## 5. Database migration

```bash
npm run db:generate   # regenerate SQL from db/schema.ts if you change the schema
npm run db:migrate    # apply migrations to your Neon database
```

A ready-to-run initial migration (`drizzle/0000_initial_schema.sql`) matching the schema is
already included, so `npm run db:migrate` works immediately after you set `DATABASE_URL`.

You can also inspect your data visually:

```bash
npm run db:studio
```

---

## 6. Seed the admin account

```bash
npm run db:seed
```

This reads `ADMIN_EMAIL` / `ADMIN_PASSWORD` from your environment, hashes the password with
bcrypt, and inserts (or updates) the admin user. The plaintext password is never written to
the database, logs, or the UI — only the bcrypt hash is stored.

---

## 7. Run the development server

```bash
npm run dev
```

Visit `http://localhost:3000` → redirects to `/login`.

---

## 8. Build

```bash
npm run build
```

---

## 9. Deploy to Vercel

1. Push this repo to GitHub/GitLab/Bitbucket.
2. Import the project in Vercel.
3. Add the same environment variables from `.env` under **Project Settings → Environment
   Variables** (`DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`).
4. Deploy. Vercel runs `npm install && npm run build` automatically.
5. After the first deploy, run the migration + seed once against your production database
   (e.g. from your local machine with the production `DATABASE_URL` set, or via a one-off
   Vercel CLI / GitHub Action step):
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

The app uses Neon's serverless HTTP driver (`@neondatabase/serverless`), so it's fully
compatible with Vercel's serverless/edge functions — no persistent connections or local
filesystem storage are used anywhere.

---

## 10. How to use the `/api/verify` API

This is the public endpoint external client apps call to check whether a license key is
valid for a given device.

**Endpoint:** `POST /api/verify`
**Auth:** none required (public), but rate-limited (30 requests/minute per IP by default).

### Plain mode vs encrypted mode

By default (no `API_ENCRYPTION_KEY` / `API_HMAC_SECRET` set), the endpoint speaks plain
JSON, shown below — fine for local development.

Once you set **both** `API_ENCRYPTION_KEY` and `API_HMAC_SECRET` (see `.env.example`), the
endpoint *requires* every request and response to be wrapped in an AES-256-GCM encrypted,
HMAC-SHA256 signed envelope instead. This matters for a license/anti-piracy endpoint
specifically because plain HTTPS only protects the wire — it does nothing against a proxy
tool (Fiddler, Charles, Frida) installed on the *client's own device*, which can still read
or rewrite `valid: false` into `valid: true` before your app ever sees it. The encrypted
envelope stops that: the client verifies the response's HMAC signature before decrypting or
trusting anything in it, and a forged response won't have a valid signature since the
attacker doesn't have `API_HMAC_SECRET`.

Full wire protocol, key-management notes, and ready-to-use client code for Node.js, Python,
and Kotlin/Android are in **`examples/verify-client/`** (see `NOTES.md` there — including
guidance for Roblox/Lua clients, which need a slightly different approach since Luau has no
built-in crypto primitives).

### Example request (plain mode)

```bash
curl -X POST https://your-app.vercel.app/api/verify \
  -H "Content-Type: application/json" \
  -d '{
    "key": "CAINTXS-AB12CD-EF34GH-IJ56KL",
    "device_id": "device-123456"
  }'
```

### Example request (encrypted mode)

```bash
API_ENCRYPTION_KEY=... API_HMAC_SECRET=... \
  node examples/verify-client/verify-client.js \
  https://your-app.vercel.app CAINTXS-AB12CD-EF34GH-IJ56KL device-123456
```

(Encrypted mode isn't practical to demo with a bare `curl` command since the body has to be
encrypted and the request signed first — use the reference client instead.)

### Example success response

```json
{
  "valid": true,
  "message": "License valid",
  "key": "CAINTXS-AB12CD-EF34GH-IJ56KL",
  "status": "active",
  "expires_at": "2026-12-31T23:59:59.000Z",
  "device_bound": true
}
```

In encrypted mode, this same object is what you get back *after* verifying the response
signature and decrypting — the raw HTTP response body is `{"iv":"...","tag":"...","data":"..."}`.

### Example failure response

```json
{
  "valid": false,
  "message": "License invalid"
}
```

### Verification flow

1. (Encrypted mode only) Verify `X-Signature`/`X-Timestamp`, reject stale or replayed
   requests, then decrypt the body.
2. Validate the payload with Zod.
3. Look up the key in the database.
4. Not found → invalid.
5. Revoked → invalid.
6. Expired → invalid (and the row is auto-transitioned to `status: expired`).
7. Active/unused:
   - Device already bound → valid.
   - Device not bound and a slot is free → bind it, valid.
   - No free slot → invalid (`device_limit_reached`).
8. `last_verified_at` is updated.
9. An activity log row is written.
10. (Encrypted mode only) The response is encrypted and signed before being sent.
11. The response never includes passwords, hashes, session tokens, or environment variables
    — in either mode.

---

## 11. Other API endpoints (admin, require login)

| Method | Endpoint                          | Description                        |
|--------|------------------------------------|-------------------------------------|
| POST   | `/api/auth/login`                  | Log in, sets HTTP-only session cookie |
| POST   | `/api/auth/logout`                 | Destroy session                    |
| GET    | `/api/licenses`                    | List/search/filter licenses (paginated) |
| POST   | `/api/licenses`                    | Generate one or many keys          |
| PATCH  | `/api/licenses/:id`                | Update status / expiry / max devices / note |
| DELETE | `/api/licenses/:id`                | Delete a license (admin only)      |
| POST   | `/api/licenses/:id/revoke`         | Revoke a license                   |
| POST   | `/api/licenses/:id/reset-device`   | Clear all device bindings for a license |
| GET    | `/api/users`                       | List users (admin only)            |
| GET    | `/api/logs`                        | Paginated activity log             |
| GET    | `/api/dashboard/stats`             | Dashboard counters + chart data    |
| GET/PATCH | `/api/settings`                 | Read / update site settings (PATCH is admin only) |

All error responses use a consistent shape:

```json
{ "success": false, "message": "License expired", "code": "LICENSE_EXPIRED" }
```

HTTP status codes: `200` valid, `400` invalid request, `401` unauthorized, `403` forbidden,
`404` not found, `409` conflict, `429` too many requests, `500` internal error.

---

## 12. Project structure

```
app/
├── login/page.tsx
├── dashboard/
│   ├── page.tsx            (overview + charts)
│   ├── keys/page.tsx        (search, filter, actions, CSV export)
│   ├── generate/page.tsx    (single + bulk generation)
│   ├── users/page.tsx
│   ├── logs/page.tsx
│   └── settings/page.tsx
├── api/
│   ├── auth/{login,logout}/
│   ├── verify/route.ts
│   ├── licenses/{route.ts, [id]/route.ts, [id]/revoke/, [id]/reset-device/}
│   ├── users/route.ts
│   ├── logs/route.ts
│   ├── settings/route.ts
│   └── dashboard/stats/route.ts
components/
├── dashboard/   (sidebar, navbar)
├── ui/          (button, input, card, label, badge, skeleton, toaster, empty-state)
lib/
├── auth/        (password.ts, session.ts)
├── license/     (generator.ts, verify.ts)
├── security/    (api-response.ts, activity-log.ts)
├── validation/  (schemas.ts)
├── rate-limit/  (index.ts)
db/
├── schema.ts
└── index.ts
drizzle/         (SQL migrations)
scripts/         (migrate.ts, seed.ts)
tests/
middleware.ts
```

---

## 13. Design system

The UI follows a "security console" direction rather than a generic SaaS look —
appropriate for a tool whose job is reading precise system state (key status, device
bindings, logs), not selling a product.

- **Color** — graphite-blue base (`--background`, `--card`), not pure black or violet, with a
  brass/gold accent (`--primary`, `#C99A4B`-ish) as the one interactive color — the material
  cue for a physical *key*. Status is shown with desaturated "LED" signal colors
  (`text-signal-success` / `-warning` / `-danger` / `-idle` in `tailwind.config.ts`) rather than
  bright candy colors.
- **Type** — IBM Plex Sans for UI chrome (headings, labels, buttons) and IBM Plex Mono
  (`font-data` utility class) for anything that's actually data: license keys, device IDs, IPs,
  timestamps, log rows. This is functional, not decorative — monospace makes it easier to
  scan characters that matter (a typo in a key or device ID is a real bug).
- **Layout** — hairline 1px borders instead of drop shadows, a small consistent border radius
  (`--radius: 0.375rem`), status shown as a dot + label (`Badge` in `components/ui/badge.tsx`)
  instead of filled pill chips, and the dashboard overview uses a single bordered "readout
  strip" (divided cells, mono numerals) instead of a grid of identical icon cards.
- **Motion** — deliberately minimal. The only animated element is the pulsing "System nominal"
  dot in the navbar (`.signal-dot--live` in `globals.css`, respects `prefers-reduced-motion`).
  Nothing else animates on hover/load, on purpose.

If you add new UI, reuse the existing tokens (`hsl(var(--signal-success))`, etc. — see
`app/globals.css`) rather than introducing new ad hoc colors, and reach for `font-data` any
time you're rendering a key, ID, IP, or timestamp.

## 14. Security notes

- Passwords are hashed with bcrypt (cost factor 12) — plaintext is never stored or logged.
- Sessions are opaque random tokens (32 bytes, CSPRNG). Only a SHA-256 hash of the token is
  stored in the `sessions` table; the raw token lives only in an **HTTP-only**, `SameSite=Lax`
  cookie (never `localStorage`).
- License keys are generated with Node's `crypto.randomBytes` (CSPRNG) — never `Math.random()`
  — using an alphabet that excludes visually ambiguous characters (`0/O`, `1/I`).
  `licenses.key` has a database-level unique constraint as a final safety net against
  collisions.
- `/api/verify` is public but rate-limited (30 req/min/IP by default); `/api/auth/login` is
  rate-limited to 10 attempts/5 minutes/IP. Failed logins return an identical generic error
  regardless of whether the email exists, to avoid user enumeration.
- All `/dashboard/*` routes are protected by `middleware.ts` (redirect to `/login` if no
  session cookie) and re-validated server-side on every request via `requireUser()` /
  `requireAdmin()`.
- Role-based access control: destructive actions (delete license, view/manage users, change
  settings) require the `admin` role.
- Every input is validated with Zod before touching the database (protects against malformed
  data and reduces injection surface); Drizzle's parameterized queries prevent SQL injection.
- API responses are passed through `stripSensitive()` / never select password hashes or
  token hashes, so credentials can't leak even by accident.
- Security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`) are set globally in `next.config.mjs`.
- No secrets are hardcoded anywhere in source — everything sensitive comes from environment
  variables, and the admin password is supplied only at seed time via `ADMIN_PASSWORD`.
- `/api/verify` supports an optional encrypted+signed transport (AES-256-GCM + HMAC-SHA256,
  `lib/security/crypto.ts`) on top of HTTPS, for when the client is untrusted (e.g. a
  distributed app where someone could run a proxy tool on their own device). See §10 and
  `examples/verify-client/NOTES.md`. Off by default (plain JSON) until you set
  `API_ENCRYPTION_KEY` + `API_HMAC_SECRET`.

### Scaling the rate limiter

The included rate limiter is in-memory, which is best-effort per serverless instance. For
strict, globally-consistent limits across all instances, swap `lib/rate-limit/index.ts` for
Vercel KV or Upstash Redis — the function signature is intentionally simple so this is a
drop-in change.

### Scaling replay protection

Same caveat as the rate limiter: `checkAndRecordReplay()` in `lib/security/crypto.ts` is an
in-memory Set, best-effort per instance. For strict cross-instance replay protection when
running encrypted mode at scale, back it with Vercel KV / Upstash Redis instead.

---

## 15. Testing

```bash
npm test
```

Included:
- Key generator tests (format, ambiguous-character exclusion, uniqueness, bulk generation)
- Password hashing tests (login / invalid login)
- Zod validation tests (API validation, generate-key input)
- Integration tests for the full verification flow (device binding, max-device limit,
  expired key, revoked key, unknown key) — these run only when `DATABASE_URL` is set, so
  point them at a disposable Neon branch:
  ```bash
  DATABASE_URL=postgres://... npm test
  ```

---

## 16. Notes

- Dummy/placeholder data is used only for empty-state UI — every dashboard number, table
  row, and log entry comes from the real database.
- All buttons in the dashboard (generate, revoke, delete, reset device, export) perform real
  database writes/reads through the API routes above; nothing is mocked.
