/** All amounts are integer cents in CAD. */
export function formatCad(cents: number): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
}

/** GST on a subtotal; rate is in basis points (500 = 5%). Rounds half up. */
export function gstCents(subtotalCents: number, basisPoints: number): number {
  return Math.round((subtotalCents * basisPoints) / 10_000);
}

export function tipCents(subtotalCents: number, percent: number): number {
  return Math.round((subtotalCents * percent) / 100);
}
