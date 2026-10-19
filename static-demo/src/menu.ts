import raw from "./data/menu.generated.json";
import { discountedPrice, type PromoRule } from "../../lib/promo";

export type Lang = "en" | "pa" | "zh-Hans" | "es" | "ar";
export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
  { code: "zh-Hans", label: "简体中文" },
  { code: "es", label: "Español" },
  { code: "ar", label: "العربية" },
];

export type MenuItem = {
  id: string;
  nameEn: string;
  descEn: string;
  priceCents: number;
  station: "kitchen" | "bar";
  allergens: string[];
  dietary: string[];
  available: boolean;
  tr: Partial<Record<Exclude<Lang, "en">, [string, string]>>;
  photo: string | null;
};
export type Category = { en: string; tr: Partial<Record<Exclude<Lang, "en">, string>>; items: MenuItem[] };

export const CATEGORIES = raw as unknown as Category[];
export const ALL_ITEMS: MenuItem[] = CATEGORIES.flatMap((c) => c.items);
export const categoryOf = (itemId: string) => CATEGORIES.find((c) => c.items.some((i) => i.id === itemId))!;

export const EMOJI: Record<string, string> = { Starters: "🍗", Mains: "🍔", Salads: "🥗", Desserts: "🍮", "Draft Beer": "🍺", Wine: "🍷", Cocktails: "🍸", "Non-Alcoholic": "🥤" };

/** Happy Hour: 20% off Draft Beer, always on while the switch is on (a demo has no real clock window). */
export const HAPPY_HOUR_RULE: PromoRule = { percentOff: 20, startTime: "00:00", endTime: "23:59", days: [0, 1, 2, 3, 4, 5, 6], categoryId: "Draft Beer", active: true };

export function localName(item: MenuItem, lang: Lang): string {
  return (lang !== "en" && item.tr[lang]?.[0]) || item.nameEn;
}
export function localDesc(item: MenuItem, lang: Lang): string {
  return (lang !== "en" && item.tr[lang]?.[1]) || item.descEn;
}
export function localCategory(c: Category, lang: Lang): string {
  return (lang !== "en" && c.tr[lang]) || c.en;
}

export function effectivePrice(item: MenuItem, override: number | undefined, happyHour: boolean): { cents: number; original: number; percentOff: number } {
  const base = override ?? item.priceCents;
  if (!happyHour) return { cents: base, original: base, percentOff: 0 };
  const d = discountedPrice(base, categoryOf(item.id).en, [HAPPY_HOUR_RULE], new Date("2026-01-01T12:00:00Z"));
  return { cents: d.priceCents, original: base, percentOff: d.percentOff };
}
