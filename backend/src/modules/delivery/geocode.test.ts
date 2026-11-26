import "../../config/load-env.js";
import { describe, expect, it } from "vitest";
import { distinctiveQueryToken, filterSuggestions, rankSuggestions, toSuggestion } from "./geocode.service.js";

const shop = { latitude: 49.2187392, longitude: 8.7126137 };

describe("address suggestions", () => {
  it("keeps business names as the label and stores the street for delivery", () => {
    const suggestion = toSuggestion(
      {
        geometry: { coordinates: [8.7269674, 49.2261167] },
        properties: {
          osm_id: 1,
          name: "Heizöl Barth",
          street: "Franz-Gurk-Straße",
          housenumber: "12",
          postcode: "76684",
          city: "Östringen",
          countrycode: "DE",
        },
      },
      0,
      shop,
    );
    expect(suggestion).toMatchObject({
      label: "Heizöl Barth",
      street: "Franz-Gurk-Straße 12",
      postalCode: "76684",
      city: "Östringen",
    });
    expect(suggestion?.distanceKm).toBeLessThan(3);
    expect(suggestion?.latitude).toBe(49.2261167);
    expect(suggestion?.longitude).toBe(8.7269674);
  });

  it("rejects incomplete coordinates and non-German results", () => {
    expect(toSuggestion({ geometry: { coordinates: [8.7] }, properties: { name: "Test", countrycode: "DE" } }, 0, shop)).toBeNull();
    expect(
      toSuggestion(
        {
          geometry: { coordinates: [8.7, 49.2] },
          properties: { name: "Abroad", countrycode: "FR" },
        },
        0,
        shop,
      ),
    ).toBeNull();
  });

  it("ranks nearby destinations first and drops duplicates", () => {
    const near = toSuggestion(
      {
        geometry: { coordinates: [8.7269674, 49.2261167] },
        properties: { osm_id: 1, name: "Heizöl Barth", postcode: "76684", city: "Östringen", countrycode: "DE" },
      },
      0,
      shop,
    )!;
    const far = toSuggestion(
      {
        geometry: { coordinates: [8.5365072, 49.6774383] },
        properties: { osm_id: 2, name: "Heizöl – Herrmann GmbH & Co. KG", postcode: "64683", city: "Einhausen", countrycode: "DE" },
      },
      1,
      shop,
    )!;
    const ranked = rankSuggestions([far, near, { ...near }]);
    expect(ranked[0]?.label).toBe("Heizöl Barth");
    expect(ranked).toHaveLength(2);
    expect(far.distanceKm).toBeGreaterThan(20);
    expect(near.distanceKm).toBeLessThanOrEqual(20);
  });

  it("does not treat a far fuzzy company match as a local delivery address", () => {
    expect(distinctiveQueryToken("Heizöl Rothermel GmbH & CO KG")).toBe("rothermel");
    const far = toSuggestion(
      {
        geometry: { coordinates: [8.5365072, 49.6774383] },
        properties: { osm_id: 2, name: "Heizöl – Herrmann GmbH & Co. KG", postcode: "64683", city: "Einhausen", countrycode: "DE" },
      },
      0,
      shop,
    )!;
    const otherLocal = toSuggestion(
      {
        geometry: { coordinates: [8.7269674, 49.2261167] },
        properties: { osm_id: 1, name: "Heizöl Barth", postcode: "76684", city: "Östringen", countrycode: "DE" },
      },
      1,
      shop,
    )!;
    expect(filterSuggestions("Heizöl Rothermel GmbH & CO KG", [far, otherLocal])).toEqual([]);
    expect(filterSuggestions("Heizöl Barth Östringen", [otherLocal]).map((entry) => entry.label)).toEqual(["Heizöl Barth"]);
  });

  it("keeps the local fire station ahead of a far station with the same word", () => {
    const local = toSuggestion(
      {
        geometry: { coordinates: [8.71233, 49.2186704] },
        properties: {
          osm_id: 10,
          name: "Freiwillige Feuerwehr Östringen",
          street: "Hauptstraße",
          housenumber: "116",
          postcode: "76684",
          city: "Östringen",
          countrycode: "DE",
        },
      },
      0,
      shop,
    )!;
    const far = toSuggestion(
      {
        geometry: { coordinates: [8.5767961, 49.3690241] },
        properties: {
          osm_id: 11,
          name: "Feuerwehr",
          street: "Eichendorffstraße",
          postcode: "68723",
          city: "Oftersheim",
          countrycode: "DE",
        },
      },
      1,
      shop,
    )!;
    const ranked = rankSuggestions([far, local]);
    const filtered = filterSuggestions("Feuerwehr", ranked);
    expect(ranked[0]?.label).toBe("Freiwillige Feuerwehr Östringen");
    expect(filtered[0]?.label).toBe("Freiwillige Feuerwehr Östringen");
    expect(filtered[0]?.distanceKm).toBeLessThan(1);
  });
});
