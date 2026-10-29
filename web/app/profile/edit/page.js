"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BackButton from "../../components/BackButton";
import { calculateAgeFromDob, todayAsDateInputValue } from "../../components/dateValidation";
import Icon from "../../components/Icon";
import PageShell from "../../components/PageShell";
import StylePreferencesForm from "../../components/StylePreferencesForm";
import { Notice, SectionHeader } from "../../components/ui";

export default function EditProfilePage() {
  const [form, setForm] = useState({ phone: "", gender: "", dob: "", age: "" });
  const [initial, setInitial] = useState(null);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ state: "loading", message: "" });
  const today = useMemo(() => todayAsDateInputValue(), []);
  useEffect(() => {
    fetch("/api/users/profile", { cache: "no-store" })
      .then((response) => {
        if (response.status === 401) { window.location.assign("/login?next=/profile/edit"); return null; }
        return response.ok ? response.json() : Promise.reject(new Error());
      })
      .then((data) => {
        if (!data) return;
        const loaded = { phone: data.user.phone || "", gender: data.user.gender || "", dob: data.user.dob || "", age: data.user.age != null ? String(data.user.age) : "" };
        setForm(loaded); setInitial(loaded); setStatus({ state: "idle", message: "" });
      })
      .catch(() => setStatus({ state: "error", message: "We couldn't load your profile. Please refresh the page." }));
  }, []);
  const dirty = initial && JSON.stringify(form) !== JSON.stringify(initial);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change(key, value) {
    const next = { ...form, [key]: value };
    if (key === "dob") { const { age } = calculateAgeFromDob(value); next.age = age === null ? "" : String(age); }
    setForm(next); setErrors({ ...errors, [key]: "" }); setStatus({ state: "idle", message: "" });
  }

  async function save(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!/^\d{10}$/.test(form.phone)) nextErrors.phone = "Phone number must be exactly 10 digits.";
    const dob = calculateAgeFromDob(form.dob);
    if (dob.error) nextErrors.dob = dob.error;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setStatus({ state: "saving", message: "" });
    try {
      const response = await fetch("/api/users/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, age: Number(form.age) }) });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.assign("/login?next=/profile/edit"); return; }
      if (!response.ok) { setStatus({ state: "error", message: data.error || "We couldn't save your changes. Please try again." }); return; }
      setInitial(form); setStatus({ state: "saved", message: "Your profile has been updated." });
    } catch {
      setStatus({ state: "error", message: "We couldn't reach MatchMyTone. Please try again." });
    }
  }

  return (
    <PageShell width="narrow" className="module-profile">
      <div className="page-toolbar"><BackButton fallback="/profile" label="Back to profile" confirmLeave={() => (dirty ? "You have unsaved changes. Leave without saving?" : null)} /></div>
      <header className="page-intro reveal"><p className="eyebrow">Your profile</p><h1>Edit <em>details.</em></h1><p>Your name and email can&apos;t be changed here.</p></header>
      <form className="profile-card auth-form reveal" onSubmit={save} noValidate>
        <label>Phone number<input inputMode="numeric" autoComplete="tel" value={form.phone} onChange={(event) => change("phone", event.target.value.replace(/\D/g, "").slice(0, 10))} aria-invalid={Boolean(errors.phone)} disabled={status.state === "loading"} /><span className="field-error">{errors.phone}</span></label>
        <label>Gender<select value={form.gender} onChange={(event) => change("gender", event.target.value)} aria-invalid={Boolean(errors.gender)} disabled={status.state === "loading"}><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select><span className="field-hint">Used only as a starting point for styling ideas until you choose a styling catalog below.</span><span className="field-error">{errors.gender}</span></label>
        <label>Date of birth<input type="date" max={today} value={form.dob} onChange={(event) => change("dob", event.target.value)} aria-invalid={Boolean(errors.dob)} disabled={status.state === "loading"} /><span className="field-error">{errors.dob}</span></label>
        <label>Age<input readOnly aria-readonly="true" value={form.age} /></label>
        {status.state === "error" && <Notice>{status.message}</Notice>}
        {status.state === "saved" && <Notice tone="success" action={<Link className="btn btn-quiet btn-small" href="/profile">View profile</Link>}>{status.message}</Notice>}
        <div className="action-group">
          <button className="btn btn-primary" type="submit" disabled={status.state === "saving" || status.state === "loading" || !dirty}>{status.state === "saving" ? <span className="btn-spinner" aria-hidden="true" /> : <Icon name="check" />}{status.state === "saving" ? "Saving…" : "Save changes"}</button>
        </div>
      </form>
      <section id="style-preferences" className="profile-card preference-card reveal" aria-labelledby="style-preferences-title">
        <SectionHeader eyebrow="Optional" title="Style preferences" id="style-preferences-title" />
        <StylePreferencesForm />
      </section>
    </PageShell>
  );
}
