/**
 * Security Utilities: Input Sanitization & Anti-Injection Defense
 * Neutralizes XSS / Script Injection, Query Injection anomalies, and Malformed Inputs.
 */

/**
 * Sanitizes user text by completely stripping executable script tags, styles,
 * HTML tags, dangerous URI schemes, event handlers, and control characters.
 */
export function sanitizeText(input: unknown, maxLength = 2000): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Strip <script>...</script>
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "") // Strip <style>...</style>
    .replace(/<[^>]*>/g, " ") // Strip all other HTML/XML tags
    .replace(/javascript\s*:/gi, "") // Neutralize javascript: pseudo-protocol
    .replace(/data\s*:/gi, "") // Neutralize data: pseudo-protocol
    .replace(/vbscript\s*:/gi, "") // Neutralize vbscript: pseudo-protocol
    .replace(/on\w+\s*=/gi, "") // Neutralize inline event handlers like onload=, onerror=
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "") // Strip control chars
    .replace(/\s+/g, " ") // Normalize internal whitespace
    .trim()
    .slice(0, maxLength);
}

/**
 * Validates and sanitizes email addresses against strict RFC 5322 subset.
 */
export function sanitizeEmail(email: unknown): string {
  if (typeof email !== "string") return "";
  const cleaned = email
    .replace(/<[^>]*>/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleaned)) {
    return "";
  }
  return cleaned.slice(0, 254);
}

/**
 * Sanitizes identifiers, alphanumeric codes (e.g. PS Numbers, IDs) to prevent PostgREST delimiter breakage.
 */
export function sanitizeAlphanumericCode(code: unknown, maxLength = 50): string {
  if (typeof code !== "string") return "";
  return code
    .replace(/<[^>]*>/g, "")
    .replace(/[^a-zA-Z0-9_\-]/g, "")
    .trim()
    .toUpperCase()
    .slice(0, maxLength);
}

/**
 * Sanitizes phone numbers to standard international / national characters only.
 */
export function sanitizePhone(phone: unknown): string | null {
  if (typeof phone !== "string") return null;
  const stripped = sanitizeText(phone);
  const cleaned = stripped.replace(/[^0-9+\-\s()]/g, "").trim().slice(0, 20);
  return cleaned || null;
}

/**
 * Sanitizes and normalizes department names.
 */
export function sanitizeDepartment(dept: unknown): string {
  if (typeof dept !== "string") return "";
  const cleaned = sanitizeText(dept, 100);
  const upper = cleaned.trim().toUpperCase();
  if (upper === "AIML" || upper === "AI&ML" || upper === "AI & ML") return "AIML";
  if (upper === "AIDS" || upper === "AI&DS" || upper === "AI & DS") return "AIDS";
  return cleaned;
}
