"use client";

import Link from "next/link";
import { useState } from "react";
import Icon from "./Icon";

const FALLBACK_NAMES = { "color-analysis": "Color-Analysis", color: "Color-Analysis", skincare: "Skincare-Analysis", "face-shape": "Face-Shape-Analysis", "body-shape": "Body-Shape-Analysis" };

export function filenameFromDisposition(header, resultType) {
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header || "");
  const name = match ? decodeURIComponent(match[1]).replace(/[\\/]/g, "") : "";
  return name.toLowerCase().endsWith(".pdf") ? name : `MatchMyTone-${FALLBACK_NAMES[resultType] || "Analysis"}.pdf`;
}

/**
 * Result-page action section: Download summary (primary), a module-specific restart action
 * (secondary) and Back to dashboard (quiet). `pending` disables download until the result is saved.
 */
export default function ResultActions({ resultType, resultId, restart, pending = false, pendingLabel = "Saving your result…" }) {
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");

  async function download() {
    if (!resultId || state === "busy") return;
    setState("busy"); setMessage("");
    try {
      const response = await fetch(`/api/quiz/${resultType}/${encodeURIComponent(resultId)}/pdf`, { cache: "no-store" });
      if (response.status === 401) { setState("expired"); setMessage("Your session has ended. Log in again to download your summary."); return; }
      if (!response.ok) throw new Error(response.status === 404 ? "We couldn't find this saved result." : "We couldn't create your summary just now.");
      const blob = await response.blob();
      if (!blob.size || !String(blob.type || response.headers.get("content-type")).includes("pdf")) throw new Error("We couldn't create your summary just now.");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = filenameFromDisposition(response.headers.get("content-disposition"), resultType);
      document.body.appendChild(link); link.click(); link.remove();
      // Revoking immediately can cancel the download in some browsers.
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setState("done"); setMessage(`Downloaded ${link.download}`);
    } catch (error) {
      setState("error"); setMessage(error.message || "We couldn't create your summary just now.");
    }
  }

  const disabled = pending || !resultId || state === "busy";
  const loginHref = typeof window === "undefined" ? "/login" : `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  return (
    <section className="result-actions-panel" aria-labelledby="result-actions-title">
      <div className="result-actions-copy">
        <p className="eyebrow">Keep it close</p>
        <h2 id="result-actions-title">Take your results with you</h2>
        <p>Download a printable summary, or start a fresh analysis whenever you like.</p>
      </div>
      <div className="action-group">
        <button className="btn btn-primary" type="button" onClick={download} disabled={disabled} aria-busy={state === "busy"}>
          {state === "busy" ? <span className="btn-spinner" aria-hidden="true" /> : <Icon name="download" />}
          {state === "busy" ? "Preparing PDF…" : pending ? pendingLabel : "Download summary"}
        </button>
        {restart && <Link className="btn btn-secondary" href={restart.href}><Icon name="refresh" />{restart.label}</Link>}
        <Link className="btn btn-quiet" href="/dashboard"><Icon name="home" />Back to dashboard</Link>
      </div>
      <div className="action-status" role="status" aria-live="polite">
        {state === "done" && <p className="status-success"><Icon name="check" />{message}</p>}
        {state === "error" && <p className="status-error"><Icon name="alert" />{message} <button className="link-button" type="button" onClick={download}>Try again</button></p>}
        {state === "expired" && <p className="status-error"><Icon name="alert" />{message} <a className="link-button" href={loginHref}>Log in</a></p>}
      </div>
    </section>
  );
}
