/**
 * In-Memory Sliding-Window Rate Limiter
 * Provides high-throughput, low-latency protection against rapid mutation spam and bot floods.
 */

type RateLimitRecord = {
  timestamps: number[];
};

// Global in-memory cache preserved across warm lambda/server action invocations
const rateLimitStore = new Map<string, RateLimitRecord>();

// Periodic cleanup every 5 minutes to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      const validTimestamps = record.timestamps.filter((ts) => now - ts < 60000);
      if (validTimestamps.length === 0) {
        rateLimitStore.delete(key);
      } else {
        record.timestamps = validTimestamps;
      }
    }
  }, 5 * 60 * 1000).unref?.();
}

/**
 * Checks whether a given identifier has exceeded the allowed limit within windowMs.
 *
 * @param key Unique identifier (e.g., `user_id:action` or `ip:route`)
 * @param limit Maximum number of allowed hits within the window
 * @param windowMs Duration of the sliding window in milliseconds (default: 60,000ms = 1 min)
 * @returns `{ success: boolean, remaining: number, resetMs: number }`
 */
export function checkRateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60_000
): { success: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const windowStart = now - windowMs;

  const record = rateLimitStore.get(key) || { timestamps: [] };
  // Filter out timestamps older than the window
  const activeTimestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (activeTimestamps.length >= limit) {
    const oldest = activeTimestamps[0] || now;
    const resetMs = Math.max(0, oldest + windowMs - now);
    rateLimitStore.set(key, { timestamps: activeTimestamps });
    return {
      success: false,
      remaining: 0,
      resetMs,
    };
  }

  activeTimestamps.push(now);
  rateLimitStore.set(key, { timestamps: activeTimestamps });

  return {
    success: true,
    remaining: limit - activeTimestamps.length,
    resetMs: windowMs,
  };
}

/**
 * Convenience helper to enforce rate limiting inside Server Actions.
 * Throws a descriptive Error if the threshold is breached.
 */
export function enforceActionRateLimit(
  userId: string,
  actionName: string,
  limit: number = 10,
  windowMs: number = 60_000
) {
  const key = `${userId}:${actionName}`;
  const { success, resetMs } = checkRateLimit(key, limit, windowMs);

  if (!success) {
    const seconds = Math.ceil(resetMs / 1000);
    throw new Error(
      `Rate limit exceeded: please wait ${seconds}s before attempting to ${actionName} again.`
    );
  }
}

/**
 * Testing helper: clears all in-memory rate limit records
 */
export function _resetRateLimitStore() {
  rateLimitStore.clear();
}
