"use client";

import guides from "../../lib/style-guides.json";
import Checklist from "./Checklist";
import ShapeDiagram from "./ShapeDiagram";
import { SectionHeader } from "./ui";

const CONFIDENCE_TEXT = {
  clear: "Your answers pointed clearly to this shape.",
  leaning: "Your answers leaned towards this shape.",
  mixed: "Your answers were split between shapes, so treat this as a starting point.",
};

/** The figure for a shape: the original illustrations for the women's catalog, a neutral outline otherwise. */
export function ShapeVisual({ kind, shape, catalog, className = "hero-illustration", decorative = false }) {
  const image = guides[kind]?.[shape]?.image;
  if (catalog === "womenswear" && image) return <img className={className} src={`/assets/${image}`} alt={decorative ? "" : `${shape} ${kind} shape illustration`} />;
  return <ShapeDiagram kind={kind} shape={shape} className={className} decorative={decorative} />;
}

export function ShapeHero({ kind, doc, label }) {
  const guide = guides[kind]?.[doc.result] || {};
  const confidence = doc.confidence;
  return (
    <section className="result-hero reveal">
      <div className="result-hero-copy">
        <p className="eyebrow">{kind === "face" ? "Your face shape" : "Your body shape"}</p>
        <h1>{label || doc.result}</h1>
        {guide.description && <p className="result-lead">{guide.description}</p>}
        {confidence && (
          <p className={`confidence-note is-${confidence.level}`}>
            <strong>{CONFIDENCE_TEXT[confidence.level]}</strong>
            {confidence.alternatives?.length > 0 && <> Also close: {confidence.alternatives.join(" and ")}.</>}
          </p>
        )}
        {guide.why && <p className="why-note"><strong>Why these ideas?</strong> {guide.why}</p>}
      </div>
      <ShapeVisual kind={kind} shape={doc.result} catalog={doc.styling?.catalog} />
    </section>
  );
}

export function ShapeChecklist({ kind, items, title }) {
  return (
    <section className="reveal" aria-labelledby={`${kind}-checklist-title`}>
      <SectionHeader eyebrow="Make it yours" title={title} id={`${kind}-checklist-title`} />
      <Checklist items={items} title="Ideas to try" />
    </section>
  );
}

export function ShapeGuide({ kind, shape, catalog }) {
  return (
    <section className="shape-guide reveal" aria-labelledby={`${kind}-guide-title`}>
      <SectionHeader eyebrow="All shapes" title={kind === "face" ? "Face-shape guide" : "Body-shape guide"} id={`${kind}-guide-title`} />
      <ul className="shape-guide-grid">{Object.entries(guides[kind]).map(([name, entry]) => (
        <li key={name} className={name === shape ? "is-current" : ""} aria-current={name === shape ? "true" : undefined}>
          <ShapeVisual kind={kind} shape={name} catalog={catalog} className="shape-guide-visual" decorative />
          <strong>{name}{name === shape && <span className="tag tag-wear">Your result</span>}</strong>
          <small>{entry.description}</small>
        </li>
      ))}</ul>
      <p className="disclaimer">{guides.disclaimers[kind]}</p>
    </section>
  );
}
