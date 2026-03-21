export default function Loading() {
  return (
    <div className="flex flex-col pt-24 pb-20 px-4 md:px-8 max-w-4xl mx-auto w-full min-h-screen">
      <section className="w-full bg-[#000a1e] rounded-3xl p-6 md:p-8 shadow-[0px_12px_32px_rgba(0,10,30,0.06)] relative overflow-hidden border border-[#000a1e]/10">
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-headline text-2xl font-bold text-white tracking-tight">Activity Feed</h3>
            <span className="px-3 py-1 bg-[#006e0c]/20 text-[#006e0c] rounded-full text-xs font-label font-bold tracking-wide">LOADING</span>
          </div>
          <div className="space-y-4">
            <div className="p-5 rounded-xl bg-white/5 border border-white/10 animate-pulse">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/10 shrink-0"></div>
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-2/3 bg-white/20 rounded-full"></div>
                  <div className="h-3 w-1/3 bg-white/10 rounded-full"></div>
                </div>
              </div>
            </div>
            <div className="p-5 rounded-xl bg-white/5 border border-white/10 animate-pulse delay-75">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/10 shrink-0"></div>
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-3/4 bg-white/20 rounded-full"></div>
                  <div className="h-3 w-1/4 bg-white/10 rounded-full"></div>
                </div>
              </div>
            </div>
            <div className="p-5 rounded-xl bg-white/5 border border-white/10 animate-pulse delay-150">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/10 shrink-0"></div>
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-1/2 bg-white/20 rounded-full"></div>
                  <div className="h-3 w-1/4 bg-white/10 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#006e0c]/10 blur-[100px] -mr-32 -mt-32 rounded-full"></div>
      </section>
    </div>
  );
}
