"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import Photo from "../components/Photo";
import { useToast } from "../components/Toaster";
import { AI_LOADING, aiErrorMessage } from "../../lib/aiMessages";
import { CATALOG_CHOICES, PREFERENCE_FIELDS } from "../../lib/preferences";

const HEX = /^#[0-9a-f]{6}$/i;
const CATEGORIES = [["", "Any focus"], ["tops", "Tops"], ["bottoms", "Bottoms"], ["dresses", "Dresses & one-pieces"], ["outerwear", "Outerwear & tailoring"], ["traditional", "Traditional & festive"]];

/** Generates outfits for an occasion from the user's whole saved palette and body result, and saves them to the board. */
export default function LookGenerator() {
  const [palette, setPalette] = useState([]);
  const [form, setForm] = useState({ occasion: "office", catalog: "", category: "", comfort: "", budget: "" });
  const [state, setState] = useState({ status: "idle" });
  const [saved, setSaved] = useState({});
  const { notify } = useToast();

  useEffect(() => {
    fetch("/api/quiz/results", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const latest = (data?.results?.color_analysis || []).find((doc) => doc.is_face !== false && Array.isArray(doc.colors_to_wear));
        setPalette((latest?.colors_to_wear || []).filter((color) => HEX.test(String(color?.hex))));
      })
      .catch(() => setPalette([]));
  }, []);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function generate(event) {
    event?.preventDefault();
    if (state.status === "busy") return;
    setState({ status: "busy" });
    const body = Object.fromEntries(Object.entries(form).filter(([, value]) => (Array.isArray(value) ? value.length : value)));
    let response = null;
    let data = {};
    try {
      response = await fetch("/api/stylist/looks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      data = await response.json().catch(() => ({}));
    } catch { /* network failure: reported below */ }
    if (response?.ok && Array.isArray(data.looks)) {
      setState({ ...data, status: "ready" });
      setSaved({});
      return;
    }
    const failure = response?.status === 400 && data.error ? { text: data.error, retry: false } : aiErrorMessage(data, response?.status || 0);
    setState({ status: "error", message: failure.text, retry: failure.retry });
  }

  async function save(look, index) {
    const response = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ look: { title: look.title, occasion: look.occasion, why: look.why, pieces: look.pieces.map(({ item_id: itemId, hex }) => ({ item_id: itemId, ...(hex ? { hex } : {}) })) } }) }).catch(() => null);
    if (response?.ok) { setSaved((current) => ({ ...current, [index]: true })); notify("Look saved to your inspiration board."); } else notify("We couldn't save that look. Please try again.", "error");
  }

  return (
    <section className="looks-panel" aria-labelledby="looks-title">
      <div className="chat-head"><div><p className="eyebrow"><Icon name="hanger" size={14} />Occasion look generator</p><h2 id="looks-title">Dress me for…</h2></div></div>
      <form className="looks-form" onSubmit={generate}>
        <label className="sort-control">Occasion
          <select value={form.occasion} onChange={(event) => set("occasion", event.target.value)}>{PREFERENCE_FIELDS.occasions.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        </label>
        <label className="sort-control">Styling
          <select value={form.catalog} onChange={(event) => set("catalog", event.target.value)}><option value="">My saved preference</option>{CATALOG_CHOICES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        </label>
        <label className="sort-control">Focus
          <select value={form.category} onChange={(event) => set("category", event.target.value)}>{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </label>
        <label className="sort-control">Comfort &amp; fit
          <select value={form.comfort} onChange={(event) => set("comfort", event.target.value)}><option value="">Any</option>{PREFERENCE_FIELDS.fit.options.filter((option) => option.value !== "no_preference").map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        </label>
        <label className="sort-control">Budget
          <select value={form.budget} onChange={(event) => set("budget", event.target.value)}><option value="">Not set</option><option value="low">Budget-friendly</option><option value="mid">Mid-range</option><option value="high">Premium</option></select>
        </label>
        {palette.length === 0 && <p className="hint">Looks use your palette once you&apos;ve <Link href="/analyses/color">run a Color Analysis</Link>.</p>}
        <button className="btn btn-primary" type="submit" disabled={state.status === "busy"} aria-busy={state.status === "busy"}>{state.status === "busy" ? <><span className="btn-spinner" aria-hidden="true" />Creating your looks…</> : <><Icon name="sparkle" />{state.status === "ready" ? "Regenerate looks" : "Generate looks"}</>}</button>
      </form>
      {state.status === "busy" && (
        <div role="status" className="loading-edit">
          <p><Icon name="sparkle" size={16} />{AI_LOADING}</p>
          <div className="skeleton-grid" aria-hidden="true">{[0, 1, 2].map((index) => <div className="skeleton-card" key={index}><span /><span /><span /></div>)}</div>
        </div>
      )}
      {state.status === "error" && <p className="calm-notice" role="alert"><Icon name="sparkle" size={16} />{state.message}{state.retry && <> <button className="link-button" type="button" onClick={generate}>Try again</button></>}</p>}
      {state.status === "ready" && (
        <>
          <p className={`source-badge is-${state.source}`}><Icon name={state.source === "ai" ? "sparkle" : "check"} size={14} />{state.source === "ai" ? "AI stylist" : "Styling rules"} · {state.notice}</p>
          {state.budget_note && <p className="hint">{state.budget_note}</p>}
          <div className="look-results">{state.looks.map((look, index) => (
            <article key={`${look.title}-${index}`} className="look-result">
              <div className="look-pieces">{look.pieces.map((piece) => (
                <figure key={piece.item_id}>
                  <Photo src={piece.photo} alt={piece.title} category={piece.category} />
                  <figcaption>{piece.title}{piece.hex && <span className="mini-swatch" style={{ background: piece.hex }} title={piece.hex} />}</figcaption>
                </figure>
              ))}</div>
              <h3>{look.title}</h3>
              <p>{look.why}</p>
              <button className="btn btn-quiet btn-small" type="button" onClick={() => save(look, index)} disabled={saved[index]}><Icon name="heart" size={16} />{saved[index] ? "Saved to board" : "Save to board"}</button>
            </article>
          ))}</div>
        </>
      )}
    </section>
  );
}
