"use client";

import { useRouter } from "next/navigation";
import { previousSafePath, readHistory } from "../../lib/navigation";
import Icon from "./Icon";

/**
 * Consistent Back control. Uses browser history only when the previous entry is a safe
 * in-app page; otherwise navigates to `fallback`. `confirmLeave` guards unsaved work.
 */
export default function BackButton({ fallback, label = "Back", scope = "app", confirmLeave, className = "" }) {
  const router = useRouter();
  function goBack() {
    const message = typeof confirmLeave === "function" ? confirmLeave() : confirmLeave;
    if (message && !window.confirm(message)) return;
    const current = `${window.location.pathname}${window.location.search}`;
    let previous = null;
    try { previous = previousSafePath(readHistory(window.sessionStorage), current, scope); } catch { previous = null; }
    if (previous) router.back();
    else router.push(fallback);
  }
  return <button type="button" className={`back-button ${className}`.trim()} onClick={goBack}><Icon name="arrow-left" /><span>{label}</span></button>;
}
