import { gstCents } from "./money";

export type PriceLine = { unitPriceCents: number; quantity: number };

export function subtotalOf(lines: PriceLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
}

export function orderTotals(lines: PriceLine[], gstBasisPoints: number, tipCents = 0) {
  const subtotalCents = subtotalOf(lines);
  const gst = gstCents(subtotalCents, gstBasisPoints);
  return { subtotalCents, gstCents: gst, tipCents, totalCents: subtotalCents + gst + tipCents };
}
