# Sentinel Security Journal

This file tracks critical security learnings, vulnerability patterns, and security constraints specific to this application.

## 2026-08-21 - HTTP Security Headers & Clickjacking Protection
**Vulnerability:** Application lacked standard HTTP response security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`), leaving the portal vulnerable to clickjacking within iframe embeds and MIME-type sniffing attacks.
**Learning:** Default Next.js configuration does not automatically set defensive HTTP headers; they must be explicitly configured in `next.config.ts`.
**Prevention:** Enforce security headers globally on all routes (`/:path*`) via `headers()` in `next.config.ts`.

## 2026-08-21 - Authorization Bypass & IDOR on Team Evaluation Submission
**Vulnerability:** `saveTeamEvaluation` only verified that the caller had the `evaluator` role, without verifying if the target team was assigned to them in `evaluator_assignments`. An evaluator could score/modify evaluations for teams they were not assigned to. Additionally, scores were not clamped on the server side.
**Learning:** Role checks alone are insufficient for multi-tenant / batch assignment workflows; granular resource ownership checks must accompany role verification on every mutation.
**Prevention:** Verify both `evaluator_assignments` table membership for non-admin evaluators and enforce strict numeric boundary validation (0–25) on the server.

