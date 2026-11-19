import "../../config/load-env.js";
import { berlinClock } from "@pizzablitz/shared";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../database/prisma.js";
import { restoreOpeningFixture, type HourFixture } from "./test-hours.js";

describe("opening-hour restoration", () => {
  const state: HourFixture = { previousHour: null, createdHourId: null, restaurant: null };

  afterAll(async () => {
    await restoreOpeningFixture(state);
    await prisma.$disconnect();
  });

  it("puts the original hours back when the test body fails", async () => {
    const found = await prisma.restaurant.findFirst({ include: { hours: true } });
    if (!found) throw new Error("Restaurant fehlt.");
    const today = berlinClock(new Date()).day;
    const current = found.hours.find((hour) => hour.day === today);
    if (!current) throw new Error("Heutige Öffnungszeit fehlt.");
    state.restaurant = { id: found.id, holidayMode: found.holidayMode };
    state.previousHour = { id: current.id, opens: current.opens, closes: current.closes };
    await prisma.openingHours.update({ where: { id: current.id }, data: { opens: "00:00", closes: "23:59" } });
    let failed = false;
    try {
      throw new Error("geplanter Testfehler");
    } catch {
      failed = true;
      await restoreOpeningFixture(state);
      state.previousHour = null;
    }
    const restored = await prisma.openingHours.findUnique({ where: { id: current.id } });
    expect(failed).toBe(true);
    expect(restored).toMatchObject({ opens: current.opens, closes: current.closes });
  });
});
