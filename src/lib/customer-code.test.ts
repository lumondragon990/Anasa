import { describe, expect, it } from "vitest";
import { codeAlternatives, suggestCustomerCode, CODE_PATTERN } from "./customer-code";

describe("suggestCustomerCode", () => {
  it.each([
    ["ABC Industrial", "ABC"],
    ["XYZ Energy", "XYZ"],
    ["Global Power", "GLP"],
    ["Global Power LLC", "GLP"],
    ["Brownsville Public Utilities Board", "BPU"],
    ["Siemens", "SIE"],
    ["WEG Transformers USA", "WEG"],
    ["Compañía Eléctrica del Norte S.A. de C.V.", "CEN"],
    ["The Acme Corporation", "ACM"],
  ])("%s → %s", (name, code) => {
    expect(suggestCustomerCode(name)).toBe(code);
  });

  it("returns empty for blank names", () => {
    expect(suggestCustomerCode("  ")).toBe("");
  });

  it("alternatives are valid, distinct and exclude the base", () => {
    const alts = codeAlternatives("Global Power");
    expect(alts).not.toContain("GLP");
    expect(new Set(alts).size).toBe(alts.length);
    alts.forEach((a) => expect(a).toMatch(CODE_PATTERN));
  });
});
