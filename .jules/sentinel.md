# Sentinel Security Journal

This file tracks critical security learnings, vulnerability patterns, and security constraints specific to this application.

## 2026-08-21 - HTTP Security Headers & Clickjacking Protection
**Vulnerability:** Application lacked standard HTTP response security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`), leaving the portal vulnerable to clickjacking within iframe embeds and MIME-type sniffing attacks.
**Learning:** Default Next.js configuration does not automatically set defensive HTTP headers; they must be explicitly configured in `next.config.ts`.
**Prevention:** Enforce security headers globally on all routes (`/:path*`) via `headers()` in `next.config.ts`.

## 2026-08-21 - Anti-Injection Defense (XSS & PostgREST Query Sanitization) & CSP
**Vulnerability:** User inputs (team names, problem statements, PS numbers, remarks, profile fields) were passed without centralized sanitization, and PostgREST `.or(...)` filter was constructed with raw string interpolation.
**Learning:** React escapes JSX by default, but raw user input stored in DB can be consumed by external tools (Excel exports, CSV parsers, or third-party integrations). String-interpolated PostgREST query parameters are prone to filter manipulation.
**Prevention:** 
1. Enforce strict Content Security Policy (`CSP`) in `next.config.ts`.
2. Strip HTML tags, dangerous schemes (`javascript:`, `data:`), and control chars via `src/lib/sanitize.ts`.
3. Use parameterized queries instead of raw string interpolations in PostgREST calls.

## 2026-08-22 - Secret Management & Hardcoded Fallback Token Elimination
**Vulnerability:** Fallback Supabase publishable keys were embedded as string literals in Server Action source code (`src/app/actions/portal.ts` and `src/app/actions/telemetry.ts`), which risked token exposure in public version control.
**Learning:** Fallback defaults often get copy-pasted across utility files during development. All clients should strictly source secrets and keys from environment variables and fail fast if missing.
**Prevention:** Strictly load API keys from `process.env` and throw an explicit configuration error during initialization if absent.

## 2026-08-22 - Edge & Mutation Sliding-Window Rate Limiting
**Vulnerability:** Mutation actions (team creation, PS submission, evaluation scores) and edge routes were vulnerable to rapid-fire automated floods and brute-force attempts.
**Learning:** Unrestricted mutations can overwhelm database connections and create race condition anomalies during high-velocity hackathon submission rounds.
**Prevention:** Enforce in-memory sliding-window rate limiting (`src/lib/rate-limit.ts`) at both the Edge Proxy layer (60 req/min per IP) and Server Action mutation level.
