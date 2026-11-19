import { prisma } from "../../database/prisma.js";

export type HourFixture = {
  previousHour: { id: string; opens: string; closes: string } | null;
  createdHourId: string | null;
  restaurant: { id: string; holidayMode: boolean } | null;
};

export async function restoreOpeningFixture(state: HourFixture) {
  if (state.previousHour) {
    await prisma.openingHours.update({
      where: { id: state.previousHour.id },
      data: { opens: state.previousHour.opens, closes: state.previousHour.closes },
    });
  }
  if (state.createdHourId) {
    await prisma.openingHours.delete({ where: { id: state.createdHourId } }).catch(() => undefined);
  }
  if (state.restaurant) {
    await prisma.restaurant.update({ where: { id: state.restaurant.id }, data: { holidayMode: state.restaurant.holidayMode } });
  }
}
