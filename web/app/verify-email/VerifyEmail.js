"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogoMark } from "../components/Logo";

const STATES = {
  verifying: { title: "Verifying your email…", tone: "auth-intro" },
  verified: { title: "Email verified.", tone: "form-success" },
  already: { title: "Email already verified.", tone: "form-success" },
  expired: { title: "This link has expired.", tone: "form-error" },
  invalid: { title: "This link isn't valid.", tone: "form-error" },
  unavailable: { title: "Verification is temporarily unavailable.", tone: "form-error" },
};

/** Token from the link: the URL fragment (#token=…, never sent to a server) or, for older links, ?token=. */
function readToken(fallback) {
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("token");
  return fromHash || fallback || "";
}

function stateFor(ok, status, data) {
  if (ok) return data.status === "already_verified" ? "already" : "verified";
  if (data.errorCode === "token_expired") return "expired";
  if (["invalid_token", "token_used", "token_superseded"].includes(data.errorCode)) return "invalid";
  return status >= 500 || !status ? "unavailable" : "invalid";
}

/** Confirms the emailed token with the backend once (a POST, so prefetching link scanners can't use it up). */
export default function VerifyEmail({ token: queryToken = "" }) {
  const [state, setState] = useState({ kind: "verifying", text: "" });
  const [resend, setResend] = useState({ email: "", status: "idle", text: "" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = readToken(queryToken);
    // Keep the token out of the address bar, history and any later Referer header.
    window.history.replaceState(null, "", "/verify-email");
    if (!token) { setState({ kind: "invalid", text: "This verification link is incomplete. Request a new one below." }); return; }
    fetch("/api/auth/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (response) => ({ ok: response.ok, status: response.status, data: await response.json().catch(() => ({})) }))
      .then(({ ok, status, data }) => {
        const kind = stateFor(ok, status, data);
        const fallback = kind === "unavailable" ? "We couldn't reach MatchMyTone just now. Please open the link again in a few minutes." : "";
        setState({ kind, text: kind === "unavailable" ? fallback : data.message || data.error || fallback });
      })
      .catch(() => setState({ kind: "unavailable", text: "We couldn't reach MatchMyTone just now. Please open the link again in a few minutes." }));
  }, [queryToken]);

  async function requestNewLink(event) {
    event.preventDefault();
    if (resend.status === "busy") return;
    setResend((current) => ({ ...current, status: "busy", text: "" }));
    try {
      const response = await fetch("/api/auth/resend-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: resend.email.trim() }) });
      const data = await response.json().catch(() => ({}));
      setResend((current) => ({ ...current, status: response.ok ? "sent" : "error", text: data.message || data.error || "We couldn't send a new link. Please try again later." }));
    } catch {
      setResend((current) => ({ ...current, status: "error", text: "We couldn't reach MatchMyTone. Please try again." }));
    }
  }

  const view = STATES[state.kind];
  const done = state.kind === "verified" || state.kind === "already";
  const canResend = state.kind === "expired" || state.kind === "invalid";
  return (
    <section className="auth-card">
      <LogoMark size={52} className="auth-mark" />
      <p className="eyebrow">Welcome to MatchMyTone</p>
      <h1>{view.title}</h1>
      <p className={view.tone} role="status" aria-live="polite">{state.kind === "verifying" ? "This only takes a moment." : state.text}</p>
      {done && <Link className="gold-button auth-submit" href="/login">Go to login<span aria-hidden="true">↗</span></Link>}
      {canResend && (
        <form className="auth-form" onSubmit={requestNewLink} noValidate>
          <label><span>Email address</span><input type="email" value={resend.email} onChange={(event) => setResend({ email: event.target.value, status: "idle", text: "" })} autoComplete="email" required /></label>
          {resend.text && <p className={resend.status === "error" ? "form-error" : "form-success"} role="status">{resend.text}</p>}
          <button className="gold-button auth-submit" type="submit" disabled={resend.status === "busy" || !resend.email.trim()}>{resend.status === "busy" ? "Sending…" : "Send a new verification link"}<span aria-hidden="true">↗</span></button>
        </form>
      )}
      {!done && state.kind !== "verifying" && <Link className="auth-secondary-link" href="/login">Back to login</Link>}
    </section>
  );
}
