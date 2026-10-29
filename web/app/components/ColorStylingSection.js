"use client";

import { useState } from "react";
import Icon from "./Icon";
import { SectionHeader } from "./ui";
import { useResultState } from "./useStyling";

const HEX = /^#[0-9a-f]{6}$/i;
const safe = (hex) => (HEX.test(String(hex)) ? hex : "#D9D2C5");

function OutfitCard({ outfit, occasionLabel }) {
  const note = useResultState().insights?.notes?.[outfit.id];
  return (
    <article className="outfit-card">
      <div className="outfit-stack" aria-hidden="true">{outfit.pieces.map((piece) => <span key={piece.piece} style={{ background: safe(piece.hex) }} />)}</div>
      <div className="outfit-body">
        <p className="look-category">{occasionLabel}</p>
        <h4>{outfit.title}</h4>
        {note && <p className="ai-note"><Icon name="sparkle" size={14} />{note}</p>}
        <ul>{outfit.pieces.map((piece) => (
          <li key={piece.piece}><span className="mini-swatch" style={{ background: safe(piece.hex) }} aria-hidden="true" /><span><strong>{piece.piece}</strong> {piece.name} <span className="mono">{piece.hex}</span></span></li>
        ))}</ul>
      </div>
    </article>
  );
}

/** How to wear an existing palette in the chosen catalog. Switching catalogs never re-runs the AI analysis. */
export default function ColorStylingSection({ styling }) {
  const [occasion, setOccasion] = useState("all");
  if (!styling) return null;
  const occasions = [...new Set((styling.outfits || []).map((outfit) => outfit.occasion))];
  const outfits = (styling.outfits || []).filter((outfit) => occasion === "all" || outfit.occasion === occasion);
  return (
    <section className="palette-styling reveal" aria-labelledby="wear-title">
      <SectionHeader eyebrow="Wear your palette" title="Outfit color combinations" id="wear-title">Your shades applied to real outfits. Your season and colors stay exactly as analysed — only these combinations change with the catalog.</SectionHeader>
      {occasions.length > 1 && (
        <div className="segmented" role="group" aria-label="Filter outfits by occasion">
          {["all", ...occasions].map((value) => <button key={value} type="button" className={occasion === value ? "is-active" : ""} aria-pressed={occasion === value} onClick={() => setOccasion(value)}>{value === "all" ? "All occasions" : styling.occasion_labels?.[value] || value}</button>)}
        </div>
      )}
      <div className="outfit-grid">{outfits.map((outfit) => <OutfitCard key={outfit.id} outfit={outfit} occasionLabel={styling.occasion_labels?.[outfit.occasion] || outfit.occasion} />)}</div>
      {styling.accessories && (
        <div className="accessory-panel">
          <h3>Accessory metals & leathers</h3>
          <p>{styling.accessories.summary} Use them for: {styling.accessories.labels.join(", ").toLowerCase()}.</p>
          <ul className="accessory-swatches">{styling.accessories.items.map((item) => <li key={item.name}><span className="mini-swatch" style={{ background: safe(item.hex) }} aria-hidden="true" />{item.name}</li>)}</ul>
          <p className="hint">General undertone guidance, not part of your AI analysis.</p>
        </div>
      )}
      {styling.avoid && <p className="why-note"><strong>Colors to keep away from your face.</strong> {styling.avoid.guidance}</p>}
    </section>
  );
}
