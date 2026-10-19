import { useEffect, useState } from "react";
import { AdminApp, Kds, WaiterApp } from "./Staff";
import { GuestApp } from "./Guest";

const useHash = () => {
  const [h, setH] = useState(() => location.hash || "#/");
  useEffect(() => { const f = () => setH(location.hash || "#/"); window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); }, []);
  return h;
};

function Nav() {
  const link = "flex min-h-11 items-center rounded-xl bg-chip px-4";
  return (
    <nav className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur">
      <a href="#/" className="me-2 font-bold">YYC Table demo</a>
      <a className={link} href="#/guest/T7">Guest</a><a className={link} href="#/kitchen">Kitchen</a><a className={link} href="#/bar">Bar</a><a className={link} href="#/waiter">Waiter</a><a className={link} href="#/admin">Admin</a>
    </nav>
  );
}

function Landing() {
  const card = "rounded-2xl bg-surface p-5";
  const btn = "mt-3 flex min-h-12 w-full items-center justify-center rounded-xl bg-accent px-4 font-semibold text-accent-ink";
  return (
    <main className="mx-auto max-w-3xl p-5 pb-16">
      <h1 className="text-3xl font-bold">YYC Table: interactive demo</h1>
      <p className="mt-2 text-lg text-muted">QR-code ordering, kitchen screens and payments for pubs, bars and cafes. Fictional venue: Ember &amp; Oak Public House, Calgary.</p>
      <section className={`${card} mt-6`}><h2 className="text-xl font-semibold">1. Order as a guest (best on a phone)</h2><p className="mt-1 text-muted">Five languages including right-to-left Arabic, three colour themes, photos, allergens, tips.</p><a className={btn} href="#/guest/T7">Open Table 7 as a guest</a></section>
      <section className={`${card} mt-4`}><h2 className="text-xl font-semibold">2. Watch the order arrive (open in a second tab)</h2><p className="mt-1 text-muted">The kitchen, bar and waiter screens share the guest&apos;s order in this browser. Press Accept, then Ready, then Served and watch the guest status change.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><a className={btn} href="#/kitchen" target="_blank" rel="noreferrer">Kitchen screen</a><a className={btn} href="#/bar" target="_blank" rel="noreferrer">Bar screen</a><a className={btn} href="#/waiter" target="_blank" rel="noreferrer">Waiter screen</a><a className={btn} href="#/admin" target="_blank" rel="noreferrer">Admin: prices, 86, Happy Hour</a></div></section>
      <section className={`${card} mt-4`}><h2 className="text-xl font-semibold">About this demo</h2>
        <ul className="mt-2 list-disc space-y-1 ps-5"><li>It runs entirely in your browser: no server, no database, no real payments. Your orders stay on your device.</li><li>Staff always see English item names; guest notes are shown with the original next to them.</li><li>The real application also has: Stripe test checkout, live kitchen updates, giveaways with a budget cap, guest list with consent records, reports and more.</li><li>Translations and legal texts here are drafts.</li></ul></section>
    </main>
  );
}

export default function App() {
  const h = useHash();
  useEffect(() => { if (!h.startsWith("#/guest")) { document.documentElement.dir = "ltr"; document.documentElement.lang = "en"; if (!h.startsWith("#/guest")) document.documentElement.dataset.theme = "ember"; } }, [h]);
  const page = h.startsWith("#/guest") ? <GuestApp table={h.split("/")[2] || "T7"} />
    : h.startsWith("#/kitchen") ? <Kds station="kitchen" /> : h.startsWith("#/bar") ? <Kds station="bar" />
    : h.startsWith("#/waiter") ? <WaiterApp /> : h.startsWith("#/admin") ? <AdminApp /> : <Landing />;
  return <>{!h.startsWith("#/guest") && <Nav />}{page}</>;
}
