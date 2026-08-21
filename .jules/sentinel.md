# Sentinel Security Journal

This file tracks critical security learnings, vulnerability patterns, and security constraints specific to this application.

## 2026-08-21 - HTTP Security Headers & Clickjacking Protection
**Vulnerability:** Application lacked standard HTTP response security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`), leaving the portal vulnerable to clickjacking within iframe embeds and MIME-type sniffing attacks.
**Learning:** Default Next.js configuration does not automatically set defensive HTTP headers; they must be explicitly configured in `next.config.ts`.
**Prevention:** Enforce security headers globally on all routes (`/:path*`) via `headers()` in `next.config.ts`.

## 2026-08-21 - Edge Middleware Registration for Server-Side Route Gating
**Vulnerability:** Role-based route protection logic was located in `src/proxy.ts` rather than the Next.js convention `src/middleware.ts`. Consequently, Next.js bypassed edge execution on `/admin`, `/evaluator`, and `/dashboard`, relying solely on client-side React `useEffect` redirects.
**Learning:** Next.js only recognizes and invokes edge middleware when defined at `src/middleware.ts` or root `middleware.ts` exporting a `middleware` function.
**Prevention:** Always maintain active edge middleware in `src/middleware.ts` with explicit route matchers to reject or redirect unauthorized page requests before any component is rendered.



