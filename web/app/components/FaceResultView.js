"use client";

import { useState } from "react";
import { ShapeChecklist, ShapeGuide, ShapeHero } from "./ShapeResultView";
import StyleCard from "./StyleCard";
import { FilterEmptyState, SectionHeader } from "./ui";

function CardSection({ id, eyebrow, title, lead, cards, compact }) {
  if (!cards?.length) return null;
  return (
    <section className="reveal" aria-labelledby={id}>
      <SectionHeader eyebrow={eyebrow} title={title} id={id}>{lead}</SectionHeader>
      <div className={`style-grid ${compact ? "is-compact" : ""}`}>{cards.map((card) => <StyleCard key={card.id} card={card} compact={compact} />)}</div>
    </section>
  );
}

const LENGTHS = [["all", "Any length"], ["short", "Short"], ["medium", "Medium"], ["long", "Long"]];
const UPKEEP = [["all", "Any upkeep"], ["low", "Low"], ["medium", "Medium"], ["high", "High"]];
const TEXTURES = [["all", "Any texture"], ["wavy", "Wavy"], ["curly", "Curly"], ["coily", "Coily"]];

/** Hairstyle studio: length and upkeep filters over every hairstyle suggested for this result. */
function HairStudio({ styling, lead }) {
  const [length, setLength] = useState("all");
  const [upkeep, setUpkeep] = useState("all");
  const [texture, setTexture] = useState("all");
  const all = [...(styling.hair || []), ...(styling.hair_alternatives || [])];
  // Texture-specific cuts only appear once the user has told us their texture, so this filter shows only when they exist.
  const textures = TEXTURES.filter(([id]) => id === "all" || all.some((card) => card.textures?.includes(id)));
  const matches = (card, nextLength = length, nextUpkeep = upkeep, nextTexture = texture) => (nextLength === "all" || card.lengths?.includes(nextLength)) && (nextUpkeep === "all" || card.maintenance === nextUpkeep) && (nextTexture === "all" || card.textures?.includes(nextTexture));
  const filtering = length !== "all" || upkeep !== "all" || texture !== "all";
  const visible = all.filter((card) => matches(card));
  const labelOf = (options, value) => options.find(([id]) => id === value)?.[1];
  const segmented = (label, options, value, setValue, count) => (
    <div className="segmented" role="group" aria-label={label}>
      {options.map(([id, text]) => <button key={id} type="button" className={value === id ? "is-active" : ""} aria-pressed={value === id} onClick={() => setValue(id)} disabled={!count(id) && value !== id}>{text} <span className="filter-count">{count(id)}</span></button>)}
    </div>
  );
  return (
    <>
      <section className="reveal" aria-labelledby="hair-title">
        <SectionHeader eyebrow="Hairstyle studio" title={filtering ? "Matching hairstyles" : "Recommended for you"} id="hair-title">{lead}</SectionHeader>
        <div className="filter-bar">
          {segmented("Filter by hair length", LENGTHS, length, setLength, (id) => all.filter((card) => matches(card, id, upkeep)).length)}
          {segmented("Filter by upkeep", UPKEEP, upkeep, setUpkeep, (id) => all.filter((card) => matches(card, length, id)).length)}
          {textures.length > 1 && segmented("Filter by hair texture", textures, texture, setTexture, (id) => all.filter((card) => matches(card, length, upkeep, id)).length)}
        </div>
        {filtering && !visible.length && <FilterEmptyState filters={[length !== "all" && `${labelOf(LENGTHS, length)} length`, upkeep !== "all" && `${labelOf(UPKEEP, upkeep)} upkeep`, texture !== "all" && `${labelOf(TEXTURES, texture)} texture`].filter(Boolean)} total={all.length} onReset={() => { setLength("all"); setUpkeep("all"); setTexture("all"); }} />}
        <div className="style-grid">{(filtering ? visible : styling.hair || []).map((card) => <StyleCard key={card.id} card={card} />)}</div>
      </section>
      {!filtering && <CardSection id="hair-alt-title" eyebrow="Also worth a look" title="Alternative hairstyles" lead="Other lengths and looks if you fancy a change." cards={styling.hair_alternatives} compact />}
    </>
  );
}


/** Face-shape result: hairstyles, eyewear, accessories and grooming for the chosen catalog (saved beard ideas are no longer shown). */
export default function FaceResultView({ doc }) {
  const styling = doc.styling || {};
  const hairLead = styling.texture_known ? "Picked for your face shape and hair texture." : "Picked for your face shape. Tell us your hair texture in your preferences to unlock curl- and coil-specific cuts.";
  const checklist = [...(styling.hair || []), ...(styling.eyewear || [])].slice(0, 7).map((card) => ({ id: card.id, label: card.title, detail: card.tip || card.why }));
  return (
    <div className="result-view">
      <ShapeHero kind="face" doc={doc} />
      <HairStudio styling={styling} lead={hairLead} />
      <CardSection id="eyewear-title" eyebrow="Eyewear" title="Frames to try" lead="Styling suggestions, not strict rules — fit and comfort matter most." cards={styling.eyewear} compact />
      <CardSection id="accessories-title" eyebrow="Accessories" title="Finishing touches" cards={styling.accessories} compact />
      {styling.grooming?.length > 0 && (
        <section className="tips-panel reveal" aria-labelledby="grooming-title">
          <SectionHeader eyebrow="Grooming & maintenance" title="Keeping it easy" id="grooming-title" />
          <dl className="fit-guide">{styling.grooming.map((entry) => <div key={entry.topic}><dt>{entry.topic}</dt><dd>{entry.tip}</dd></div>)}</dl>
        </section>
      )}
      {checklist.length > 0 && <ShapeChecklist kind="face" items={checklist} title="Your personal style guide" />}
      <ShapeGuide kind="face" shape={doc.result} catalog={styling.catalog} />
    </div>
  );
}
