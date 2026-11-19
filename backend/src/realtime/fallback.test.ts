import { afterEach, describe, expect, it, vi } from "vitest";
import { createLiveFallback } from "@pizzablitz/shared";

describe("admin live fallback", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls every 20 seconds after disconnect and stops after reconnect", () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const live = createLiveFallback(20000, refresh);
    live.disconnected();
    live.disconnected();
    vi.advanceTimersByTime(20000);
    expect(refresh).toHaveBeenCalledTimes(1);
    live.connected();
    vi.advanceTimersByTime(60000);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(live.polling()).toBe(false);
  });

  it("starts again after a later disconnect", () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const live = createLiveFallback(20000, refresh);
    live.disconnected();
    live.connected();
    live.disconnected();
    vi.advanceTimersByTime(20000);
    expect(refresh).toHaveBeenCalledTimes(1);
    live.stop();
    expect(live.polling()).toBe(false);
  });
});
