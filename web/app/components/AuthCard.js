"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CATALOG_CHOICES } from "../../lib/preferences";
import ChoiceChips from "./ChoiceChips";
import { LogoMark } from "./Logo";
import { calculateAgeFromDob, todayAsDateInputValue } from "./dateValidation";

const passwordRules = [
  ["length", "At least 8 characters", (value) => value.length >= 8],
  ["upper", "One uppercase letter", (value) => /[A-Z]/.test(value)],
  ["lower", "One lowercase letter", (value) => /[a-z]/.test(value)],
  ["number", "One number", (value) => /[0-9]/.test(value)],
  ["special", "One special character", (value) => /[^A-Za-z0-9]/.test(value)],
];

function validPassword(value) { return passwordRules.every(([, , test]) => test(value)); }

export default function AuthCard({ mode }) {
  const [form, setForm] = useState({ name: "", gender: "", catalog: "", phone: "", email: "", dob: "", age: "", password: "", confirm: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  // Email of an account that still needs verifying (after registering, or when login is refused for it).
  const [verifyEmail, setVerifyEmail] = useState("");
  const [resend, setResend] = useState({ state: "idle", text: "" });
  const isLogin = mode === "login";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";
  const today = useMemo(() => todayAsDateInputValue(), []);

  function update(field, value) {
    if (field === "dob") {
      const result = calculateAgeFromDob(value);
      setForm((previous) => ({ ...previous, dob: value, age: result.age === null ? "" : String(result.age) }));
      setFieldErrors((previous) => ({ ...previous, dob: value ? result.error : "Date of birth is required.", age: result.error || "" }));
    } else {
      setForm((previous) => ({ ...previous, [field]: value }));
      setFieldErrors((previous) => ({ ...previous, [field]: "" }));
    }
    setError("");
    setMessage("");
  }

  function validate() {
    const next = {};
    if (isForgot) {
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "A valid email is required.";
      return next;
    }
    if (isLogin || isReset) {
      if (isLogin && !/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "A valid email is required.";
      if (!form.password) next.password = isReset ? "New password is required." : "Password is required.";
      if (isReset && !form.confirm) next.confirm = "Please confirm your new password.";
      if (isReset && form.password && !validPassword(form.password)) next.password = "Password must meet all requirements below.";
      if (isReset && form.password !== form.confirm) next.confirm = "Passwords do not match.";
      return next;
    }
    if (!form.name.trim()) next.name = "Full name is required.";
    if (!form.email.trim()) next.email = "Email is required.";
    else if (!/^\S+@\S+\.\S+$/i.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (!/^\d{10}$/.test(form.phone)) next.phone = "Phone number must be exactly 10 digits.";
    const dobResult = calculateAgeFromDob(form.dob);
    if (dobResult.error) next.dob = dobResult.error;
    if (dobResult.age === null) next.age = dobResult.error || "Age could not be calculated.";
    else if (String(dobResult.age) !== String(form.age)) next.age = "Age does not match the date of birth.";
    if (!form.password) next.password = "Password is required.";
    else if (!validPassword(form.password)) next.password = "Password must meet all requirements below.";
    if (!form.confirm) next.confirm = "Please confirm your password.";
    else if (form.password !== form.confirm) next.confirm = "Passwords do not match.";
    return next;
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError(""); setMessage("");
    const nextErrors = validate();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) { setError("Please correct the highlighted fields."); return; }
    const resetToken = isReset ? new URLSearchParams(window.location.search).get("token") : "";
    if (isReset && !resetToken) { setError("This reset link is incomplete. Request a new password reset email."); return; }
    setBusy(true);
    try {
      const endpoint = isLogin ? "/api/auth/login" : isForgot ? "/api/auth/request-password-reset" : isReset ? "/api/auth/reset-password" : "/api/auth/register";
      const payload = isLogin ? { email: form.email.trim(), password: form.password } : isForgot ? { email: form.email.trim() } : isReset ? { token: resetToken, password: form.password } :{ name: form.name.trim(), email: form.email.trim(), phone: form.phone, password: form.password, ...(form.gender ? { gender: form.gender } : {}), ...(form.catalog ? { style_preferences: { catalog: form.catalog } } : {}), dob: form.dob, age: Number(form.age) };
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok && data.requires_verification) setVerifyEmail(form.email.trim());
      if (!response.ok) throw new Error(data.error || data.message || "Request failed. Please try again.");
      if (isLogin) {
        const requested = new URLSearchParams(window.location.search).get("next");
        const destination = requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard";
        window.location.assign(destination);
        return;
      }
      if (data.requires_verification) setVerifyEmail(form.email.trim());
      setForm({ name: "", gender: "", catalog: "", phone: "", email: "", dob: "", age: "", password: "", confirm: "" });
      setFieldErrors({});
      // An account whose verification email couldn't be sent is reported as a problem, never as a success.
      if (data.verification_email_sent === false && data.requires_verification) setError(data.message);
      else setMessage(data.message || (isReset ? "Password updated. You can log in now." : isForgot ? "If that email is registered, a reset link has been sent." : "Registration successful."));
    } catch (requestError) { setError(requestError.message); } finally { setBusy(false); }
  }

  async function resendVerification() {
    if (resend.state === "busy" || !verifyEmail) return;
    setResend({ state: "busy", text: "" });
    try {
      const response = await fetch("/api/auth/resend-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: verifyEmail }) });
      const data = await response.json().catch(() => ({}));
      setResend(response.ok ? { state: "sent", text: data.message || "If that account needs verification, a new link has been sent." } : { state: "error", text: data.error || "We couldn't send a new link. Please try again later." });
    } catch {
      setResend({ state: "error", text: "We couldn't reach MatchMyTone. Please try again." });
    }
  }

  const field = (name, control) => <label>{control}<span className="field-error" role="alert">{fieldErrors[name]}</span></label>;

  return <section className="auth-card">
    <LogoMark size={52} className="auth-mark" />
    <p className="eyebrow">{isForgot || isReset ? "A fresh start" : "Welcome to MatchMyTone"}</p>
    <h1>{isLogin ? "Welcome back." : isForgot ? "Reset your password." : isReset ? "Choose a new password." : "Create your account."}</h1>
    <p className="auth-intro">{isLogin ? "Sign in to continue your personal style discovery." : isForgot ? "Enter your account email and we will send you a secure reset link." : isReset ? "Create a new password for your account." : "Save your discoveries and return to them anytime."}</p>
    <form className="auth-form" onSubmit={submit} noValidate>
      {!isLogin && !isForgot && !isReset && field("name", <><span>Username / full name</span><input value={form.name} onChange={(event) => update("name", event.target.value)} autoComplete="username" aria-invalid={Boolean(fieldErrors.name)} /></>)}
      {(isLogin || isForgot) && field("email", <><span>Email address</span><input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} /></>)}
      {!isLogin && !isForgot && !isReset && <>
        {field("email", <><span>Email address</span><input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} /></>)}
        {field("phone", <><span>Phone number</span><input inputMode="numeric" value={form.phone} onChange={(event) => update("phone", event.target.value.replace(/\D/g, "").slice(0, 10))} aria-invalid={Boolean(fieldErrors.phone)} /></>)}
        {field("gender", <><span>Gender <small className="optional-tag">optional</small></span><select value={form.gender} onChange={(event) => update("gender", event.target.value)} aria-invalid={Boolean(fieldErrors.gender)}><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></>)}
        <ChoiceChips field="catalog" legend="Which styling ideas would you like? (optional)" help="You can change this any time. It doesn't have to match your gender." options={CATALOG_CHOICES} value={form.catalog} onChange={(value) => update("catalog", value)} name="signup-catalog" />
        {field("dob", <><span>Date of birth</span><input type="date" max={today} value={form.dob} onChange={(event) => update("dob", event.target.value)} aria-invalid={Boolean(fieldErrors.dob)} /></>)}
        {field("age", <><span>Age</span><input type="number" min="0" value={form.age} readOnly aria-readonly="true" /></>)}
      </>}
      {!isForgot && field("password", <><span>{isReset ? "New password" : "Password"}</span><input type="password" value={form.password} onChange={(event) => update("password", event.target.value)} autoComplete={isLogin ? "current-password" : "new-password"} aria-invalid={Boolean(fieldErrors.password)} /></>)}
      {!isLogin && !isForgot && <>{field("confirm", <><span>Confirm password</span><input type="password" value={form.confirm} onChange={(event) => update("confirm", event.target.value)} autoComplete="new-password" aria-invalid={Boolean(fieldErrors.confirm)} /></>)}<div className="password-rules">{passwordRules.map(([key, label, test]) => <span className={test(form.password) ? "rule-met" : ""} key={key}>• {label}</span>)}</div></>}
      {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
      <button className="gold-button auth-submit" disabled={busy} type="submit">{busy ? "Please wait…" : isLogin ? "Log in" : isForgot ? "Send reset link" : isReset ? "Update password" : "Register"}<span aria-hidden="true">↗</span></button>
    </form>
    {verifyEmail && (
      <div className="auth-verify" aria-live="polite">
        <button className="link-button" type="button" onClick={resendVerification} disabled={resend.state === "busy"}>{resend.state === "busy" ? "Sending…" : "Resend verification email"}</button>
        {resend.text && <p className={resend.state === "error" ? "form-error" : "form-success"} role="status">{resend.text}</p>}
      </div>
    )}
    {isLogin && <Link className="auth-secondary-link" href="/forgot-password">Forgot your password?</Link>}
    <p className="auth-switch">{isLogin ? "New to MatchMyTone?" : "Already have an account?"} <Link href={isLogin ? "/signup" : "/login"}>{isLogin ? "Register" : "Log in"}</Link></p>
  </section>;
}
