"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { NAV_STORAGE_KEY, readHistory, recordVisit } from "../../lib/navigation";

export default function NavigationTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    const query = searchParams?.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    try {
      window.sessionStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(recordVisit(readHistory(window.sessionStorage), path)));
    } catch { /* Storage can be unavailable (private mode); Back then uses its fallback. */ }
  }, [pathname, searchParams]);
  return null;
}
