import { useEffect, useMemo, useState } from "react";
import { formatCad, tipCents as tipFromPercent } from "../../lib/money";
import { orderTotals } from "../../lib/pricing";
import { estimateRange, stageFor } from "../../lib/timer";
import { makeT, usePersisted, useNow } from "./i18n";
import { CATEGORIES, EMOJI, LANGS, localCategory, localDesc, localName, ALL_ITEMS, type Lang } from "./menu";
import { addTip, callWaiter, isAvailable, payOnline, placeOrder, priceOf, rate, switchToTable, useDemo, type Order, type Ticket } from "./store";

type Guest = { lang: Lang; consented: boolean; screen: "lang" | "consent" | "menu" | "cart" | "status" | "pay" | "receipt" | "rate"; orderId: string | null; theme: "ember" | "honey" | "copper"; ff: number | null };
type CartLine = { itemId: string; qty: number; note: string };
const ALLERGENS = ["dairy", "gluten", "egg", "fish", "shellfish", "sesame", "soy", "celery", "sulphites"];
const BG = { ember: "fireplace", honey: "mountains", copper: "sea" } as const;
const btn = "min-h-11 rounded-xl bg-chip px-4";
const primary = "min-h-12 w-full rounded-2xl bg-accent px-4 font-semibold text-accent-ink disabled:opacity-60";

export function GuestApp({ table }: { table: string }) {
  const [g, setG] = usePersisted<Guest>("yyc_demo_guest", { lang: "en", consented: false, screen: "lang", orderId: null, theme: "ember", ff: null });
  const [cart, setCart] = usePersisted<CartLine[]>("yyc_cart", []);
  const s = useDemo();
  const t = useMemo(() => makeT(g.lang), [g.lang]);
  const go = (screen: Guest["screen"], extra: Partial<Guest> = {}) => setG((p) => ({ ...p, screen, ...extra }));

  useEffect(() => {
    document.documentElement.lang = g.lang;
    document.documentElement.dir = g.lang === "ar" ? "rtl" : "ltr";
    document.documentElement.dataset.theme = g.theme;
  }, [g.lang, g.theme]);

  const order = s.orders.find((o) => o.id === g.orderId) ?? null;
  const venue = "Ember & Oak Public House";

  return (
    <>
      <div className="guest-bg" aria-hidden="true" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}backgrounds/${BG[g.theme]}.jpg)` }} />
      <div className="guest-shell mx-auto min-h-dvh max-w-md">
        <a href="#/" dir="ltr" className="block bg-bg/70 px-4 pt-2 text-xs text-muted underline">← Demo home (kitchen, bar, waiter, admin)</a>
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-bg/70 px-4 py-3 backdrop-blur-sm">
          <div><div className="text-lg font-semibold">{venue}</div><div className="text-sm text-muted">{t("common.table", { table: table.replace("T", "") })}</div></div>
          <div className="flex items-center gap-2">
            <select aria-label={t("language.title")} value={g.lang} onChange={(e) => setG((p) => ({ ...p, lang: e.target.value as Lang }))} className="min-h-11 rounded-lg bg-chip px-2 text-sm">
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
            {(["ember", "honey", "copper"] as const).map((th) => (
              <button key={th} type="button" data-theme={th} aria-label={t(`theme.${th}`)} onClick={() => setG((p) => ({ ...p, theme: th }))} className="size-11 rounded-full border border-line" style={{ background: "var(--accent)" }} />
            ))}
          </div>
        </header>

        {g.screen === "lang" && <LangScreen g={g} t={t} onPick={(lang) => go("consent", { lang })} />}
        {g.screen === "consent" && <ConsentScreen t={t} venue={venue} onDone={() => go("menu", { consented: true })} />}
        {g.screen === "menu" && <MenuScreen g={g} t={t} cart={cart} setCart={setCart} table={table} onCart={() => go("cart")} onOrder={() => order && go("status")} hasOrder={!!order} />}
        {g.screen === "cart" && <CartScreen g={g} t={t} cart={cart} setCart={setCart} onBack={() => go("menu")} onPlace={(payMethod, allergens) => {
          const id = placeOrder({ table, lang: g.lang, payMethod, allergens, lines: cart });
          setCart([]);
          go(payMethod === "ONLINE" ? "pay" : "status", { orderId: id });
        }} />}
        {g.screen === "status" && order && <StatusScreen g={g} t={t} order={order} setFf={(ff) => setG((p) => ({ ...p, ff }))} onMenu={() => go("menu")} onPay={() => go("pay")} onReceipt={() => go("receipt")} onRate={() => go("rate")} />}
        {g.screen === "pay" && order && <PayScreen t={t} order={order} onDone={() => go("receipt")} onSwitch={() => { switchToTable(order.id); go("status"); }} />}
        {g.screen === "receipt" && order && <ReceiptScreen g={g} t={t} order={order} venue={venue} onBack={() => go("status")} onTip={() => go("pay")} />}
        {g.screen === "rate" && order && <RateScreen t={t} order={order} onDone={() => go("status")} />}
        {(g.screen === "pay" || g.screen === "status" || g.screen === "receipt" || g.screen === "rate") && !order && <p className="p-4">{t("cart.empty")} <button className={btn} onClick={() => go("menu")}>{t("common.back")}</button></p>}
      </div>
    </>
  );
}

function LangScreen({ g, t, onPick }: { g: Guest; t: ReturnType<typeof makeT>; onPick: (l: Lang) => void }) {
  return (
    <main className="p-4">
      <h1 className="mt-4 text-2xl font-semibold">{t("language.title")}</h1>
      <p className="mt-1 text-muted">{t("language.subtitle")}</p>
      <div className="mt-6 grid gap-3">
        {LANGS.map((l) => <button key={l.code} lang={l.code} onClick={() => onPick(l.code)} className={`min-h-14 rounded-2xl border px-4 text-start text-lg ${l.code === g.lang ? "border-accent bg-surface2" : "border-line bg-surface"}`}>{l.label}</button>)}
      </div>
    </main>
  );
}

function ConsentScreen({ t, venue, onDone }: { t: ReturnType<typeof makeT>; venue: string; onDone: () => void }) {
  // Nothing is pre-ticked; newsletter and giveaway are separate.
  const [terms, setTerms] = useState(false);
  const [news, setNews] = useState(false);
  const [give, setGive] = useState(false);
  const [err, setErr] = useState(false);
  const box = "mt-0.5 size-6 shrink-0 accent-[var(--accent)]";
  return (
    <main className="p-4">
      <h1 className="mt-4 text-2xl font-semibold">{t("consent.title")}</h1>
      <div className="mt-5 grid gap-3">
        <label className="flex gap-3 rounded-2xl bg-surface p-4"><input type="checkbox" className={box} checked={terms} onChange={(e) => setTerms(e.target.checked)} /><span>{t("consent.terms")}<span className="block text-sm text-muted">{t("consent.termsRequired")}</span></span></label>
        <label className="flex gap-3 rounded-2xl bg-surface p-4"><input type="checkbox" className={box} checked={news} onChange={(e) => setNews(e.target.checked)} /><span>{t("consent.newsletter", { venue })}</span></label>
        <label className="flex gap-3 rounded-2xl bg-surface p-4"><input type="checkbox" className={box} checked={give} onChange={(e) => setGive(e.target.checked)} /><span>{t("consent.giveaway")}</span></label>
      </div>
      {err && <p role="alert" className="mt-3 text-accent">{t("consent.termsRequired")}</p>}
      <p className="mt-4 text-xs text-muted">{t("consent.draftNote")}</p>
      <button className={`${primary} mt-4`} onClick={() => (terms ? onDone() : setErr(true))}>{t("common.continue")}</button>
    </main>
  );
}

function MenuScreen({ g, t, cart, setCart, table, onCart, onOrder, hasOrder }: { g: Guest; t: ReturnType<typeof makeT>; cart: CartLine[]; setCart: (c: CartLine[] | ((p: CartLine[]) => CartLine[])) => void; table: string; onCart: () => void; onOrder: () => void; hasOrder: boolean }) {
  const s = useDemo();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);
  const [sent, setSent] = useState(false);
  const count = cart.reduce((n, l) => n + l.qty, 0);
  const total = cart.reduce((n, l) => n + priceOf(s, l.itemId).cents * l.qty, 0);
  const chip = (a: boolean) => `min-h-11 shrink-0 rounded-full px-4 ${a ? "bg-accent text-accent-ink" : "bg-chip"}`;
  const add = (itemId: string) => setCart((p) => (p.some((l) => l.itemId === itemId) ? p.map((l) => (l.itemId === itemId ? { ...l, qty: Math.min(20, l.qty + 1) } : l)) : [...p, { itemId, qty: 1, note: "" }]));
  return (
    <main className="pb-40">
      <div className="sticky top-0 z-10 bg-bg/80 p-4 pb-2 backdrop-blur-sm">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("menu.search")} aria-label={t("menu.search")} className="min-h-11 w-full rounded-xl border border-line bg-surface px-3" />
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          <button className={chip(cat === null)} onClick={() => setCat(null)}>{t("menu.all")}</button>
          {CATEGORIES.map((c) => <button key={c.en} className={chip(cat === c.en)} onClick={() => setCat(c.en)}>{localCategory(c, g.lang)}</button>)}
        </div>
      </div>
      {CATEGORIES.filter((c) => !cat || c.en === cat).map((c) => {
        const items = c.items.filter((i) => !q.trim() || `${localName(i, g.lang)} ${localDesc(i, g.lang)}`.toLowerCase().includes(q.trim().toLowerCase()));
        if (!items.length) return null;
        return (
          <section key={c.en} className="px-4">
            <h2 className="mt-4 text-xl font-semibold">{localCategory(c, g.lang)}</h2>
            <ul className="mt-2 grid gap-3">
              {items.map((i) => {
                const p = priceOf(s, i.id);
                const ok = isAvailable(s, i.id);
                return (
                  <li key={i.id} className={`overflow-hidden rounded-2xl bg-surface p-4 ${ok ? "" : "opacity-50"}`}>
                    {i.photo ? <img src={`${import.meta.env.BASE_URL}${i.photo}`} alt="" loading="lazy" className="-mx-4 -mt-4 mb-3 h-44 w-[calc(100%+2rem)] max-w-none rounded-t-2xl object-cover" />
                      : <div aria-hidden="true" className="-mx-4 -mt-4 mb-3 flex h-28 w-[calc(100%+2rem)] items-center justify-center rounded-t-2xl bg-surface2 text-5xl">{EMOJI[c.en] ?? "🍽️"}</div>}
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1"><div className="font-semibold">{localName(i, g.lang)}</div><p className="mt-1 text-sm text-muted">{localDesc(i, g.lang)}</p></div>
                      <div className="shrink-0 text-end font-semibold">{p.percentOff > 0 && <div className="text-sm font-normal text-muted line-through">{formatCad(p.original)}</div>}{formatCad(p.cents)}</div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      {i.allergens.map((a) => <span key={a} className="rounded-full bg-chip px-2 py-1">{t(`allergen.${a}`)}</span>)}
                      {i.dietary.map((d) => <span key={d} className="rounded-full border border-ok px-2 py-1 text-ok">{t(`dietary.${d}`)}</span>)}
                    </div>
                    <div className="mt-3">{ok ? <button className="min-h-11 rounded-xl bg-accent px-5 font-semibold text-accent-ink" onClick={() => add(i.id)}>{t("common.add")}</button> : <span className="text-sm text-muted">{t("menu.soldOut")}</span>}</div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <div className="fixed inset-x-0 bottom-0 mx-auto grid max-w-md gap-2 border-t border-line bg-bg/90 p-3 backdrop-blur-sm">
        {sent && <p role="status" className="text-sm text-ok">{t("call.sent")}</p>}
        {calling ? (
          <div className="flex gap-2">{(["water", "bill", "help"] as const).map((k) => <button key={k} className={`${btn} flex-1`} onClick={() => { callWaiter(table, k); setCalling(false); setSent(true); }}>{t(`call.${k}`)}</button>)}</div>
        ) : <button className={`${btn} w-full`} onClick={() => { setCalling(true); setSent(false); }}>{t("menu.callWaiter")}</button>}
        {hasOrder && <button className={`${btn} w-full`} onClick={onOrder}>{t("status.received")} →</button>}
        {count > 0 && <button className="flex min-h-12 items-center justify-between rounded-2xl bg-accent px-4 font-semibold text-accent-ink" onClick={onCart}><span>{t("menu.viewCart")} ({count})</span><span>{formatCad(total)}</span></button>}
      </div>
    </main>
  );
}

function CartScreen({ g, t, cart, setCart, onBack, onPlace }: { g: Guest; t: ReturnType<typeof makeT>; cart: CartLine[]; setCart: (c: CartLine[] | ((p: CartLine[]) => CartLine[])) => void; onBack: () => void; onPlace: (m: "ONLINE" | "AT_TABLE", allergens: string[]) => void }) {
  const s = useDemo();
  const [allergens, setAllergens] = useState<string[]>([]);
  const totals = orderTotals(cart.map((l) => ({ unitPriceCents: priceOf(s, l.itemId).cents, quantity: l.qty })), 500);
  if (!cart.length) return <main className="p-4"><p className="mt-6 text-muted">{t("cart.empty")}</p><button className={`${btn} mt-4`} onClick={onBack}>{t("common.back")}</button></main>;
  const setQty = (id: string, q: number) => setCart((p) => p.flatMap((l) => (l.itemId !== id ? [l] : q <= 0 ? [] : [{ ...l, qty: Math.min(20, q) }])));
  return (
    <main className="p-4 pb-8">
      <button className="min-h-11 text-muted" onClick={onBack}>← {t("common.back")}</button>
      <h1 className="text-2xl font-semibold">{t("cart.title")}</h1>
      <ul className="mt-3 grid gap-3">
        {cart.map((l) => {
          const item = ALL_ITEMS.find((i) => i.id === l.itemId)!;
          return (
            <li key={l.itemId} className="rounded-2xl bg-surface p-4">
              <div className="flex justify-between gap-3"><span className="font-semibold">{localName(item, g.lang)}</span><span>{formatCad(priceOf(s, l.itemId).cents * l.qty)}</span></div>
              <div className="mt-2 flex items-center gap-3">
                <button aria-label={t("common.remove")} className="size-11 rounded-xl bg-chip text-xl" onClick={() => setQty(l.itemId, l.qty - 1)}>−</button><span className="w-6 text-center">{l.qty}</span>
                <button aria-label={t("common.add")} className="size-11 rounded-xl bg-chip text-xl" onClick={() => setQty(l.itemId, l.qty + 1)}>+</button>
              </div>
              <input value={l.note} maxLength={200} onChange={(e) => setCart((p) => p.map((x) => (x.itemId === l.itemId ? { ...x, note: e.target.value } : x)))} placeholder={t("cart.note")} aria-label={t("cart.note")} className="mt-2 min-h-11 w-full rounded-xl border border-line bg-bg px-3" />
            </li>
          );
        })}
      </ul>
      <h2 className="mt-5 font-semibold">{t("cart.allergenPick")}</h2>
      <div className="mt-2 flex flex-wrap gap-2">{ALLERGENS.map((a) => <button key={a} aria-pressed={allergens.includes(a)} onClick={() => setAllergens((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]))} className={`min-h-11 rounded-full px-4 ${allergens.includes(a) ? "bg-accent text-accent-ink" : "bg-chip"}`}>{t(`allergen.${a}`)}</button>)}</div>
      <dl className="mt-5 grid grid-cols-2 gap-y-1"><dt className="text-muted">{t("cart.subtotal")}</dt><dd className="text-end">{formatCad(totals.subtotalCents)}</dd><dt className="text-muted">{t("cart.gst")}</dt><dd className="text-end">{formatCad(totals.gstCents)}</dd><dt className="font-semibold">{t("common.total")}</dt><dd className="text-end font-semibold">{formatCad(totals.totalCents)}</dd></dl>
      <h2 className="mt-6 font-semibold">{t("cart.payHow")}</h2>
      <div className="mt-2 grid gap-3">
        <button className="min-h-14 rounded-2xl bg-accent px-4 py-2 text-start font-semibold text-accent-ink" onClick={() => onPlace("ONLINE", allergens)}><span className="block text-lg">{t("cart.payNow")}</span><span className="block text-sm font-normal">{t("cart.payNowHint")}</span></button>
        <button className="min-h-14 rounded-2xl bg-chip px-4 py-2 text-start font-semibold" onClick={() => onPlace("AT_TABLE", allergens)}><span className="block text-lg">{t("cart.payLater")}</span><span className="block text-sm font-normal">{t("cart.payLaterHint")}</span></button>
      </div>
    </main>
  );
}

const STEPS = ["RECEIVED", "ACCEPTED", "PREPARING", "READY", "SERVED"] as const;

function StatusScreen({ g, t, order, setFf, onMenu, onPay, onReceipt, onRate }: { g: Guest; t: ReturnType<typeof makeT>; order: Order; setFf: (f: number | null) => void; onMenu: () => void; onPay: () => void; onReceipt: () => void; onRate: () => void }) {
  const s = useDemo();
  const now = useNow();
  const tickets = s.tickets.filter((x) => x.orderId === order.id);
  const awaiting = order.payMethod === "ONLINE" && order.payStatus === "UNPAID";
  const served = tickets.every((x) => x.status === "SERVED");
  return (
    <main className="p-4 pb-10">
      <h1 className="mt-2 text-2xl font-semibold">#{order.number}</h1>
      <p className="text-muted">{t("common.table", { table: order.table.replace("T", "") })} · {formatCad(order.totalCents)}</p>
      {tickets.map((tk) => <TicketCard key={tk.id} g={g} t={t} tk={tk} awaiting={awaiting} now={now} />)}
      {awaiting && <button className={`${primary} mt-6`} onClick={onPay}>{t("pay.payNow")}</button>}
      {awaiting && <button className="mt-3 min-h-12 w-full rounded-2xl bg-chip" onClick={() => { switchToTable(order.id); }}>{t("pay.switchToTable")}</button>}
      {order.payStatus === "UNPAID" && !awaiting && <button className={`${primary} mt-6`} onClick={onPay}>{t("pay.payNow")}</button>}
      {order.payStatus === "PAID" && <button className={`${primary} mt-6`} onClick={onReceipt}>{t("pay.receipt")}</button>}
      {served && <button className="mt-3 min-h-12 w-full rounded-2xl bg-chip" onClick={onRate}>{t("rating.link")}</button>}
      <button className="mt-3 min-h-12 w-full rounded-2xl bg-chip" onClick={onMenu}>{t("status.orderMore")}</button>
      <div className="mt-6 rounded-2xl border border-dashed border-line p-3 text-sm">
        <div className="mb-2 text-muted">Demo: fast forward time</div>
        <div className="flex flex-wrap gap-2">{[0, 30, 70, 95, 110].map((p) => <button key={p} className={btn} onClick={() => setFf(p / 100)}>{p}%</button>)}<button className={btn} onClick={() => setFf(null)}>Real time</button></div>
      </div>
    </main>
  );
}

function TicketCard({ g, t, tk, awaiting, now }: { g: Guest; t: ReturnType<typeof makeT>; tk: Ticket; awaiting: boolean; now: number }) {
  const timed = tk.status === "ACCEPTED" || tk.status === "PREPARING";
  const at = timed && g.ff !== null && tk.acceptedAt && tk.expectedMin ? tk.acceptedAt + g.ff * tk.expectedMin * 60_000 : now;
  const { stage, fraction } = stageFor(tk.acceptedAt ? new Date(tk.acceptedAt) : null, tk.expectedMin, new Date(at));
  const range = tk.expectedMin ? estimateRange(tk.expectedMin) : null;
  const step = STEPS.indexOf(tk.status);
  const msg = awaiting ? t("status.awaitingPayment") : tk.status === "RECEIVED" ? t("status.waiting") : tk.status === "READY" ? t("status.stage3") : tk.status === "SERVED" ? t("status.served") : stage === "late" ? t("status.stageLate") : stage === "waiting" ? t("status.waiting") : t(`status.stage${stage}`);
  return (
    <section className="mt-5 rounded-2xl bg-surface p-4">
      <ol className="flex justify-between text-xs">{STEPS.map((x, i) => <li key={x} className={i <= step ? "font-semibold text-accent" : "text-muted"}>{t(`status.${x.toLowerCase()}`)}</li>)}</ol>
      {timed && <div className="mt-3 h-2 overflow-hidden rounded-full bg-chip" role="progressbar" aria-valuenow={Math.min(100, Math.round(fraction * 100))}><div className="h-full bg-accent" style={{ width: `${Math.min(100, fraction * 100)}%` }} /></div>}
      <p className="mt-3" data-testid="stage-message">{msg}</p>
      {timed && range && <p className="text-sm text-muted">{t("status.estimate", range)}</p>}
      <ul className="mt-3 grid gap-1 text-sm">{tk.lines.map((l, i) => { const it = ALL_ITEMS.find((x) => x.id === l.itemId)!; return <li key={i}>{l.qty} × {localName(it, g.lang)}</li>; })}</ul>
    </section>
  );
}

function PayScreen({ t, order, onDone, onSwitch }: { t: ReturnType<typeof makeT>; order: Order; onDone: () => void; onSwitch: () => void }) {
  const presets = [10, 15, 20];
  const [choice, setChoice] = useState<number | "custom" | "none">(order.payStatus === "PAID" ? 15 : "none");
  const [custom, setCustom] = useState("");
  const [paying, setPaying] = useState(false);
  const tipOnly = order.payStatus === "PAID";
  const tip = typeof choice === "number" ? tipFromPercent(order.subtotalCents, choice) : choice === "custom" ? Math.max(0, Math.round((Number(custom) || 0) * 100)) : 0;
  const total = (tipOnly ? 0 : order.subtotalCents + order.gstCents) + tip;
  const chip = (a: boolean) => `min-h-12 rounded-xl px-4 ${a ? "bg-accent text-accent-ink" : "bg-chip"}`;
  if (paying) {
    return (
      <main className="p-4">
        <div className="rounded-2xl bg-white p-5 text-black">
          <div className="text-sm font-semibold text-indigo-700">Stripe test checkout (demo)</div>
          <div className="mt-1 text-2xl font-bold">{formatCad(total)}</div>
          <div className="mt-3 grid gap-2 text-sm">
            <input readOnly value="4242 4242 4242 4242" className="min-h-11 rounded-lg border border-neutral-300 px-3" aria-label="Card number" />
            <div className="grid grid-cols-2 gap-2"><input readOnly value="12 / 34" className="min-h-11 rounded-lg border border-neutral-300 px-3" aria-label="Expiry" /><input readOnly value="123" className="min-h-11 rounded-lg border border-neutral-300 px-3" aria-label="CVC" /></div>
          </div>
          <button className="mt-4 min-h-12 w-full rounded-lg bg-indigo-600 font-semibold text-white" onClick={() => { if (tipOnly) addTip(order.id, order.tipCents + tip); else payOnline(order.id, tip); onDone(); }}>Pay {formatCad(total)}</button>
          <p className="mt-2 text-xs text-neutral-500">Test card. No real money. This is a mock of Stripe&apos;s hosted page.</p>
        </div>
      </main>
    );
  }
  return (
    <main className="p-4 pb-10">
      <h1 className="mt-2 text-2xl font-semibold">{tipOnly ? t("pay.addTip") : t("pay.title")}</h1>
      {!tipOnly && <dl className="mt-4 grid grid-cols-2 gap-y-1"><dt className="text-muted">{t("cart.subtotal")}</dt><dd className="text-end">{formatCad(order.subtotalCents)}</dd><dt className="text-muted">{t("cart.gst")}</dt><dd className="text-end">{formatCad(order.gstCents)}</dd></dl>}
      <h2 className="mt-5 font-semibold">{t("cart.tip")}</h2>
      {order.waiter && <p className="text-sm text-muted">{t("pay.tipFor", { waiter: order.waiter })}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {presets.map((p) => <button key={p} aria-pressed={choice === p} className={chip(choice === p)} onClick={() => setChoice(p)}>{p}%</button>)}
        <button aria-pressed={choice === "custom"} className={chip(choice === "custom")} onClick={() => setChoice("custom")}>{t("pay.tipCustom")}</button>
        {!tipOnly && <button aria-pressed={choice === "none"} className={chip(choice === "none")} onClick={() => setChoice("none")}>{t("pay.tipNone")}</button>}
      </div>
      {choice === "custom" && <input value={custom} onChange={(e) => setCustom(e.target.value)} inputMode="decimal" aria-label={t("pay.tipAmount")} placeholder={t("pay.tipAmount")} className="mt-3 min-h-11 w-full rounded-xl border border-line bg-surface px-3" />}
      <dl className="mt-5 grid grid-cols-2 gap-y-1"><dt className="text-muted">{t("cart.tip")}</dt><dd className="text-end">{formatCad(tip)}</dd><dt className="font-semibold">{t("common.total")}</dt><dd className="text-end font-semibold">{formatCad(total)}</dd></dl>
      <button disabled={total === 0} className={`${primary} mt-5`} onClick={() => setPaying(true)}>{t("pay.pay", { amount: formatCad(total) })}</button>
      {!tipOnly && order.payMethod === "ONLINE" && <button className="mt-3 min-h-12 w-full rounded-2xl bg-chip" onClick={onSwitch}>{t("pay.switchToTable")}</button>}
    </main>
  );
}

function ReceiptScreen({ g, t, order, venue, onBack, onTip }: { g: Guest; t: ReturnType<typeof makeT>; order: Order; venue: string; onBack: () => void; onTip: () => void }) {
  const s = useDemo();
  const lines = s.tickets.filter((x) => x.orderId === order.id).flatMap((x) => x.lines);
  const served = s.tickets.filter((x) => x.orderId === order.id).every((x) => x.status === "SERVED");
  return (
    <main className="p-4 pb-10">
      <h1 className="mt-2 text-2xl font-semibold">{t("pay.receipt")} #{order.number}</h1>
      <p className="text-muted">{venue} · {t("common.table", { table: order.table.replace("T", "") })}</p>
      <ul className="mt-4 grid gap-1">{lines.map((l, i) => <li key={i} className="flex justify-between gap-3"><span>{l.qty} × {localName(ALL_ITEMS.find((x) => x.id === l.itemId)!, g.lang)}</span><span>{formatCad(l.unitCents * l.qty)}</span></li>)}</ul>
      <dl className="mt-4 grid grid-cols-2 gap-y-1 border-t border-line pt-3"><dt className="text-muted">{t("cart.subtotal")}</dt><dd className="text-end">{formatCad(order.subtotalCents)}</dd><dt className="text-muted">{t("cart.gst")} (5%)</dt><dd className="text-end">{formatCad(order.gstCents)}</dd><dt className="text-muted">{t("cart.tip")}</dt><dd className="text-end">{formatCad(order.tipCents)}</dd><dt className="font-semibold">{t("common.total")}</dt><dd className="text-end font-semibold">{formatCad(order.totalCents)}</dd></dl>
      <p className="mt-3 font-semibold text-ok">{order.payStatus === "PAID" ? t("pay.paidStamp") : ""}</p>
      {order.payStatus === "PAID" && order.tipCents === 0 && served && <button className={`${primary} mt-4`} onClick={onTip}>{t("pay.addTip")}</button>}
      <button className="mt-3 min-h-12 w-full rounded-2xl bg-chip" onClick={onBack}>{t("common.back")}</button>
    </main>
  );
}

function RateScreen({ t, order, onDone }: { t: ReturnType<typeof makeT>; order: Order; onDone: () => void }) {
  const [food, setFood] = useState(order.rating?.food ?? 0);
  const [service, setService] = useState(order.rating?.service ?? 0);
  const [comment, setComment] = useState("");
  const [praise, setPraise] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const stars = (label: string, v: number, set: (n: number) => void) => (
    <fieldset className="mt-5"><legend className="font-semibold">{label}</legend><div className="mt-2 flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} aria-label={t("rating.stars", { n })} className={`size-12 rounded-xl text-2xl ${n <= v ? "bg-accent text-accent-ink" : "bg-chip"}`} onClick={() => set(n)}>★</button>)}</div></fieldset>
  );
  if (done) return <main className="p-4"><p role="status" className="mt-6 text-2xl font-semibold">{t("rating.thanks")}</p><button className={`${btn} mt-4`} onClick={onDone}>{t("common.back")}</button></main>;
  return (
    <main className="p-4 pb-10">
      <h1 className="mt-2 text-2xl font-semibold">{t("rating.title")}</h1>
      {stars(t("rating.food"), food, setFood)}{stars(t("rating.service"), service, setService)}
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("rating.comment")} aria-label={t("rating.comment")} rows={3} className="mt-5 w-full rounded-xl border border-line bg-surface p-3" />
      {order.waiter && <div className="mt-4"><p className="font-semibold">{t("rating.praise", { waiter: order.waiter })}</p><div className="mt-2 flex flex-wrap gap-2">{(["friendly", "fast", "helpful", "recommendations"] as const).map((k) => <button key={k} aria-pressed={praise.includes(k)} className={`min-h-11 rounded-full px-4 ${praise.includes(k) ? "bg-accent text-accent-ink" : "bg-chip"}`} onClick={() => setPraise((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))}>{t(`rating.${k}`)}</button>)}</div></div>}
      <button disabled={!food || !service} className={`${primary} mt-6`} onClick={() => { rate(order.id, { food, service, comment, praise }); setDone(true); }}>{t("rating.submit")}</button>
    </main>
  );
}
