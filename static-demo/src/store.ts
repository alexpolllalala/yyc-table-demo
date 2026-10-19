import { useSyncExternalStore } from "react";
import { pickWaiter, type WaiterLoad } from "../../lib/assignment";
import { orderTotals } from "../../lib/pricing";
import { assertTransition } from "../../lib/ticket-state";
import { expectedMinutes } from "../../lib/timer";
import { ALL_ITEMS, categoryOf, effectivePrice } from "./menu";

export type Status = "RECEIVED" | "ACCEPTED" | "PREPARING" | "READY" | "SERVED";
export type Line = { itemId: string; qty: number; note: string; noteEn: string; unitCents: number };
export type Ticket = { id: string; orderId: string; station: "kitchen" | "bar"; status: Status; acceptedAt: number | null; expectedMin: number | null; readyAt: number | null; lines: Line[] };
export type Order = {
  id: string; number: number; table: string; lang: string; waiter: string | null;
  payMethod: "ONLINE" | "AT_TABLE"; payStatus: "UNPAID" | "PAID";
  subtotalCents: number; gstCents: number; tipCents: number; totalCents: number;
  allergens: string[]; createdAt: number; rating: { food: number; service: number; comment: string; praise: string[] } | null;
};
export type Call = { id: string; table: string; type: string; waiter: string | null; done: boolean };
export type State = {
  orders: Order[]; tickets: Ticket[]; calls: Call[];
  prices: Record<string, number>; unavailable: string[];
  happyHour: boolean; busyHour: boolean; nextNumber: number;
};

export const WAITERS = [
  { name: "Maya", section: ["T1", "T2", "T3", "T4", "T5"] },
  { name: "Jordan", section: ["T6", "T7", "T8", "T9", "T10"] },
  { name: "Sam", section: ["T11", "T12", "T13", "T14", "B1", "B2", "B3", "B4", "B5", "B6"] },
];
const GST_BP = 500;
const KEY = "yyc_static_demo_v1";
const EMPTY: State = { orders: [], tickets: [], calls: [], prices: {}, unavailable: [], happyHour: false, busyHour: false, nextNumber: 101 };

let cachedRaw: string | null = null;
let cached: State = EMPTY;
const listeners = new Set<() => void>();

function read(): State {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch {}
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try { cached = raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY; } catch { cached = EMPTY; }
  return cached;
}
function write(next: State) {
  const raw = JSON.stringify(next);
  try { localStorage.setItem(KEY, raw); } catch {}
  cachedRaw = raw;
  cached = next;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) l(); }; // another tab changed the demo
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
}
export const useDemo = (): State => useSyncExternalStore(subscribe, read, () => EMPTY);
export const getState = read;
const update = (fn: (s: State) => State) => write(fn(read()));
const uid = () => Math.random().toString(36).slice(2, 10);

export const priceOf = (s: State, itemId: string) => {
  const item = ALL_ITEMS.find((i) => i.id === itemId)!;
  return effectivePrice(item, s.prices[itemId], s.happyHour);
};
export const isAvailable = (s: State, itemId: string) => !s.unavailable.includes(itemId);

/** Orders reach kitchen and waiters at once for pay-at-the-table, and only after payment for pay-now (D-51). */
export const released = (o: Pick<Order, "payMethod" | "payStatus">) => o.payMethod === "AT_TABLE" || o.payStatus === "PAID";

function loads(s: State): WaiterLoad[] {
  const cutoff = Date.now() - (s.busyHour ? 60_000 : 120_000);
  return WAITERS.map((w) => {
    const mine = s.orders.filter((o) => o.waiter === w.name && released(o));
    const open = s.tickets.filter((t) => mine.some((o) => o.id === t.orderId) && t.status !== "SERVED");
    return {
      id: w.name, onShift: true, section: w.section,
      openTables: new Set(mine.filter((o) => open.some((t) => t.orderId === o.id)).map((o) => o.table)).size,
      openTickets: open.length,
      unservedReady: open.filter((t) => t.status === "READY" && t.readyAt !== null && t.readyAt < cutoff).length,
    };
  });
}
function assign(s: State, table: string, orderId: string): string | null {
  const sibling = s.orders.find((o) => o.id !== orderId && o.table === table && o.waiter && released(o) && s.tickets.some((t) => t.orderId === o.id && t.status !== "SERVED"));
  return sibling?.waiter ?? pickWaiter(loads(s), table);
}

const PHRASES: Record<string, string> = { "ਅਚਾਰ ਨਹੀਂ": "no pickles", "不要酸黄瓜": "no pickles", "sin pepinillos": "no pickles", "بدون مخلل": "no pickles" };

export function placeOrder(input: { table: string; lang: string; payMethod: "ONLINE" | "AT_TABLE"; allergens: string[]; lines: { itemId: string; qty: number; note: string }[] }): string {
  const id = uid();
  update((s) => {
    const lines: Line[] = input.lines.map((l) => ({ itemId: l.itemId, qty: l.qty, note: l.note, noteEn: PHRASES[l.note.trim().toLowerCase()] ?? PHRASES[l.note.trim()] ?? l.note, unitCents: priceOf(s, l.itemId).cents }));
    const totals = orderTotals(lines.map((l) => ({ unitPriceCents: l.unitCents, quantity: l.qty })), GST_BP);
    const order: Order = { id, number: s.nextNumber, table: input.table, lang: input.lang, waiter: null, payMethod: input.payMethod, payStatus: "UNPAID", ...totals, allergens: input.allergens, createdAt: Date.now(), rating: null };
    const tickets: Ticket[] = (["kitchen", "bar"] as const)
      .map((station) => ({ station, lines: lines.filter((l) => ALL_ITEMS.find((i) => i.id === l.itemId)!.station === station) }))
      .filter((g) => g.lines.length)
      .map((g) => ({ id: uid(), orderId: id, station: g.station, status: "RECEIVED" as Status, acceptedAt: null, expectedMin: null, readyAt: null, lines: g.lines }));
    const next = { ...s, orders: [...s.orders, order], tickets: [...s.tickets, ...tickets], nextNumber: s.nextNumber + 1 };
    if (released(order)) order.waiter = assign(next, order.table, id);
    return next;
  });
  return id;
}

export function payOnline(orderId: string, tipCents: number) {
  update((s) => {
    const o = s.orders.find((x) => x.id === orderId)!;
    const paid: Order = { ...o, payStatus: "PAID", payMethod: "ONLINE", tipCents, totalCents: o.subtotalCents + o.gstCents + tipCents };
    const orders = s.orders.map((x) => (x.id === orderId ? paid : x));
    const next = { ...s, orders };
    if (!paid.waiter) paid.waiter = assign(next, paid.table, orderId);
    return next;
  });
}
export function addTip(orderId: string, tipCents: number) {
  update((s) => ({ ...s, orders: s.orders.map((o) => (o.id === orderId ? { ...o, tipCents, totalCents: o.subtotalCents + o.gstCents + tipCents } : o)) }));
}
export function switchToTable(orderId: string) {
  update((s) => {
    const o = s.orders.find((x) => x.id === orderId)!;
    const next = { ...s, orders: s.orders.map((x) => (x.id === orderId ? { ...x, payMethod: "AT_TABLE" as const } : x)) };
    const upd = next.orders.find((x) => x.id === orderId)!;
    if (!o.waiter) upd.waiter = assign(next, o.table, orderId);
    return next;
  });
}
export function markPaid(orderId: string) {
  update((s) => ({ ...s, orders: s.orders.map((o) => (o.id === orderId ? { ...o, payStatus: "PAID" as const } : o)) }));
}

export function moveTicket(ticketId: string, to: Status) {
  update((s) => {
    const t = s.tickets.find((x) => x.id === ticketId)!;
    assertTransition(t.status, to);
    const patch: Partial<Ticket> = { status: to };
    if (to === "ACCEPTED") {
      const open = s.tickets.filter((x) => x.station === t.station && (x.status === "ACCEPTED" || x.status === "PREPARING")).length;
      patch.acceptedAt = Date.now();
      patch.expectedMin = expectedMinutes({ typicalMin: t.station === "kitchen" ? 18 : 4, openTickets: open, busyHour: s.busyHour });
    }
    if (to === "READY") patch.readyAt = Date.now();
    return { ...s, tickets: s.tickets.map((x) => (x.id === ticketId ? { ...x, ...patch } : x)) };
  });
}
export function reassign(orderId: string, waiter: string) {
  update((s) => ({ ...s, orders: s.orders.map((o) => (o.id === orderId ? { ...o, waiter } : o)) }));
}
export function setBusy(busyHour: boolean) {
  update((s) => ({
    ...s, busyHour,
    tickets: s.tickets.map((t) => (t.status === "ACCEPTED" || t.status === "PREPARING" ? { ...t, expectedMin: expectedMinutes({ typicalMin: t.station === "kitchen" ? 18 : 4, openTickets: 0, busyHour }) } : t)),
  }));
}
export const setHappyHour = (happyHour: boolean) => update((s) => ({ ...s, happyHour }));
export const setPrice = (itemId: string, cents: number) => update((s) => ({ ...s, prices: { ...s.prices, [itemId]: cents } }));
export const setAvailable = (itemId: string, available: boolean) => update((s) => ({ ...s, unavailable: available ? s.unavailable.filter((x) => x !== itemId) : [...new Set([...s.unavailable, itemId])] }));
export function callWaiter(table: string, type: string) {
  update((s) => {
    const waiter = s.orders.filter((o) => o.table === table && o.waiter).at(-1)?.waiter ?? pickWaiter(loads(s), table);
    return { ...s, calls: [...s.calls, { id: uid(), table, type, waiter, done: false }] };
  });
}
export const dismissCall = (id: string) => update((s) => ({ ...s, calls: s.calls.map((c) => (c.id === id ? { ...c, done: true } : c)) }));
export function rate(orderId: string, rating: NonNullable<Order["rating"]>) {
  update((s) => ({ ...s, orders: s.orders.map((o) => (o.id === orderId ? { ...o, rating } : o)) }));
}
export function resetDemo() {
  write(EMPTY);
  try { ["yyc_cart", "yyc_demo_guest"].forEach((k) => localStorage.removeItem(k)); } catch {}
}
export const itemCategory = (itemId: string) => categoryOf(itemId).en;
