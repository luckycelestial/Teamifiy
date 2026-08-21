# Sentinel Security Journal

This file tracks critical security learnings, vulnerability patterns, and security constraints specific to this application.

## 2026-08-21 - HTTP Security Headers & Clickjacking Protection
**Vulnerability:** Application lacked standard HTTP response security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`), leaving the portal vulnerable to clickjacking within iframe embeds and MIME-type sniffing attacks.
**Learning:** Default Next.js configuration does not automatically set defensive HTTP headers; they must be explicitly configured in `next.config.ts`.
**Prevention:** Enforce security headers globally on all routes (`/:path*`) via `headers()` in `next.config.ts`.

## 2026-08-21 - Server Action Authorization Hardening (Zero-Trust Beyond UI)
**Vulnerability:** Several mutations and data retrieval actions (`removeMember`, `disbandTeam`, `getAdminDashboardData`, `getAllAssignments`, `getEvaluations`, `getMyAssignedTeamIds`) previously relied partially on UI-level gating rather than robust server-side ownership / role enforcement.
**Learning:** Client-side routing and button visibility offer zero security against direct RPC / Server Action invocations.
**Prevention:** Every server action must independently resolve the session and verify role and resource ownership (e.g. team leader or admin status) before executing database modifications.


