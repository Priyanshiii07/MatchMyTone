"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { harmonies } from "../../lib/color";
import guides from "../../lib/style-guides.json";
import ColorStylingSection from "./ColorStylingSection";
import Icon from "./Icon";
import { SectionHeader } from "./ui";
import { useResultState } from "./useStyling";

const HEX = /^#[0-9a-f]{6}$/i;
const safeHex = (value) => (HEX.test(String(value || "")) ? String(value).toUpperCase() : "#D9D2C5");

export function normalizeColors(list, group) {
  return (Array.isArray(list) ? list : []).filter((item) => item && typeof item === "object").map((item, index) => ({ id: `${group}-${index}`, name: String(item.name || "Unnamed shade"), hex: safeHex(item.hex), valid: HEX.test(String(item.hex || "")), group }));
}

// Draws a shareable palette card from the saved result data and downloads it as PNG.
function downloadPaletteCard(season, wear, avoid) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080; canvas.height = 1350;
  const context = canvas.getContext("2d");
  context.fillStyle = "#FFF8EC"; context.fillRect(0, 0, 1080, 1350);
  context.fillStyle = "#B89018"; context.fillRect(0, 0, 1080, 18);
  context.fillStyle = "#B89018"; context.font = "bold 34px Georgia, serif"; context.fillText("MatchMyTone", 80, 120);
  context.fillStyle = "#2C2C2C"; context.font = "72px Georgia, serif"; context.fillText(season.slice(0, 26), 80, 220);
  context.fillStyle = "#6B6B6B"; context.font = "28px Arial, sans-serif"; context.fillText("My personal color palette", 80, 270);
  const drawRow = (colors, top, label) => {
    context.fillStyle = "#A46B39"; context.font = "bold 24px Arial, sans-serif"; context.fillText(label.toUpperCase(), 80, top - 24);
    colors.forEach((color, index) => {
      const x = 80 + (index % 3) * 310; const y = top + Math.floor(index / 3) * 250;
      context.fillStyle = color.hex; context.beginPath(); context.roundRect(x, y, 290, 160, 24); context.fill();
      context.fillStyle = "#2C2C2C"; context.font = "bold 24px Arial, sans-serif"; context.fillText(color.name.slice(0, 22), x, y + 198);
      context.fillStyle = "#6B6B6B"; context.font = "22px monospace"; context.fillText(color.hex, x, y + 228);
    });
  };
  drawRow(wear, 360, "Colors to wear");
  drawRow(avoid, 1000, "Colors to avoid");
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = "MatchMyTone-Palette-Card.png"; document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }, "image/png");
}

export default function ColorResultView({ result, capturedImage, styling }) {
  const wear = useMemo(() => normalizeColors(result.colorsToWear, "wear"), [result.colorsToWear]);
  const avoid = useMemo(() => normalizeColors(result.colorsToAvoid, "avoid"), [result.colorsToAvoid]);
  const [filter, setFilter] = useState("wear");
  const [selectedId, setSelectedId] = useState(wear[0]?.id || avoid[0]?.id || null);
  const [compare, setCompare] = useState([]);
  const [copied, setCopied] = useState("");
  const all = [...wear, ...avoid];
  const visible = filter === "wear" ? wear : filter === "avoid" ? avoid : all;
  const selected = all.find((color) => color.id === selectedId);
  const compared = compare.map((id) => all.find((color) => color.id === id)).filter(Boolean);
  const { shades, toggleShade, enabled } = useResultState();
  const favorites = wear.filter((color) => shades.includes(color.hex));
  const harmony = selected?.valid ? harmonies(selected.hex) : null;

  async function copyHex(color) {
    try { await navigator.clipboard.writeText(color.hex); setCopied(color.id); window.setTimeout(() => setCopied(""), 2000); } catch { setCopied(""); }
  }
  function toggleCompare(color) {
    setCompare((current) => (current.includes(color.id) ? current.filter((id) => id !== color.id) : [...current, color.id].slice(-3)));
  }

  return (
    <div className="result-view">
      <section className="result-hero reveal">
        <div className="result-hero-copy">
          <p className="eyebrow">Your seasonal palette</p>
          <h1>{result.seasonType || "Your color profile"}</h1>
          {result.seasonDescription && <p className="result-lead">{result.seasonDescription}</p>}
          <div className="hero-palette" aria-hidden="true">{wear.map((color, index) => <span key={color.id} style={{ background: color.hex, animationDelay: `${index * 70}ms` }} />)}</div>
        </div>
        {capturedImage ? <img className="hero-selfie" src={capturedImage} alt="The selfie used for this analysis" /> : <div className="hero-badge" aria-hidden="true"><Icon name="palette" size={56} /></div>}
      </section>

      <div className="fact-grid reveal">
        <article className="fact-card"><p className="fact-label">Undertone</p><h3>{result.undertone || "Not recorded"}</h3>{result.undertoneDescription && <p>{result.undertoneDescription}</p>}</article>
        {result.skinAge != null && <article className="fact-card"><p className="fact-label">Approximate visual skin age</p><h3>{result.skinAge}</h3>{result.skinAgeDescription && <p>{result.skinAgeDescription}</p>}</article>}
      </div>

      <section className="palette-studio reveal" aria-labelledby="studio-title">
        <SectionHeader eyebrow="Palette studio" title="Explore your shades" id="studio-title">Select a shade to see its details, copy its hex code, or add up to three shades to compare side by side.</SectionHeader>
        <div className="segmented" role="group" aria-label="Show colors">
          {[["wear", `To wear (${wear.length})`], ["avoid", `To avoid (${avoid.length})`], ["all", `All (${all.length})`]].map(([value, label]) => <button key={value} type="button" className={filter === value ? "is-active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        {favorites.length > 0 && (
          <div className="favorite-shades" aria-label="Your saved shades">
            <span className="fact-label">Saved shades</span>
            {favorites.map((color) => <button key={color.id} type="button" className="favorite-shade" onClick={() => { setFilter("wear"); setSelectedId(color.id); }}><span className="mini-swatch" style={{ background: color.hex }} aria-hidden="true" />{color.name}</button>)}
          </div>
        )}
        <div className="studio-layout">
          <ul className="swatch-grid" aria-label="Color swatches">
            {visible.map((color, index) => (
              <li key={color.id} style={{ animationDelay: `${index * 60}ms` }}>
                <button type="button" className={`swatch ${selectedId === color.id ? "is-selected" : ""}`} aria-pressed={selectedId === color.id} aria-label={`${color.name}, ${color.hex}, ${color.group === "wear" ? "recommended" : "best avoided near the face"}`} onClick={() => setSelectedId(color.id)}>
                  <span className="swatch-chip" style={{ background: color.hex }} />
                  <span className="swatch-name">{color.name}</span>
                  <span className="swatch-meta">{color.hex}<em className={`tag tag-${color.group}`}>{color.group === "wear" ? "Wear" : "Avoid"}</em></span>
                </button>
              </li>
            ))}
          </ul>
          {selected && (
            <aside className="swatch-detail" aria-live="polite">
              <span className="detail-chip" style={{ background: selected.hex }} />
              <p className="fact-label">{selected.group === "wear" ? "Recommended shade" : "Best kept away from your face"}</p>
              <h3>{selected.name}</h3>
              <p className="mono">{selected.hex}</p>
              <p>{selected.group === "wear" ? "Wear it close to your face — tops, scarves and accessories — to see the most effect." : "If you love it, wear it away from your face, for example in trousers, shoes or bags."}</p>
              <div className="detail-actions">
                <button className="btn btn-quiet btn-small" type="button" onClick={() => copyHex(selected)}><Icon name={copied === selected.id ? "check" : "copy"} size={16} />{copied === selected.id ? "Copied" : "Copy hex"}</button>
                <button className="btn btn-quiet btn-small" type="button" aria-pressed={compare.includes(selected.id)} onClick={() => toggleCompare(selected)}>{compare.includes(selected.id) ? "Remove from compare" : "Add to compare"}</button>
                {enabled && selected.group === "wear" && <button className="btn btn-quiet btn-small" type="button" aria-pressed={shades.includes(selected.hex)} onClick={() => toggleShade(selected.hex)}><Icon name="heart" size={16} />{shades.includes(selected.hex) ? "Saved shade" : "Save shade"}</button>}
              </div>
              {harmony && (
                <div className="harmony" aria-label={`Color harmonies for ${selected.name}`}>
                  <p className="fact-label">Pair it with</p>
                  {[["Complementary", harmony.complementary], ["Analogous", harmony.analogous]].map(([label, hexes]) => (
                    <p key={label} className="harmony-row"><span>{label}</span>{hexes.map((hex) => <span key={hex} className="harmony-chip"><span className="mini-swatch" style={{ background: hex }} aria-hidden="true" /><span className="mono">{hex}</span></span>)}</p>
                  ))}
                  <p className="hint">Calculated on the color wheel from this shade — not part of your AI palette.</p>
                </div>
              )}
            </aside>
          )}
        </div>
        {compared.length > 0 && (
          <div className="compare-tray" aria-label="Compared shades">
            {compared.map((color) => <div className="compare-item" key={color.id} style={{ background: color.hex }}><span>{color.name}<small>{color.hex} · {color.group === "wear" ? "Wear" : "Avoid"}</small></span></div>)}
            <button className="link-button" type="button" onClick={() => setCompare([])}>Clear comparison</button>
          </div>
        )}
        <div className="studio-footer">
          <button className="btn btn-secondary btn-small" type="button" onClick={() => downloadPaletteCard(result.seasonType || "My palette", wear, avoid)} disabled={!wear.length}><Icon name="image" size={16} />Save palette card (PNG)</button>
          <p className="hint"><Icon name="sun" size={16} />Lighting and makeup can shift undertone. If this doesn&apos;t feel right, <Link href="/analyses/color">retake your selfie in soft daylight</Link>.</p>
        </div>
      </section>

      <ColorStylingSection styling={styling} />

      <section className="tips-panel reveal">
        <SectionHeader eyebrow="Styling notes" title="How to wear your palette" />
        <ul className="tip-list">
          <li>Wear your recommended shades closest to your face — tops, scarves, collars and earrings.</li>
          <li>Keep colors to avoid away from the face, for example in trousers, shoes or bags.</li>
          <li>Compare shades in daylight; indoor lighting can shift how colors look.</li>
        </ul>
        <p className="disclaimer">{guides.disclaimers.color}</p>
      </section>
    </div>
  );
}
