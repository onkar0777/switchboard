export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 p-4 md:p-8" aria-busy="true" aria-live="polite">
      <header className="space-y-3 border-b border-stone-200 pb-6">
        <div className="h-2.5 w-20 rounded-sm bg-stone-200" />
        <div className="h-5 w-72 rounded-sm bg-stone-200" />
        <div className="space-y-2 pt-2">
          <div className="h-8 w-full rounded-sm bg-stone-200/80" />
          <div className="h-8 w-5/6 rounded-sm bg-stone-200/80" />
        </div>
      </header>

      <div className="space-y-2 bg-stone-900/95 p-5">
        <div className="h-2.5 w-24 rounded-sm bg-stone-700" />
        <div className="h-5 w-3/4 rounded-sm bg-stone-700" />
      </div>

      <section className="space-y-3 pb-6">
        <div className="h-2.5 w-16 rounded-sm bg-stone-200" />
        <div className="h-14 w-40 rounded-sm bg-stone-200" />
        <div className="h-0.5 w-full bg-stone-200" />
      </section>

      <section className="space-y-3 pb-6">
        <div className="h-2.5 w-20 rounded-sm bg-stone-200" />
        <div className="space-y-2 divide-y divide-stone-100">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-baseline justify-between gap-4 pt-2">
              <div className="h-4 w-1/2 rounded-sm bg-stone-200" />
              <div className="h-3 w-32 rounded-sm bg-stone-200" />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 pb-6">
        <div className="h-2.5 w-28 rounded-sm bg-stone-200" />
        <div className="h-10 w-36 rounded-sm bg-stone-200" />
      </section>
    </main>
  );
}
