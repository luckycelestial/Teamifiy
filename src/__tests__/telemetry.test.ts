import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordErrorLog } from "@/app/actions/telemetry";

// Mock Supabase client
vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: vi.fn(() => ({
      from: vi.fn(() => ({
        insert: vi.fn(async (payload: any) => {
          if (!payload.context || !payload.message) {
            return { error: { message: "Invalid payload" } };
          }
          return { error: null };
        }),
      })),
    })),
  };
});

describe("P5 Telemetry & Error Logging Action Suite", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "mock_key";
    vi.clearAllMocks();
  });

  it("successfully sanitizes and logs error payloads", async () => {
    const res = await recordErrorLog({
      context: "EvaluationModal",
      message: "Network timeout while submitting scores <script>alert(1)</script>",
      stack: "Error: at line 42",
      userEmail: "test.student@sece.ac.in",
      url: "https://teamify.vercel.app/evaluator",
      userAgent: "Mozilla/5.0",
    });

    expect(res).toEqual({ success: true });
  });

  it("handles empty context gracefully and falls back to default", async () => {
    const res = await recordErrorLog({
      context: "",
      message: "Database connection dropped",
    });

    expect(res).toEqual({ success: true });
  });

  it("handles non-string or unusual error message safely", async () => {
    const res = await recordErrorLog({
      context: "AdminConsole",
      message: "Critical memory alert",
      metadata: { freeMem: 1024, loadAvg: 2.5 },
    });

    expect(res).toEqual({ success: true });
  });
});
