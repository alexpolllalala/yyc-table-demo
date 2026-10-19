import { useEffect, useRef, useState } from "react";
import { formatCad } from "../../lib/money";
import { loadScore } from "../../lib/assignment";
import { useNow } from "./i18n";
import { ALL_ITEMS, CATEGORIES } from "./menu";
import { WAITERS, dismissCall, isAvailable, markPaid, moveTicket, priceOf, reassign, released, resetDemo, setAvailable, setBusy, setHappyHour, setPrice, useDemo, type Status, type Ticket } from "./store";

const btn = "min-h-11 rounded-xl bg-chip px-4";
const primary = "min-h-12 rounded-xl bg-accent px-4 font-semibold text-accent-ink";
const nameOf = (id: string) => ALL_ITEMS.find((i) => i.id === id)!.nameEn;

function beep(freq: number) {
  try { const c = new AudioContext(); const o = c.createOscillator(); o.frequency.value = freq; o.connect(c.destination); o.start(); o.stop(c.currentTime + 0.25); } catch {}
}

const COLUMNS: { status: Status; title: string }[] = [{ status: "RECEIVED", title: "New" }, { status: "ACCEPTED", title: "Accepted" }, { status: "PREPARING", title: "Preparing" }, { status: "READY", title: "Ready" }];
const ACTIONS: Record<Status, { to: Status; label: string }[]> = {
  RECEIVED: [{ to: "ACCEPTED", label: "Accept" }],
  ACCEPTED: [{ to: "PREPARING", label: "Start preparing" }, { to: "READY", label: "Ready" }],
  PREPARING: [{ to: "READY", label: "Ready" }],
  READY: [], SERVED: [],
};

export function Kds({ station }: { station: "kitchen" | "bar" }) {
  const s = useDemo();
  const now = useNow(5000);
  const known = useRef<Set<string> | null>(null);
  const tickets = s.tickets.filter((t) => t.station === station && t.status !== "SERVED" && released(s.orders.find((o) => o.id === t.orderId)!));
  useEffect(() => {
    const ids = new Set(tickets.map((t) => t.id));
    if (known.current && tickets.some((t) => t.status === "RECEIVED" && !known.current!.has(t.id))) beep(880);
    known.current = ids;
  });
  return (
    <main className="min-h-dvh p-4">
      <h1 className="mb-4 text-3xl font-bold">{station === "kitchen" ? "Kitchen" : "Bar"}</h1>
      <div className="grid gap-4 lg:grid-cols-4">
        {COLUMNS.map((col) => (
          <section key={col.status} aria-label={col.title}>
            <h2 className="mb-2 text-xl font-semibold">{col.title} <span className="text-muted">({tickets.filter((t) => t.status === col.status).length})</span></h2>
            <div className="grid gap-3">{tickets.filter((t) => t.status === col.status).map((t) => <KdsCard key={t.id} t={t} now={now} />)}</div>
          </section>
        ))}
      </div>
      <details className="mt-8 rounded-2xl bg-surface p-4">
        <summary className="min-h-11 cursor-pointer text-lg font-semibold">Item availability (86)</summary>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">{ALL_ITEMS.filter((i) => i.station === station).map((i) => <li key={i.id} className="flex items-center justify-between gap-3"><span className={isAvailable(s, i.id) ? "" : "text-muted line-through"}>{i.nameEn}</span><button className={btn} onClick={() => setAvailable(i.id, !isAvailable(s, i.id))}>{isAvailable(s, i.id) ? "Mark unavailable" : "Mark available"}</button></li>)}</ul>
      </details>
    </main>
  );
}

function KdsCard({ t, now }: { t: Ticket; now: number }) {
  const s = useDemo();
  const order = s.orders.find((o) => o.id === t.orderId)!;
  const elapsed = t.acceptedAt ? Math.floor((now - t.acceptedAt) / 60_000) : null;
  return (
    <article className="rounded-2xl bg-surface p-4">
      <div className="flex items-baseline justify-between"><span className="text-2xl font-bold">#{order.number}</span><span className="text-xl">{order.table}</span></div>
      {elapsed !== null && <div className="text-muted">{elapsed} min / expected {t.expectedMin} min</div>}
      <ul className="mt-2 grid gap-2 text-lg">
        {t.lines.map((l, i) => (
          <li key={i}><span className="font-semibold">{l.qty} × {nameOf(l.itemId)}</span>
            {l.noteEn && <div className="text-base">Note: {l.noteEn}{l.note !== l.noteEn && <span className="text-muted"> (original: {l.note})</span>}</div>}
            {order.allergens.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{order.allergens.map((a) => <span key={a} className="rounded bg-accent px-2 py-0.5 text-sm font-bold uppercase text-accent-ink">{a}</span>)}</div>}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">{ACTIONS[t.status].map((a) => <button key={a.to} className={`${primary} flex-1`} onClick={() => moveTicket(t.id, a.to)}>{a.label}</button>)}</div>
    </article>
  );
}

export function WaiterApp() {
  const s = useDemo();
  const [me, setMe] = useState("Maya");
  const known = useRef<Set<string> | null>(null);
  const mine = s.orders.filter((o) => o.waiter === me && released(o));
  const withTickets = mine.map((o) => ({ o, tickets: s.tickets.filter((t) => t.orderId === o.id) }));
  const open = withTickets.filter((x) => x.tickets.some((t) => t.status !== "SERVED"));
  const unpaidServed = withTickets.filter((x) => x.tickets.every((t) => t.status === "SERVED") && x.o.payStatus === "UNPAID");
  const ready = open.flatMap((x) => x.tickets.filter((t) => t.status === "READY").map((t) => ({ t, o: x.o })));
  const calls = s.calls.filter((c) => !c.done && c.waiter === me);
  useEffect(() => {
    const ids = new Set(ready.map((r) => r.t.id));
    if (known.current && ready.some((r) => !known.current!.has(r.t.id))) beep(660);
    known.current = ids;
  });
  return (
    <main className="min-h-dvh p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold">My tables, {me}</h1>
        <label className="flex items-center gap-2">Waiter<select value={me} onChange={(e) => setMe(e.target.value)} className="min-h-11 rounded-xl bg-chip px-3">{WAITERS.map((w) => <option key={w.name}>{w.name}</option>)}</select></label></div>
      <div className="grid gap-6">
        {ready.length > 0 && <section aria-label="Ready to serve" className="rounded-2xl bg-accent p-4 text-accent-ink"><h2 className="text-xl font-bold">Ready to serve</h2><ul className="mt-2 grid gap-2">{ready.map(({ t, o }) => <li key={t.id} className="flex items-center justify-between gap-3 text-lg"><span><b>{o.table}</b> · #{o.number} · {t.station === "kitchen" ? "Kitchen" : "Bar"}: {t.lines.map((l) => `${l.qty} × ${nameOf(l.itemId)}`).join(", ")}</span><button className="min-h-12 rounded-xl bg-bg px-4 font-semibold text-ink" onClick={() => moveTicket(t.id, "SERVED")}>Served</button></li>)}</ul></section>}
        {calls.length > 0 && <section aria-label="Guest requests" className="rounded-2xl bg-surface p-4"><h2 className="text-xl font-semibold">Guest requests</h2><ul className="mt-2 grid gap-2">{calls.map((c) => <li key={c.id} className="flex items-center justify-between"><span>{c.table}: {c.type}</span><button className={btn} onClick={() => dismissCall(c.id)}>Done</button></li>)}</ul></section>}
        {unpaidServed.length > 0 && <section aria-label="Served, waiting for payment" className="rounded-2xl border border-accent p-4"><h2 className="text-xl font-semibold">Served, waiting for payment</h2><ul className="mt-2 grid gap-2">{unpaidServed.map(({ o }) => <li key={o.id} className="flex flex-wrap items-center justify-between gap-2"><span><b>{o.table} · #{o.number}</b> · {formatCad(o.totalCents)}</span><button className={primary} onClick={() => markPaid(o.id)}>Mark paid (cash / terminal)</button></li>)}</ul></section>}
        <section><h2 className="mb-2 text-xl font-semibold">Open orders ({open.length})</h2>{open.length === 0 && <p className="text-muted">No open orders. Place one as a guest first.</p>}
          <div className="grid gap-3 md:grid-cols-2">{open.map(({ o, tickets }) => <article key={o.id} className="rounded-2xl bg-surface p-4"><div className="flex justify-between text-xl"><b>{o.table} · #{o.number}</b><span>{formatCad(o.totalCents)}</span></div>
            <ul className="mt-2 text-sm">{tickets.map((t) => <li key={t.id}>{t.station === "kitchen" ? "Kitchen" : "Bar"}: <b>{t.status}</b></li>)}</ul>
            <div className="mt-3">{o.payStatus === "UNPAID" ? <button className={primary} onClick={() => markPaid(o.id)}>Mark paid (cash / terminal)</button> : <span className="text-ok">Paid</span>}</div></article>)}</div></section>
      </div>
    </main>
  );
}

export function AdminApp() {
  const s = useDemo();
  const paid = s.orders.filter((o) => o.payStatus === "PAID");
  const revenue = s.orders.reduce((n, o) => n + o.totalCents, 0);
  const tips = s.orders.reduce((n, o) => n + o.tipCents, 0);
  const rated = s.orders.filter((o) => o.rating);
  const avg = (k: "food" | "service") => (rated.length ? (rated.reduce((n, o) => n + o.rating![k], 0) / rated.length).toFixed(1) : "-");
  const loads = WAITERS.map((w) => {
    const orders = s.orders.filter((o) => o.waiter === w.name && released(o));
    const open = s.tickets.filter((t) => orders.some((o) => o.id === t.orderId) && t.status !== "SERVED");
    return { name: w.name, tables: new Set(orders.filter((o) => open.some((t) => t.orderId === o.id)).map((o) => o.table)).size, tickets: open.length, score: loadScore({ openTables: new Set(orders.filter((o) => open.some((t) => t.orderId === o.id)).map((o) => o.table)).size, openTickets: open.length, unservedReady: 0 }) };
  });
  const stat = (label: string, value: string) => <div className="rounded-2xl bg-surface p-4"><dt className="text-muted">{label}</dt><dd className="text-3xl font-bold">{value}</dd></div>;
  return (
    <main className="mx-auto min-h-dvh max-w-5xl p-4 pb-16">
      <h1 className="text-3xl font-bold">Admin</h1>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">{stat("Orders", String(s.orders.length))}{stat("Sales incl. GST", formatCad(revenue))}{stat("Tips", formatCad(tips))}{stat("Ratings (food / service)", `${avg("food")} / ${avg("service")}`)}</dl>
      <p className="mt-1 text-sm text-muted">{paid.length} paid · GST 5% · fictional data</p>

      <section className="mt-6 flex flex-wrap gap-3 rounded-2xl bg-surface p-4">
        <button aria-pressed={s.happyHour} className={`${btn} ${s.happyHour ? "!bg-accent text-accent-ink" : ""}`} onClick={() => setHappyHour(!s.happyHour)}>Happy Hour (20% off draft beer): {s.happyHour ? "ON" : "off"}</button>
        <button aria-pressed={s.busyHour} className={`${btn} ${s.busyHour ? "!bg-accent text-accent-ink" : ""}`} onClick={() => setBusy(!s.busyHour)}>Busy hour: {s.busyHour ? "ON" : "off"}</button>
        <button className={btn} onClick={() => { if (confirm("Reset the demo to a clean state?")) resetDemo(); }}>Reset demo</button>
      </section>

      <section className="mt-6"><h2 className="mb-2 text-xl font-semibold">Waiters</h2>
        <table className="w-full text-start"><thead className="text-muted"><tr><th className="text-start">Name</th><th className="text-start">Tables</th><th className="text-start">Tickets</th><th className="text-start">Load</th></tr></thead><tbody>{loads.map((l) => <tr key={l.name} className="border-t border-line"><td className="py-2">{l.name}</td><td>{l.tables}</td><td>{l.tickets}</td><td>{l.score}</td></tr>)}</tbody></table>
        <h3 className="mb-1 mt-4 font-semibold">Reassign an open order</h3>
        <ul className="grid gap-2">{s.orders.filter((o) => released(o) && s.tickets.some((t) => t.orderId === o.id && t.status !== "SERVED")).map((o) => <li key={o.id} className="flex items-center justify-between rounded-xl bg-surface p-3"><span>#{o.number} · {o.table}</span><select value={o.waiter ?? ""} onChange={(e) => reassign(o.id, e.target.value)} className="min-h-11 rounded-xl bg-chip px-3">{WAITERS.map((w) => <option key={w.name}>{w.name}</option>)}</select></li>)}</ul></section>

      <section className="mt-6"><h2 className="mb-2 text-xl font-semibold">Menu: prices and availability</h2>
        {CATEGORIES.map((c) => <div key={c.en} className="mb-4"><h3 className="font-semibold">{c.en}</h3>
          <ul className="mt-1 grid gap-2">{c.items.map((i) => <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface p-3"><span className={isAvailable(s, i.id) ? "" : "text-muted line-through"}>{i.nameEn} · {formatCad(priceOf(s, i.id).cents)}</span>
            <span className="flex gap-2"><label className="sr-only" htmlFor={`p-${i.id}`}>Price for {i.nameEn}</label><input id={`p-${i.id}`} className="min-h-11 w-24 rounded-xl border border-line bg-bg px-2" inputMode="decimal" defaultValue={((s.prices[i.id] ?? i.priceCents) / 100).toFixed(2)} onBlur={(e) => { const v = Math.round(Number(e.target.value) * 100); if (Number.isFinite(v) && v >= 0) setPrice(i.id, v); }} />
              <button className={btn} onClick={() => setAvailable(i.id, !isAvailable(s, i.id))}>{isAvailable(s, i.id) ? "86" : "Back on"}</button></span></li>)}</ul></div>)}</section>
    </main>
  );
}
