import { describe, expect, it } from "vitest";
import { csvCell, csvDocument } from "./csv.js";

describe("csv export", () => {
  it("keeps ordinary values and quotes separators", () => {
    expect(csvCell("Pizza")).toBe('"Pizza"');
    expect(csvCell('12"')).toBe('"12"""');
    expect(csvCell(1500)).toBe('"1500"');
  });

  it("neutralizes spreadsheet formulas", () => {
    expect(csvCell("=1+1")).toBe(`"'=1+1"`);
    expect(csvCell("+49 123")).toBe(`"'+49 123"`);
    expect(csvCell("-100")).toBe(`"'-100"`);
    expect(csvCell("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
    expect(csvCell(" =cmd")).toBe(`"' =cmd"`);
    expect(csvDocument([["=HYPERLINK()", "Umsatz"]])).toContain(`"'=HYPERLINK()"`);
    expect(csvDocument([["Umsatz"]])).not.toContain("'Umsatz");
  });
});
