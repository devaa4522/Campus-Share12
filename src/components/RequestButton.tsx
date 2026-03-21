"use client";

import { useRouter } from "next/navigation";

export default function RequestButton({
  isLoggedIn,
  itemId,
}: {
  isLoggedIn: boolean;
  itemId: string;
}) {
  const router = useRouter();

  function handleRequest() {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    // TODO: Wire to real borrow request logic
    alert(`Request sent for item ${itemId}! The lender will be notified.`);
  }

  return (
    <button
      onClick={handleRequest}
      className="w-full md:w-auto px-10 py-5 bg-primary text-white text-sm font-bold tracking-[0.15em] uppercase rounded-xl shadow-2xl hover:bg-primary-container transition-all flex items-center justify-center gap-3"
    >
      Request to Borrow
      <span className="material-symbols-outlined">arrow_forward</span>
    </button>
  );
}
