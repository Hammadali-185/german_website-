import { describe, expect, it } from "vitest";
import {
  COLLECTED_PAYMENT_STATUS,
  OPEN_ORDER_STATUSES,
  SALES_EXCLUDED_STATUSES,
  berlinInstant,
  previousWindow,
  resolveBusinessRange,
} from "./reporting.js";

describe("business reporting calendar", () => {
  it("keeps open orders separate from rejected and cancelled orders", () => {
    expect(OPEN_ORDER_STATUSES).toEqual(["PENDING", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"]);
    expect(SALES_EXCLUDED_STATUSES).toEqual(["REJECTED", "CANCELLED"]);
    expect(OPEN_ORDER_STATUSES.some((status) => SALES_EXCLUDED_STATUSES.includes(status as never))).toBe(false);
    expect(COLLECTED_PAYMENT_STATUS).toBe("PAID");
  });

  it("converts Berlin midnights across the 2026 daylight-saving transitions", () => {
    expect(berlinInstant("2026-03-29").toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(berlinInstant("2026-03-30").toISOString()).toBe("2026-03-29T22:00:00.000Z");
    expect(berlinInstant("2026-10-25").toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(berlinInstant("2026-10-26").toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });

  it("uses the previous calendar month for a month-to-date comparison", () => {
    const range = resolveBusinessRange({ preset: "month" }, new Date("2026-03-31T12:00:00Z"));
    const previous = previousWindow(range, "month");
    expect(range.from).toBe("2026-03-01");
    expect(range.to).toBe("2026-03-31");
    expect(previous.from).toBe("2026-02-01");
    expect(previous.to).toBe("2026-02-28");
  });

  it("compares the last seven Berlin days with the seven days before them", () => {
    const range = resolveBusinessRange({ preset: "7d" }, new Date("2026-11-19T08:00:00Z"));
    const previous = previousWindow(range, "7d");
    expect(range).toMatchObject({ from: "2026-11-13", to: "2026-11-19" });
    expect(previous).toMatchObject({ from: "2026-11-06", to: "2026-11-12" });
  });
});
