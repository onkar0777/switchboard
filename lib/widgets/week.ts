// Week-boundary math, relocated from the deleted lib/verdicts/engine.ts.
// Used by lib/widgets/ctx.ts to set the runtime's week window.
const DAY_MS = 24 * 60 * 60 * 1000;

export function mondayOfWeek(d: Date): Date {
  const out = new Date(d);
  const dow = out.getUTCDay();
  const offsetToMonday = (dow + 6) % 7;
  out.setUTCDate(out.getUTCDate() - offsetToMonday);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

export function sundayEndOfWeek(d: Date): Date {
  const monday = mondayOfWeek(d);
  const sun = new Date(monday.getTime() + 6 * DAY_MS);
  sun.setUTCHours(23, 59, 59, 999);
  return sun;
}
