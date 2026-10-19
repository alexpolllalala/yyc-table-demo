export type Stage = "waiting" | 0 | 1 | 2 | 3 | "late";

/** Stage message index by elapsed fraction of expected time (SPEC 4). Nothing starts before Accept. */
export function stageFor(acceptedAt: Date | null, expectedMin: number | null, now: Date): { stage: Stage; fraction: number } {
  if (!acceptedAt || !expectedMin) return { stage: "waiting", fraction: 0 };
  const elapsedMin = Math.max(0, (now.getTime() - acceptedAt.getTime()) / 60_000);
  const fraction = elapsedMin / expectedMin;
  if (fraction < 0.25) return { stage: 0, fraction };
  if (fraction < 0.6) return { stage: 1, fraction };
  if (fraction < 0.9) return { stage: 2, fraction };
  if (fraction <= 1) return { stage: 3, fraction };
  return { stage: "late", fraction };
}

export const BUSY_HOUR_FACTOR = 1.3;
const LOAD_FACTOR_PER_OPEN_TICKET = 0.08;

/** Typical station time stretched by current load (open tickets) and Busy hour. */
export function expectedMinutes(input: { typicalMin: number; openTickets: number; busyHour: boolean }): number {
  const load = 1 + LOAD_FACTOR_PER_OPEN_TICKET * Math.max(0, input.openTickets);
  const raw = input.typicalMin * load * (input.busyHour ? BUSY_HOUR_FACTOR : 1);
  return Math.max(input.typicalMin, Math.round(raw));
}

/** Range shown to the guest, e.g. 15-20. */
export function estimateRange(expectedMin: number): { min: number; max: number } {
  const min = Math.max(1, Math.round(expectedMin * 0.85));
  return { min, max: Math.max(min + 1, Math.round(expectedMin * 1.15)) };
}
