import Decimal from "decimal.js";

/**
 * Decimal-safe pricing formulas (spec Section 14). Inputs and outputs are
 * strings or Decimals, never binary floats. Rates are fractions (0.35 = 35%).
 */
Decimal.set({ precision: 34, rounding: Decimal.ROUND_HALF_UP });

export type Num = Decimal.Value;
const d = (v: Num) => new Decimal(v);

export class PricingError extends Error {}

function assertNonNegative(name: string, v: Decimal) {
  if (v.isNaN() || v.isNegative()) throw new PricingError(`${name} must be zero or more`);
}

/** Selling price = cost × (1 + markup rate) */
export function priceFromMarkup(cost: Num, markupRate: Num) {
  const c = d(cost);
  const m = d(markupRate);
  assertNonNegative("Cost", c);
  if (m.isNaN() || m.lte(-1)) throw new PricingError("Markup must be greater than -100%");
  return c.mul(m.plus(1));
}

/** Selling price = cost ÷ (1 − target margin rate). Margin must be < 100%. */
export function priceFromTargetMargin(cost: Num, marginRate: Num) {
  const c = d(cost);
  const m = d(marginRate);
  assertNonNegative("Cost", c);
  if (m.isNaN() || m.gte(1)) throw new PricingError("Target margin must be below 100%");
  if (m.lt(0)) throw new PricingError("Target margin cannot be negative");
  return c.div(d(1).minus(m));
}

/** Selling price = cost + fixed profit */
export function priceFromFixedProfit(cost: Num, profit: Num) {
  const c = d(cost);
  assertNonNegative("Cost", c);
  return c.plus(d(profit));
}

/** Markup % = profit ÷ cost × 100 */
export function markupPercent(cost: Num, price: Num) {
  const c = d(cost);
  if (c.isZero()) throw new PricingError("Markup is undefined when cost is zero");
  return d(price).minus(c).div(c).mul(100);
}

/** Gross margin % = profit ÷ selling price × 100 */
export function marginPercent(cost: Num, price: Num) {
  const p = d(price);
  if (p.isZero()) throw new PricingError("Margin is undefined when price is zero");
  return p.minus(d(cost)).div(p).mul(100);
}

/** Landed unit cost = base cost + freight + duties + other direct costs (per unit) */
export function landedCost(parts: { unitCost: Num; freight?: Num; duties?: Num; other?: Num }) {
  return d(parts.unitCost).plus(d(parts.freight ?? 0)).plus(d(parts.duties ?? 0)).plus(d(parts.other ?? 0));
}

/** Line total = qty × unit price × (1 − discount%) , rounded to cents */
export function lineTotal(qty: Num, unitPrice: Num, discountPct: Num = 0) {
  const disc = d(discountPct);
  if (disc.isNegative() || disc.gte(100)) throw new PricingError("Discount must be between 0% and 100%");
  return d(qty).mul(d(unitPrice)).mul(d(1).minus(disc.div(100))).toDecimalPlaces(2);
}

export const toMoney = (v: Num) => d(v).toDecimalPlaces(2).toFixed(2);
