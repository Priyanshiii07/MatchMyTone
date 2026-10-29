"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ShapeChecklist, ShapeGuide, ShapeHero } from "./ShapeResultView";
import StyleCard from "./StyleCard";
import { FilterEmptyState, SectionHeader } from "./ui";

/** Body-shape result with a personalised, filterable clothing guide from the saved styling snapshot. */
export default function BodyResultView({ doc }) {
  const styling = doc.styling;
  const ALL = { category: "all", occasion: "all", fit: "all", shade: "all" };
  const [filters, setFilters] = useState(ALL);
  const { category, occasion } = filters;
  const categories = useMemo(() => styling?.categories || [], [styling]);
  const labels = useMemo(() => Object.fromEntries(categories.map((entry) => [entry.id, entry.label])), [categories]);
  const items = useMemo(() => styling?.items || [], [styling]);
  const occasions = useMemo(() => [...new Set(items.flatMap((card) => card.occasions || []))], [items]);
  const fits = useMemo(() => [...new Set(items.flatMap((card) => card.fits || []))], [items]);
  const shades = useMemo(() => [...new Map(items.flatMap((card) => card.colors || []).map((color) => [color.hex, color])).values()], [items]);
  const TESTS = {
    category: (card, value) => card.category === value,
    occasion: (card, value) => card.occasions?.includes(value),
    // Shoes and accessories have no fit, so a fit filter leaves them visible.
    fit: (card, value) => !card.fits?.length || card.fits.includes(value),
    shade: (card, value) => card.colors?.some((color) => color.hex === value),
  };
  const matches = (card, next = filters) => Object.entries(next).every(([key, value]) => value === "all" || TESTS[key](card, value));
  const visible = items.filter((card) => matches(card));
  // Counts reflect the other active filters, so an option that would show nothing is disabled up front.
  const count = (key, value) => items.filter((card) => matches(card, { ...filters, [key]: value })).length;
  const set = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const reset = () => setFilters(ALL);
  const shadeName = shades.find((color) => color.hex === filters.shade)?.name;
  const activeLabels = [category !== "all" && labels[category], occasion !== "all" && (styling?.occasion_labels?.[occasion] || occasion), filters.fit !== "all" && `${filters.fit} fit`, filters.shade !== "all" && shadeName].filter(Boolean);
  const checklist = (styling?.items || []).filter((card) => card.category !== "accessories").slice(0, 6).map((card) => ({ id: card.id, label: `Try: ${card.title}`, detail: `${labels[card.category] || ""} · ${card.tip || card.why}` }));

  return (
    <div className="result-view">
      <ShapeHero kind="body" doc={doc} label={styling?.shape_label} />

      <section className="reveal" aria-labelledby="wardrobe-title">
        <SectionHeader eyebrow={styling?.catalog_label || "Curated for you"} title="Your personal styling guide" id="wardrobe-title">Ideas chosen for your proportions and preferences. They&apos;re options, not rules — keep what feels like you.</SectionHeader>
        <div className="filter-bar">
          <div className="segmented" role="group" aria-label="Filter by category">
            {[{ id: "all", label: "All" }, ...categories].map((entry) => {
              const total = count("category", entry.id);
              return <button key={entry.id} type="button" className={category === entry.id ? "is-active" : ""} aria-pressed={category === entry.id} onClick={() => set("category", entry.id)} disabled={!total && category !== entry.id}>{entry.label} <span className="filter-count">{total}</span></button>;
            })}
          </div>
          <div className="filter-selects">
            {occasions.length > 1 && (
              <label className="sort-control">Occasion
                <select value={occasion} onChange={(event) => set("occasion", event.target.value)}>
                  <option value="all">Any occasion</option>
                  {occasions.map((value) => <option key={value} value={value} disabled={!count("occasion", value) && occasion !== value}>{styling.occasion_labels?.[value] || value} ({count("occasion", value)})</option>)}
                </select>
              </label>
            )}
            {fits.length > 1 && (
              <label className="sort-control">Comfort &amp; fit
                <select value={filters.fit} onChange={(event) => set("fit", event.target.value)}>
                  <option value="all">Any fit</option>
                  {fits.map((value) => <option key={value} value={value} disabled={!count("fit", value) && filters.fit !== value}>{value[0].toUpperCase() + value.slice(1)} ({count("fit", value)})</option>)}
                </select>
              </label>
            )}
          </div>
        </div>
        {shades.length > 1 && (
          <div className="shade-filter" role="group" aria-label="Filter by one of your palette shades">
            <span className="fact-label">Your shades</span>
            {shades.map((color) => (
              <button key={color.hex} type="button" className={`shade-chip ${filters.shade === color.hex ? "is-active" : ""}`} aria-pressed={filters.shade === color.hex} onClick={() => set("shade", filters.shade === color.hex ? "all" : color.hex)} disabled={!count("shade", color.hex) && filters.shade !== color.hex}>
                <span className="mini-swatch" style={{ background: color.hex }} aria-hidden="true" />{color.name}
              </button>
            ))}
          </div>
        )}
        {visible.length ? (
          <div className="style-grid" aria-live="polite">{visible.map((card) => <StyleCard key={card.id} card={card} categoryLabel={labels[card.category]} occasionLabels={styling.occasion_labels} />)}</div>
        ) : (
          <FilterEmptyState filters={activeLabels} total={items.length} onReset={reset} />
        )}
        <p className="hint">Budget filtering isn&apos;t offered because MatchMyTone doesn&apos;t store prices — we&apos;d rather not guess them.</p>
        {!styling?.palette && <p className="hint palette-hint">Want each idea shown in your best shades? <Link href="/analyses/color">Run a Color Analysis</Link> and new results will use your palette.</p>}
      </section>

      {(styling?.shape_notes?.length > 0 || styling?.fit_guide?.length > 0) && (
        <section className="tips-panel reveal" aria-labelledby="fit-title">
          <SectionHeader eyebrow="Fit & proportion" title="Styling notes for you" id="fit-title" />
          <ul className="tip-list">{styling.shape_notes.map((note) => <li key={note}>{note}</li>)}</ul>
          <dl className="fit-guide">{styling.fit_guide.map((entry) => <div key={entry.topic}><dt>{entry.topic}</dt><dd>{entry.tip}</dd></div>)}</dl>
        </section>
      )}

      {checklist.length > 0 && <ShapeChecklist kind="body" items={checklist} title="Your styling checklist" />}
      <ShapeGuide kind="body" shape={doc.result} catalog={styling?.catalog} />
    </div>
  );
}
