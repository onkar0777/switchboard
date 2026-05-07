export function MondayMoveCard({ move }: { move: string | null }) {
  if (!move) return null;
  return (
    <section className="rounded-lg border border-stone-900 bg-stone-900 p-5 text-stone-50">
      <p className="text-xs uppercase tracking-wider text-stone-400">Monday Move</p>
      <p className="mt-2 text-lg font-medium">{move}</p>
    </section>
  );
}
