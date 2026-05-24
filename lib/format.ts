// Small string helper, relocated from the deleted lib/verdicts/engine.ts.
// Sole production caller: components/GoalRow.tsx.
export function pluralize(n: number, singular: string, plural?: string): string {
  if (n === 1) return singular;
  return plural ?? `${singular}s`;
}
