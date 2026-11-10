import { describe, expect, it } from "vitest";
import {
  landedCost, lineTotal, marginPercent, markupPercent, priceFromFixedProfit,
  priceFromMarkup, priceFromTargetMargin, PricingError, toMoney,
} from "./money";

describe("pricing formulas (spec Section 14 / Test 12)", () => {
  it("markup: cost × (1 + rate)", () => {
    expect(toMoney(priceFromMarkup("1000", "0.25"))).toBe("1250.00");
  });

  it("target margin: cost ÷ (1 − rate)", () => {
    expect(toMoney(priceFromTargetMargin("750", "0.25"))).toBe("1000.00");
  });

  it("markup and margin are different numbers for the same deal", () => {
    expect(markupPercent("750", "1000").toFixed(2)).toBe("33.33");
    expect(marginPercent("750", "1000").toFixed(2)).toBe("25.00");
  });

  it("rejects a target margin of 100% or more", () => {
    expect(() => priceFromTargetMargin("100", "1")).toThrow(PricingError);
    expect(() => priceFromTargetMargin("100", "1.2")).toThrow(PricingError);
  });

  it("rejects negative cost", () => {
    expect(() => priceFromMarkup("-1", "0.1")).toThrow(PricingError);
  });

  it("avoids binary floating-point errors", () => {
    // 0.1 + 0.2 in floats is 0.30000000000000004
    expect(landedCost({ unitCost: "0.1", freight: "0.2" }).toString()).toBe("0.3");
    expect(toMoney(priceFromFixedProfit("19.99", "0.01"))).toBe("20.00");
  });

  it("line total applies discount and rounds half-up to cents", () => {
    expect(lineTotal("1", "6500", "5").toFixed(2)).toBe("6175.00");
    expect(lineTotal("3", "0.335").toFixed(2)).toBe("1.01");
    expect(() => lineTotal("1", "10", "100")).toThrow(PricingError);
  });
});
