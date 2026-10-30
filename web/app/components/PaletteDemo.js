"use client";

import { useState } from "react";
import StyleArt from "./StyleArt";

// Sample palettes for the home-page demo only; real palettes come from a person's own Color Analysis.
export const DEMO_PALETTES = [
  { id: "warm", name: "Warm autumn", colors: [["Terracotta", "#C2593F"], ["Olive", "#6B705C"], ["Mustard", "#E3A857"], ["Deep teal", "#005F60"]] },
  { id: "cool", name: "Cool summer", colors: [["Dusty rose", "#C98B9B"], ["Slate blue", "#5B6C8F"], ["Soft plum", "#7D5A7A"], ["Grey sage", "#9AA59A"]] },
  { id: "clear", name: "Clear winter", colors: [["Ruby", "#B0153A"], ["Sapphire", "#1F4E99"], ["Emerald", "#0F7B5F"], ["Charcoal", "#33363B"]] },
];
const PIECES = [["shirt", "Shirt"], ["blouse", "Wrap top"], ["hoodie", "Hoodie"], ["kurta-w", "Kurta"]];

/** Recolours illustrated garment stickers with a sample palette (labelled as a sample, not an analysis). */
export default function PaletteDemo() {
  const [paletteId, setPaletteId] = useState(DEMO_PALETTES[0].id);
  const palette = DEMO_PALETTES.find((entry) => entry.id === paletteId);
  return (
    <div className="palette-demo">
      <div className="segmented" role="group" aria-label="Sample palette">
        {DEMO_PALETTES.map((entry) => <button key={entry.id} type="button" className={entry.id === paletteId ? "is-active" : ""} aria-pressed={entry.id === paletteId} onClick={() => setPaletteId(entry.id)}>{entry.name}</button>)}
      </div>
      <ul className="demo-swatches" aria-label={`${palette.name} sample colors`}>
        {palette.colors.map(([name, hex]) => <li key={hex}><span style={{ background: hex }} aria-hidden="true" />{name}</li>)}
      </ul>
      <ul className="demo-pieces" aria-live="polite">
        {PIECES.map(([art, label], index) => {
          const [colorName, hex] = palette.colors[index % palette.colors.length];
          return (
            <li key={art} style={{ "--tint": hex }}>
              <span className="sticker demo-sticker"><StyleArt art={art} color={hex} title={`${label} in ${colorName}`} /></span>
              <span>{label}<small>{colorName}</small></span>
            </li>
          );
        })}
      </ul>
      <p className="hint">Sample palettes shown on illustrated pieces. Your own palette comes from a live-selfie Color Analysis.</p>
    </div>
  );
}
