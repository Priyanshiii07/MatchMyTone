"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../components/Icon";
import Photo, { PhotoPlaceholder } from "../components/Photo";
import { useToast } from "../components/Toaster";
import { EmptyState, Notice, SkeletonCards } from "../components/ui";
import { catalogLabel } from "../../lib/preferences";

const HEX = /^#[0-9a-f]{6}$/i;
const RESULT_ROUTES = { body: "body-shape", face: "face-shape" };
const RATIOS = ["tall", "portrait", "square", "portrait"];
const FILTERS = [["all", "All"], ["outfits", "Outfits"], ["clothing", "Clothing"], ["hair", "Hair & grooming"], ["accessories", "Accessories"], ["skincare", "Skincare"], ["colours", "Colours"]];

/** Which board filter a saved item belongs to; based only on fields the API already returns. */
export function pinCategory(item) {
  if (item.kind === "shade") return "colours";
  if (item.kind === "look") return "outfits";
  if (item.kind === "product") return "skincare";
  if (item.module === "face") return item.category === "hair" ? "hair" : "accessories";
  return ["accessories", "footwear"].includes(item.category) ? "accessories" : "clothing";
}

function LookDialog({ look, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    // Older browsers (and jsdom) lack showModal; an open dialog still shows the details.
    if (typeof dialog?.showModal === "function") dialog.showModal();
    else dialog?.setAttribute("open", "");
  }, []);
  return (
    <dialog ref={ref} className="look-dialog" aria-labelledby="look-dialog-title" onClose={onClose} onCancel={onClose}>
      <p className="eyebrow">Saved look</p>
      <h2 id="look-dialog-title">{look.title}</h2>
      {look.look?.why && <p className="section-lead">{look.look.why}</p>}
      <ul>{look.look.pieces.map((piece) => <li key={piece.item_id}><Photo src={piece.photo} alt={piece.title} />{piece.title}</li>)}</ul>
      <button className="btn btn-primary btn-small" type="button" onClick={() => { ref.current?.close?.(); onClose(); }}>Close</button>
    </dialog>
  );
}

/** The user's saved looks, styles, products and shades as a Pinterest-style masonry board. */
export default function InspirationBoard() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [leaving, setLeaving] = useState(new Set());
  const [openLook, setOpenLook] = useState(null);
  const { notify } = useToast();

  useEffect(() => {
    Promise.all([fetch("/api/favorites", { cache: "no-store" }), fetch("/api/quiz/results", { cache: "no-store" })])
      .then(async ([favorites, results]) => {
        if (!favorites.ok) throw new Error();
        const saved = (await favorites.json()).favorites || [];
        const journal = results.ok ? await results.json() : {};
        const shades = (journal.results?.color_analysis || []).flatMap((doc) => (doc.user_state?.shades || []).filter((hex) => HEX.test(hex)).map((hex) => ({
          kind: "shade", item_id: `shade-${doc.id}-${hex}`, hex, resultId: doc.id, resultShades: doc.user_state.shades,
          title: (doc.colors_to_wear || []).find((color) => color.hex === hex)?.name || hex, season: doc.season_type,
        })));
        setItems([...saved, ...shades]);
      })
      .catch(() => setError("We couldn't load your board just now. Please refresh the page."));
  }, []);

  const counts = useMemo(() => (items || []).reduce((total, item) => ({ ...total, [pinCategory(item)]: (total[pinCategory(item)] || 0) + 1 }), {}), [items]);

  async function remove(item) {
    setLeaving((current) => new Set(current).add(item.item_id));
    const request = item.kind === "shade"
      ? fetch(`/api/quiz/color-analysis/${encodeURIComponent(item.resultId)}/progress`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shades: item.resultShades.filter((hex) => hex !== item.hex) }) })
      : fetch(`/api/favorites/${encodeURIComponent(item.item_id)}`, { method: "DELETE" });
    const response = await request.catch(() => null);
    if (response?.ok) {
      // Let the fade-out finish before the pin leaves the layout.
      window.setTimeout(() => setItems((current) => current.filter((entry) => entry.item_id !== item.item_id)), 250);
      notify("Removed from your board.");
    } else {
      setLeaving((current) => { const next = new Set(current); next.delete(item.item_id); return next; });
      notify("We couldn't remove that. Please try again.", "error");
    }
  }

  if (error) return <Notice>{error}</Notice>;
  if (!items) return <SkeletonCards count={4} />;
  if (!items.length) return <div className="board-empty empty-state"><EmptyState icon="heart" title="Your board is waiting for its first pin" action={{ href: "/dashboard", label: "Explore your analyses" }}>Tap the heart on clothing, hairstyle, eyewear and product ideas, save shades in your palette studio, or save looks from your AI stylist — they&apos;ll gather here as your personal moodboard.</EmptyState></div>;

  const visible = items.filter((item) => filter === "all" || pinCategory(item) === filter);
  const removeButton = (item) => <button className="link-button" type="button" onClick={() => remove(item)} disabled={leaving.has(item.item_id)} aria-label={`Remove ${item.title} from your board`}>Remove</button>;

  return (
    <div className="board">
      <div className="segmented board-filters" role="group" aria-label="Filter your board">
        {FILTERS.filter(([id]) => id === "all" || counts[id]).map(([id, label]) => (
          <button key={id} type="button" className={filter === id ? "is-active" : ""} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label} <span className="filter-count">{id === "all" ? items.length : counts[id]}</span></button>
        ))}
      </div>
      <ul className="masonry" aria-live="polite">{visible.map((item, index) => {
        const category = pinCategory(item);
        const label = FILTERS.find(([id]) => id === category)[1];
        return (
          <li key={item.item_id} className={`pin ${leaving.has(item.item_id) ? "is-leaving" : ""}`}>
            <span className="pin-badge">{label}</span>
            <span className="pin-heart" aria-hidden="true"><Icon name="heart" size={15} /></span>
            {item.kind === "shade" && <span className="pin-swatch" style={{ background: item.hex }} aria-hidden="true" />}
            {item.kind === "look" && (
              <div className={`pin-collage ${item.look.pieces.length === 1 ? "is-single" : ""}`}>{item.look.pieces.slice(0, 4).map((piece) => <Photo key={piece.item_id} src={piece.photo} alt={piece.title} />)}</div>
            )}
            {["style", "product"].includes(item.kind) && (
              <div className={`pin-media ratio-${RATIOS[index % RATIOS.length]}`}>
                {item.photo ? <Photo src={item.photo} alt={item.title} category={item.kind === "product" ? "skincare" : item.category} /> : <PhotoPlaceholder category={item.kind === "product" ? "skincare" : item.category} label={item.title} />}
              </div>
            )}
            <div className="pin-body">
              <h3>{item.title}</h3>
              {item.kind === "shade" && <p><span className="mono">{item.hex}</span>{item.season ? ` · ${item.season}` : ""}</p>}
              {item.kind === "style" && <p>{catalogLabel(item.catalog)}</p>}
              {item.kind === "product" && <p>{item.category}</p>}
              {item.kind === "look" && item.look.why && <p>{item.look.why}</p>}
              <div className="pin-actions">
                {item.kind === "shade" && <Link className="text-link" href={`/results/color/${item.resultId}`}>Open</Link>}
                {item.kind === "style" && (item.result_id && RESULT_ROUTES[item.module] ? <Link className="text-link" href={`/results/${RESULT_ROUTES[item.module]}/${item.result_id}`}>Open</Link> : <Link className="text-link" href={item.module === "face" ? "/analyses/face-shape" : "/analyses/body-shape"}>Open</Link>)}
                {item.kind === "product" && /^https:\/\//.test(item.href || "") && <a className="text-link" href={item.href} target="_blank" rel="noopener noreferrer">Open<span className="sr-only"> official site (opens in a new tab)</span></a>}
                {item.kind === "look" && <button className="link-button" type="button" onClick={() => setOpenLook(item)}>Open</button>}
                {removeButton(item)}
              </div>
            </div>
          </li>
        );
      })}</ul>
      {openLook && <LookDialog look={openLook} onClose={() => setOpenLook(null)} />}
    </div>
  );
}
