export type WaiterLoad = {
  id: string;
  onShift: boolean;
  section: string[];
  openTables: number;
  openTickets: number;
  /** READY tickets that have been waiting to be served longer than the threshold. */
  unservedReady: number;
};

export const OPEN_TICKET_WEIGHT = 0.5;
export const UNSERVED_READY_WEIGHT = 2;
export const READY_WAIT_MIN = 2;
export const READY_WAIT_MIN_BUSY = 1;

export function loadScore(w: Pick<WaiterLoad, "openTables" | "openTickets" | "unservedReady">): number {
  return w.openTables + OPEN_TICKET_WEIGHT * w.openTickets + UNSERVED_READY_WEIGHT * w.unservedReady;
}

/** SPEC 5: lowest load among on-shift waiters; ties: fewer tables, then the waiter whose section holds the table. */
export function pickWaiter(waiters: WaiterLoad[], tableCode: string): string | null {
  const candidates = waiters.filter((w) => w.onShift);
  if (candidates.length === 0) return null;
  const ranked = [...candidates].sort((a, b) => {
    const byLoad = loadScore(a) - loadScore(b);
    if (byLoad !== 0) return byLoad;
    const byTables = a.openTables - b.openTables;
    if (byTables !== 0) return byTables;
    return Number(b.section.includes(tableCode)) - Number(a.section.includes(tableCode));
  });
  return ranked[0].id;
}
