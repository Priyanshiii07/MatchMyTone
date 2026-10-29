"use client";

import { useEffect, useState } from "react";
import { compactPreferences } from "../../lib/preferences";
import ChoiceChips from "./ChoiceChips";
import Icon from "./Icon";
import { Notice } from "./ui";

const GROUPS = [
  { title: "Clothing", fields: ["catalog", "style_extras", "occasions"] },
  { title: "Hair", fields: ["hair_length", "hair_texture"] },
  { title: "Beauty", fields: ["makeup"] },
];

/** Optional style preferences, saved separately from personal details so nothing here is ever required. */
export default function StylePreferencesForm({ onSaved }) {
  const [values, setValues] = useState(null);
  const [initial, setInitial] = useState(null);
  const [status, setStatus] = useState({ state: "loading", message: "" });

  useEffect(() => {
    fetch("/api/users/preferences", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error())))
      .then((data) => { setValues(data.preferences || {}); setInitial(data.preferences || {}); setStatus({ state: "idle", message: "" }); })
      .catch(() => setStatus({ state: "error", message: "We couldn't load your style preferences. Please refresh the page." }));
  }, []);

  const dirty = values && JSON.stringify(compactPreferences(values)) !== JSON.stringify(compactPreferences(initial));

  function change(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setStatus({ state: "idle", message: "" });
  }

  async function save(event) {
    event.preventDefault();
    setStatus({ state: "saving", message: "" });
    // Every known field is sent so cleared choices are removed on the server (null clears).
    const body = Object.fromEntries(GROUPS.flatMap((group) => group.fields).map((field) => [field, compactPreferences({ [field]: values[field] })[field] ?? null]));
    try {
      const response = await fetch("/api/users/preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setStatus({ state: "error", message: data.error || "We couldn't save your preferences. Please try again." }); return; }
      setValues(data.preferences); setInitial(data.preferences);
      setStatus({ state: "saved", message: "Saved. New analyses will use these preferences; your saved results keep the styling they were created with." });
      onSaved?.(data.preferences);
    } catch {
      setStatus({ state: "error", message: "We couldn't reach MatchMyTone. Please try again." });
    }
  }

  if (!values) return status.state === "error" ? <Notice>{status.message}</Notice> : <p className="hint" role="status">Loading your style preferences…</p>;
  return (
    <form className="preference-form" onSubmit={save} aria-describedby="preferences-intro">
      <p id="preferences-intro" className="section-lead">All optional. They decide which clothing and hair ideas you see — they never change your color, face or body analysis, and we never guess them from a photo.</p>
      {GROUPS.map((group) => (
        <section className="preference-group" key={group.title} aria-label={group.title}>
          <h4>{group.title}</h4>
          {group.fields.map((field) => <ChoiceChips key={field} field={field} value={values[field]} onChange={(value) => change(field, value)} disabled={status.state === "saving"} />)}
        </section>
      ))}
      {status.state === "error" && <Notice>{status.message}</Notice>}
      {status.state === "saved" && <Notice tone="success">{status.message}</Notice>}
      <div className="action-group">
        <button className="btn btn-primary" type="submit" disabled={!dirty || status.state === "saving"}>
          {status.state === "saving" ? <span className="btn-spinner" aria-hidden="true" /> : <Icon name="check" />}
          {status.state === "saving" ? "Saving…" : "Save style preferences"}
        </button>
      </div>
    </form>
  );
}
