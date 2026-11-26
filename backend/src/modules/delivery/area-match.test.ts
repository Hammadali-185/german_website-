import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { matchDeliveryAreas, pickDeliveryArea, scoreDeliveryArea } from "@pizzablitz/shared";

type Area = { id: string; postalCode: string; locality: string };

const published = (
  JSON.parse(readFileSync(path.join(process.cwd(), "..", "data", "delivery-areas.json"), "utf8")) as Array<{
    postalCode: string;
    locality: string;
    externalId: string;
  }>
).map((area) => ({
  id: area.externalId,
  postalCode: area.postalCode,
  locality: area.locality,
}));

describe("delivery area matching across published localities", () => {
  it("auto-picks a town-center zone when geocoding only returns the municipality", () => {
    expect(
      pickDeliveryArea(published, { postalCode: "76684", city: "Östringen" }),
    ).toMatchObject({ locality: "Östringen Zentrum" });
    expect(
      pickDeliveryArea(published, { postalCode: "74889", city: "Sinsheim" }),
    ).toMatchObject({ locality: "Sinsheim - City" });
  });

  it("resolves Ortsteile from city + district for compound Liefergebiete", () => {
    expect(
      pickDeliveryArea(published, { postalCode: "76684", city: "Östringen", district: "Odenheim" }),
    ).toMatchObject({ locality: "Östringen Odenheim" });
    expect(
      pickDeliveryArea(published, { postalCode: "69242", city: "Mühlhausen", district: "Rettigheim" }),
    ).toMatchObject({ locality: "Mühlhausen Rettigheim" });
    expect(
      pickDeliveryArea(published, { postalCode: "76698", city: "Ubstadt-Weiher", district: "Weiher" }),
    ).toMatchObject({ locality: "Ubstadt-Weiher Weiher" });
    expect(
      pickDeliveryArea(published, { postalCode: "68789", city: "Sankt Leon-Rot", district: "Rot" }),
    ).toMatchObject({ locality: "Sankt Leon-Rot Rot" });
    expect(
      pickDeliveryArea(published, {
        postalCode: "76669",
        city: "Bad Schönborn",
        district: "Langenbrücken",
      }),
    ).toMatchObject({ locality: "Bad Schön. Langenbrücken" });
  });

  it("matches simple single-town postal areas exactly", () => {
    expect(pickDeliveryArea(published, { postalCode: "69168", city: "Wiesloch" })).toMatchObject({
      locality: "Wiesloch",
    });
    expect(pickDeliveryArea(published, { postalCode: "76709", city: "Kronau" })).toMatchObject({
      locality: "Kronau",
    });
    expect(pickDeliveryArea(published, { postalCode: "74889", city: "Hoffenheim" })).toMatchObject({
      locality: "Hoffenheim",
    });
  });

  it("prefers the bare municipality row when one exists beside Ortsteil rows", () => {
    expect(pickDeliveryArea(published, { postalCode: "69242", city: "Mühlhausen" })).toMatchObject({
      locality: "Mühlhausen",
    });
  });

  it("does not invent a zone when several Ortsteile share a parent and none is a center", () => {
    const matches = matchDeliveryAreas(published, { postalCode: "74918", city: "Angelbachtal" });
    expect(matches.map((area) => area.locality).sort()).toEqual([
      "Angelbachtal Eichtersheim",
      "Angelbachtal Michelfeld",
    ]);
    expect(pickDeliveryArea(published, { postalCode: "74918", city: "Angelbachtal" })).toBeNull();
  });

  it("returns nothing for an unknown postal code", () => {
    expect(matchDeliveryAreas(published, { postalCode: "99999", city: "Östringen" })).toEqual([]);
  });

  it("keeps exact published locality strings as the strongest match", () => {
    expect(
      pickDeliveryArea(published, { postalCode: "76684", city: "Östringen Eichelberg", locality: "Östringen Eichelberg" }),
    ).toMatchObject({ locality: "Östringen Eichelberg" });
  });

  it("scores a distinct district higher than a bare parent match", () => {
    const odenheim = scoreDeliveryArea("Östringen Odenheim", { city: "Östringen", district: "Odenheim" });
    const zentrum = scoreDeliveryArea("Östringen Zentrum", { city: "Östringen", district: "Odenheim" });
    expect(odenheim).toBeGreaterThan(zentrum);
  });
});
