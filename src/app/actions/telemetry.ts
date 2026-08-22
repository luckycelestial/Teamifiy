"use server";

import { createClient } from "@supabase/supabase-js";
import { sanitizeText } from "@/lib/sanitize";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export type ErrorLogInput = {
  context: string;
  message: string;
  stack?: string;
  metadata?: Record<string, unknown>;
  userEmail?: string;
  url?: string;
  userAgent?: string;
};

export async function recordErrorLog(payload: ErrorLogInput) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.warn("recordErrorLog skipped: Supabase environment variables not configured.");
      return { success: false };
    }

    const sanitizedContext = sanitizeText(payload.context, 150) || "general";
    const sanitizedMessage = sanitizeText(payload.message, 1000) || "Unknown error";
    const sanitizedStack = payload.stack ? sanitizeText(payload.stack, 4000) : null;
    const sanitizedEmail = payload.userEmail ? sanitizeText(payload.userEmail, 255) : null;
    const sanitizedUrl = payload.url ? sanitizeText(payload.url, 500) : null;

    const { error } = await supabase.from("error_logs").insert({
      context: sanitizedContext,
      message: sanitizedMessage,
      stack: sanitizedStack,
      metadata: payload.metadata || {},
      user_email: sanitizedEmail,
      url: sanitizedUrl,
      user_agent: payload.userAgent ? sanitizeText(payload.userAgent, 300) : null,
    });

    if (error) {
      console.warn("recordErrorLog database insert warning:", error.message);
    }
    return { success: true };
  } catch (err) {
    console.warn("recordErrorLog execution error:", err);
    return { success: false };
  }
}
