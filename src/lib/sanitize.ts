/**
 * Security Utilities: Input Sanitization & Anti-Injection Defense
 * Neutralizes XSS / Script Injection, Query Injection anomalies, and Malformed Inputs.
 */

/**
 * Sanitizes user text by removing HTML tags, script execution vectors,
 * dangerous URI schemes, and control characters.
 */
export function sanitizeText(input: unknown, maxLength = 2000): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, "") // Strip all HTML/XML tags
    .replace(/javascript\s*:/gi, "") // Neutralize javascript: pseudo-protocol
    .replace(/data\s*:/gi, "") // Neutralize data: pseudo-protocol
    .replace(/vbscript\s*:/gi, "") // Neutralize vbscript: pseudo-protocol
    .replace(/on\w+\s*=/gi, "") // Neutralize inline event handlers like onload=, onerror=
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "") // Strip non-printable control chars
    .trim()
    .slice(0, maxLength);
}

/**
 * Validates and sanitizes email addresses against strict RFC 5322 subset.
 */
export function sanitizeEmail(email: unknown): string {
  if (typeof email !== "string") return "";
  const cleaned = email.trim().toLowerCase().replace(/\s+/g, "");
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
    .replace(/[^a-zA-Z0-9_\-\s]/g, "")
    .trim()
    .toUpperCase()
    .slice(0, maxLength);
}

/**
 * Sanitizes phone numbers to standard international / national characters only.
 */
export function sanitizePhone(phone: unknown): string | null {
  if (typeof phone !== "string") return null;
  const cleaned = phone.replace(/[^0-9+\-\s()]/g, "").trim().slice(0, 20);
  return cleaned || null;
}
