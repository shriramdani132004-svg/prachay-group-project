# Deployment Guide — PSPL Expense Voucher Management System

> **Current status: BLOCKED — no live deployment.** This repository contains
> deployment-ready configuration and this runbook, but **no hosted URL has
> been published** because no hosting provider, managed database or
> credentials were provisioned for this project. Every URL-shaped string in
> this document and in `server/render.yaml` is either `localhost` or an
> explicit `<placeholder>`. Nothing fake is presented as live.

## 1. What “deployment-ready” means here

| Artefact | Status |
| :--- | :--- |
| Production build scripts (`npm run build` in `server/` and `client/`) | ✅ present & verified |
| Environment schema with production hard-guards (`env.ts`) | ✅ refuses placeholder `JWT_SECRET`, refuses `DEMO_AUTH_ENABLED=true` in production |
| Hosting manifest (`server/render.yaml`) | ✅ present, **no secrets** (placeholders only) |
| Database migrations (`prisma migrate deploy`) | ✅ idempotent, production-safe |
| Seed script | ✅ refuses to run when `NODE_ENV=production` |
| Persistent signature volume | ⚠️ **required** — local vault is filesystem-based |
| Live hosting account / managed DB / credentials | ❌ **not provisioned → blocker** |

## 2. Exact prerequisites for a real deployment

1. **Hosting account** with HTTPS support (Render, Railway, Fly.io, a VM
   behind nginx, etc.). HTTPS is mandatory: the production session cookie
   uses the `__Host-` prefix, which browsers only send over secure origins.
2. **Managed PostgreSQL** (any provider). Unlike local development — which
   pins `127.0.0.1:5433` — production uses the provider's URL.
3. **Persistent disk or object storage** mounted at `SIGNATURE_STORAGE_DIR`.
   The current `LocalSignatureStorage` writes sharded keys
   (`aa/bb/<uuid>.png`) under that directory; an ephemeral filesystem would
   lose signatures on redeploy. On platforms with persistent volumes, mount
   one; for multi-instance hosts, swap the storage adapter for S3-compatible
   object storage (the `SignatureStorage` interface localizes the change).
4. **Injected secrets** (via the provider’s environment UI / secret store —
   never committed):
   - `DATABASE_URL` — the managed Postgres URL
   - `JWT_SECRET` — freshly generated, ≥ 64 random bytes
     (`openssl rand -base64 48`), never reused from development
   - `CORS_ORIGINS` — the exact frontend origin(s), comma-separated
5. `NODE_ENV=production`.

## 3. Build & release steps

```bash
# --- Backend -------------------------------------------------------------
cd server
npm ci
npm run build                 # prisma generate + tsc → dist/
npx prisma migrate deploy     # apply migrations (idempotent)
node dist/server.js           # or: npm start

# --- Frontend ------------------------------------------------------------
cd client
npm ci
npm run build                 # tsc -b && vite build → dist/
# Serve dist/ with any static host (or the same origin behind a proxy).
```

Never run `prisma db seed` or `prisma migrate reset` in production. The seed
script itself exits non-zero when `NODE_ENV=production`.

## 4. Environment reference

See [README §11](../README.md#11-environment-variables) and the authoritative
schema in `server/src/config/env.ts`. Production checklist:

| Variable | Production value |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | managed Postgres URL |
| `JWT_SECRET` | fresh ≥ 64-byte random secret (placeholders refused at boot) |
| `CORS_ORIGINS` | `https://app.example.com` (no wildcard — rejected) |
| `TRUST_PROXY_HOPS` | `1` when behind one reverse proxy / load balancer |
| `SIGNATURE_STORAGE_DIR` | path on the persistent volume |
| `DEMO_AUTH_ENABLED` | `false` (server refuses to start otherwise) |
| `PORT` | provider-assigned (default 3000) |

## 5. Health checks

Point the platform’s health probe at:

- `GET /api/v1/health/live` — process is up
- `GET /api/v1/health/ready` — process + database reachable

## 6. Hosting manifest

`server/render.yaml` declares a web service (Node, `npm start`, health
check path, placeholder env keys). **It contains no secret values.** Adapt
the `envVars` block to your provider; never paste real secrets into the file
that lives in git.

## 7. Post-deploy verification

1. `GET /api/v1/health/ready` → 200.
2. Login page loads over HTTPS; cookie name is `__Host-pspl_session`.
3. Provision real (non-demo) accounts; confirm `DEMO_AUTH_ENABLED` is false.
4. Upload a signature; redeploy; confirm the signature still streams
   (validates the persistent volume).
5. Run through the [DEMO_GUIDE](DEMO_GUIDE.md) flow against production.

## 8. Blocker summary (why no URL is published)

| Missing | Impact |
| :--- | :--- |
| Hosting account & deployment credentials | nowhere to deploy |
| Managed PostgreSQL instance | no production database |
| Persistent disk / object storage for signatures | would lose vault bytes on redeploy |
| TLS certificate / domain | `__Host-` cookies require HTTPS |

Until these exist, the deployment gate is **BLOCKED** and documented as such.
