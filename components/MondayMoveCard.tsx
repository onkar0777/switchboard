import { EYEBROW } from "@/lib/design-tokens";

export function MondayMoveCard({ move }: { move: string | null }) {
  if (!move) return null;
  return (
    <section className="bg-stone-900 px-5 py-4 text-stone-50">
      <p className={`${EYEBROW} text-stone-400`}>Monday Move</p>
      <p className="mt-2 font-serif text-[22px] leading-snug">{move}</p>
    </section>
  );
}
