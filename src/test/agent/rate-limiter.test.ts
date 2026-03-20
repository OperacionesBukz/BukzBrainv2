import { describe, it, expect, vi, beforeEach } from "vitest";
import { RateLimiter } from "@/lib/agent/rate-limiter";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("allows messages under the limit", () => {
    const limiter = new RateLimiter(3, 60_000);
    expect(limiter.canSend()).toBe(true);
    limiter.record();
    limiter.record();
    limiter.record();
    expect(limiter.canSend()).toBe(false);
  });

  it("allows messages after window expires", () => {
    const limiter = new RateLimiter(1, 60_000);
    limiter.record();
    expect(limiter.canSend()).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(limiter.canSend()).toBe(true);
  });
});
