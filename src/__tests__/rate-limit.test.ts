import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, enforceActionRateLimit, _resetRateLimitStore } from "@/lib/rate-limit";

describe("P6 Rate Limiting & Anti-Abuse Suite", () => {
  beforeEach(() => {
    _resetRateLimitStore();
  });

  it("permits requests within the allowed threshold", () => {
    const key = "user_123:testAction";
    for (let i = 0; i < 5; i++) {
      const res = checkRateLimit(key, 5, 60_000);
      expect(res.success).toBe(true);
      expect(res.remaining).toBe(4 - i);
    }
  });

  it("blocks requests that exceed the limit within window", () => {
    const key = "user_456:spamAction";
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, 3, 60_000);
    }

    const blockedRes = checkRateLimit(key, 3, 60_000);
    expect(blockedRes.success).toBe(false);
    expect(blockedRes.remaining).toBe(0);
    expect(blockedRes.resetMs).toBeGreaterThan(0);
  });

  it("enforceActionRateLimit throws when limit is exceeded", () => {
    const userId = "student_789";
    const action = "submitPS";

    // Allow 2 calls
    enforceActionRateLimit(userId, action, 2, 60_000);
    enforceActionRateLimit(userId, action, 2, 60_000);

    // 3rd call should throw rate limit error
    expect(() => enforceActionRateLimit(userId, action, 2, 60_000)).toThrow(
      /Rate limit exceeded/
    );
  });

  it("handles different keys independently", () => {
    const userA = "user_A:action";
    const userB = "user_B:action";

    checkRateLimit(userA, 1, 60_000);
    expect(checkRateLimit(userA, 1, 60_000).success).toBe(false);

    // User B should still be allowed
    expect(checkRateLimit(userB, 1, 60_000).success).toBe(true);
  });
});
