export default function Loading() {
  return (
    <div className="flex flex-col pt-24 pb-20 px-6 max-w-7xl mx-auto w-full">
      <section className="w-full bg-surface-container-lowest rounded-3xl p-8 shadow-[0px_12px_32px_rgba(0,10,30,0.06)] overflow-hidden relative group border border-outline-variant/10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-headline text-lg font-bold text-primary">Task Marketplace</h3>
          <span className="material-symbols-outlined text-on-surface-variant text-sm">task_alt</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-1 md:col-span-2 h-32 bg-surface-container-highest animate-pulse rounded-xl relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite]"></div>
          </div>
          <div className="h-48 bg-surface-container-highest/60 animate-pulse rounded-xl"></div>
          <div className="h-48 bg-surface-container-highest/60 animate-pulse rounded-xl"></div>
        </div>
        <div className="mt-8 space-y-4">
          <div className="h-5 w-3/4 bg-surface-container-highest rounded-full animate-pulse"></div>
          <div className="h-5 w-1/2 bg-surface-container-highest rounded-full animate-pulse"></div>
        </div>
      </section>
    </div>
  );
}
