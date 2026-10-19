import { useEffect, useState } from "react";
import en from "../../messages/en.json";
import pa from "../../messages/pa.json";
import zh from "../../messages/zh-Hans.json";
import es from "../../messages/es.json";
import ar from "../../messages/ar.json";
import type { Lang } from "./menu";

const DICTS: Record<Lang, unknown> = { en, pa, "zh-Hans": zh, es, ar };

/** Same message files as the real app; supports {name} placeholders. */
export function makeT(lang: Lang) {
  return (key: string, vars: Record<string, string | number> = {}): string => {
    let node: unknown = DICTS[lang];
    for (const part of key.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
    const text = typeof node === "string" ? node : key;
    return text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
  };
}

export function useNow(everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), everyMs); return () => clearInterval(id); }, [everyMs]);
  return now;
}

export function usePersisted<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : initial; } catch { return initial; }
  });
  const set = (v: T | ((p: T) => T)) => setValue((prev) => {
    const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
    return next;
  });
  return [value, set];
}
