"use client";

import { useEffect } from "react";

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3500);
    return () => clearTimeout(timer);
  }, [message, onDone]);

  return (
    <div role="status" className="glass fade-in pointer-events-none fixed left-1/2 top-20 z-30 -translate-x-1/2 rounded-full px-4 py-2 text-sm text-ink">
      {message}
    </div>
  );
}
