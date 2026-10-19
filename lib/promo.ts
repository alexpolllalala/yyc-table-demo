export const VENUE_TZ = "America/Edmonton";

export type PromoRule = { percentOff: number; startTime: string; endTime: string; days: number[]; categoryId: string | null; active: boolean };

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Weekday (0 = Sunday) and minutes since midnight in the venue time zone. */
export function localParts(now: Date, tz = VENUE_TZ): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** Windows may run past midnight (for example 22:00-02:00); the weekday is the day the window starts. */
export function isPromoActive(rule: PromoRule, now: Date, tz = VENUE_TZ): boolean {
  if (!rule.active) return false;
  const { day, minutes } = localParts(now, tz);
  const start = toMinutes(rule.startTime);
  const end = toMinutes(rule.endTime);
  if (start < end) return rule.days.includes(day) && minutes >= start && minutes < end;
  return (rule.days.includes(day) && minutes >= start) || (rule.days.includes((day + 6) % 7) && minutes < end);
}

/** Best (largest) active discount that applies to the category; null category = whole menu. */
export function discountedPrice(priceCents: number, categoryId: string, promos: PromoRule[], now: Date): { priceCents: number; percentOff: number } {
  const best = promos
    .filter((p) => (p.categoryId === null || p.categoryId === categoryId) && isPromoActive(p, now))
    .reduce((max, p) => Math.max(max, p.percentOff), 0);
  return { priceCents: Math.round((priceCents * (100 - best)) / 100), percentOff: best };
}
