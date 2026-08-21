# Sentinel Security Journal

This file tracks critical security learnings, vulnerability patterns, and security constraints specific to this application.

## 2026-08-21 - HTTP Security Headers & Clickjacking Protection
**Vulnerability:** Application lacked standard HTTP response security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`), leaving the portal vulnerable to clickjacking within iframe embeds and MIME-type sniffing attacks.
**Learning:** Default Next.js configuration does not automatically set defensive HTTP headers; they must be explicitly configured in `next.config.ts`.
**Prevention:** Enforce security headers globally on all routes (`/:path*`) via `headers()` in `next.config.ts`.

## 2026-08-21 - Next.js 16 Proxy Convention & Server-Side Route Protection
**Vulnerability:** Relying solely on client-side routing/redirects exposes backend server actions and UI bundles to unauthorized actors.
**Learning:** In Next.js 16+, Middleware is deprecated and succeeded by the **Proxy** convention (`src/proxy.ts` exporting `proxy` and `config`). Proxy intercepts all incoming requests at the server level before pages are rendered.
**Prevention:** Maintain active role-based gating and unauthenticated redirects in `src/proxy.ts`, paired with zero-trust session/role verification on every Server Action in `src/app/actions/portal.ts`.




