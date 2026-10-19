type TicketStatus = "RECEIVED" | "ACCEPTED" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";

const NEXT: Record<TicketStatus, TicketStatus[]> = {
  RECEIVED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "READY", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED"],
  SERVED: [],
  CANCELLED: [],
};

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return NEXT[from].includes(to);
}

export function assertTransition(from: TicketStatus, to: TicketStatus): void {
  if (!canTransition(from, to)) throw new Error(`Illegal ticket transition ${from} -> ${to}`);
}
