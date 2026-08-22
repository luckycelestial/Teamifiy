"use client";

import { recordErrorLog } from "@/app/actions/telemetry";

export type ErrorPayload = {
  context: string;
  message: string;
  stack?: string;
  metadata?: Record<string, unknown>;
  userEmail?: string;
  url?: string;
  userAgent?: string;
};

/**
 * Formats and reports an application error to console and telemetry database sink.
 * Safe to call anywhere on the client without throwing.
 */
export async function reportClientError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>,
  userEmail?: string
) {
  try {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : JSON.stringify(error) || "Unknown client exception";

    const stack = error instanceof Error ? error.stack : undefined;
    const url = typeof window !== "undefined" ? window.location.href : undefined;
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : undefined;

    // Local structured console logging
    if (process.env.NODE_ENV !== "production") {
      console.error(`🚨 [Telemetry:${context}]`, {
        message,
        stack,
        metadata,
        url,
      });
    }

    // Forward to centralized error_logs sink asynchronously
    await recordErrorLog({
      context,
      message,
      stack,
      metadata,
      userEmail,
      url,
      userAgent,
    });
  } catch (telemetryErr) {
    // Non-blocking fallback
    console.warn("Failed to forward telemetry log:", telemetryErr);
  }
}
