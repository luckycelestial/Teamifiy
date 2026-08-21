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





