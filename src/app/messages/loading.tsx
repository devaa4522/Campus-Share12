export default function Loading() {
  return (
    <div className="flex flex-col pt-24 h-screen max-w-7xl mx-auto w-full px-4 md:px-6 py-6 pb-20 md:pb-6 gap-6">
      <section className="w-full md:w-96 bg-surface-container-lowest rounded-3xl p-6 md:p-8 shadow-[0px_12px_32px_rgba(0,10,30,0.06)] border border-[#000a1e]/10">
        <div className="flex justify-between items-center mb-8">
          <h3 className="font-headline text-2xl font-bold text-[#000a1e]">Messages</h3>
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-surface-container-low animate-pulse"></div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-surface-container-highest animate-pulse shrink-0"></div>
            <div className="flex-1 space-y-2">
               <div className="h-4 w-1/4 bg-surface-container-highest animate-pulse rounded-full"></div>
               <div className="h-3 w-full bg-surface-container-low animate-pulse rounded-full"></div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-surface-container-highest animate-pulse shrink-0"></div>
            <div className="flex-1 space-y-2">
               <div className="h-4 w-1/3 bg-surface-container-highest animate-pulse rounded-full"></div>
               <div className="h-3 w-4/5 bg-surface-container-low animate-pulse rounded-full"></div>
            </div>
          </div>
          <div className="flex items-center gap-4 opacity-50">
            <div className="w-12 h-12 rounded-full bg-surface-container-highest animate-pulse shrink-0"></div>
            <div className="flex-1 space-y-2">
               <div className="h-4 w-1/5 bg-surface-container-highest animate-pulse rounded-full"></div>
               <div className="h-3 w-3/4 bg-surface-container-low animate-pulse rounded-full"></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
