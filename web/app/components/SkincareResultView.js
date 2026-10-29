"use client";

import { useState } from "react";
import guides from "../../lib/style-guides.json";
import Checklist from "./Checklist";
import Icon from "./Icon";
import { Notice, SectionHeader } from "./ui";
import { useFavorites, useResultState } from "./useStyling";
import { useToast } from "./Toaster";

const TABS = [["morning", "Morning", "sun"], ["evening", "Evening", "sun_moon"]];
// Product cards are grouped by what they do in the routine.
const FUNCTIONS = [["cleanse", "Cleanse"], ["hydrate", "Hydrate"], ["treat", "Treat"], ["moisturise", "Moisturise"], ["protect", "Protect"]];

// The three steps every routine keeps when someone wants it as short as possible.
const ESSENTIAL = /-(cleanse|moisturise|protect|remove)$/;

function RoutineTabs({ plan }) {
  const [tab, setTab] = useState("morning");
  const [minimal, setMinimal] = useState(false);
  const steps = (id) => (minimal ? plan[id].filter((step) => ESSENTIAL.test(step.id)) : plan[id]);
  const trimmed = ["morning", "evening"].some((id) => steps(id).length !== plan[id].length);
  return (
    <div className="routine-tabs">
      <label className="remember-toggle"><input type="checkbox" checked={minimal} onChange={(event) => setMinimal(event.target.checked)} />Show the simplest version (cleanse, moisturise, protect)</label>
      {minimal && !trimmed && <p className="hint">Your routine is already as simple as it gets.</p>}
      <div className="segmented" role="tablist" aria-label="Routine time of day">
        {TABS.map(([id, label, icon]) => (
          <button key={id} id={`tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls={`panel-${id}`} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}>
            <Icon name={icon} size={16} />{label} ({steps(id).length} steps)
          </button>
        ))}
      </div>
      {TABS.map(([id, label]) => (
        <div key={id} id={`panel-${id}`} role="tabpanel" aria-labelledby={`tab-${id}`} hidden={tab !== id}>
          <Checklist title={`${label} routine`} items={steps(id)} />
        </div>
      ))}
    </div>
  );
}

function ProductCard({ product, note }) {
  const { ids, toggle, ready } = useFavorites();
  const { notify } = useToast();
  const saved = ids.has(product.id);
  async function save() {
    await toggle(product.id);
    notify(saved ? "Removed from your board." : "Saved to your inspiration board.");
  }
  return (
    <article className="product-card">
      <div className="product-media">
        <img src={product.image} alt={`${product.brand} ${product.name}`} loading="lazy" />
        <button type="button" className={`favorite-button ${saved ? "is-saved" : ""}`} aria-pressed={saved} aria-label={saved ? `Remove ${product.name} from your board` : `Save ${product.name} to your board`} onClick={save} disabled={!ready}><Icon name="heart" size={18} /></button>
      </div>
      <div>
        <p className="product-brand">{product.brand} · {product.category}</p>
        <h4>{product.name}</h4>
        <p>{product.reason}</p>
        {note && <p className="ai-note"><Icon name="sparkle" size={14} />{note}</p>}
        {product.ingredients?.length > 0 && (
          <dl className="ingredient-list">{product.ingredients.map((ingredient) => <div key={ingredient.name}><dt>{ingredient.name}</dt><dd>{ingredient.why}</dd></div>)}</dl>
        )}
        <p className="product-caution"><strong>Caution:</strong> {product.caution}</p>
        {Array.isArray(product.alternatives) && (
          <p className="product-alternatives">{product.alternatives.length
            ? <>Other options in our catalog: {product.alternatives.map((alt, index) => <span key={alt.id}>{index > 0 && ", "}<a href={alt.href} target="_blank" rel="noopener noreferrer">{alt.brand} {alt.name}</a></span>)}</>
            : "No other verified option for this step in our catalog yet."}</p>
        )}
        {/^https:\/\//.test(product.href) && <a href={product.href} target="_blank" rel="noopener noreferrer">View on official site<span className="sr-only"> (opens in a new tab)</span> ↗</a>}
      </div>
    </article>
  );
}

/** Skincare result built from the server-generated plan: routine, optional care sections, products and cautions. */
export default function SkincareResultView({ skinType, plan }) {
  const { insights } = useResultState();
  const guide = guides.skincare[skinType] || {};
  if (!plan) return null;
  const groups = FUNCTIONS.map(([step, label]) => [label, plan.products.filter((product) => (product.step || "") === step)]).filter(([, products]) => products.length);
  const ungrouped = plan.products.filter((product) => !FUNCTIONS.some(([step]) => step === product.step));
  return (
    <div className="result-view">
      <section className="result-hero reveal">
        <div className="result-hero-copy">
          <p className="eyebrow">Your skin profile</p>
          <h1>{skinType}</h1>
          {guide.description && <p className="result-lead">{guide.description}</p>}
          {plan.concerns?.length > 0 && <p className="confidence-note">Your answers mentioned: <strong>{plan.concerns.join(", ")}</strong>.</p>}
          {guide.focus && <ul className="pill-list">{guide.focus.map((item) => <li key={item}>{item}</li>)}</ul>}
        </div>
        {guide.image && <img className="hero-illustration" src={`/assets/${guide.image}`} alt={`${skinType} illustration`} />}
      </section>

      <section className="reveal" aria-labelledby="routine-title">
        <SectionHeader eyebrow={plan.level === "advanced" ? "Fuller routine" : "Simple routine"} title="Your morning & evening routine" id="routine-title">Built from your answers{plan.extras?.length ? " and the routine extras you ticked" : ""}. Tick steps as you go — your progress is saved.</SectionHeader>
        <RoutineTabs plan={plan} />
      </section>

      {plan.sections?.length > 0 && (
        <section className="reveal" aria-labelledby="extras-title">
          <SectionHeader eyebrow="Because you told us" title="Extra care for your routine" id="extras-title" />
          <div className="routine-grid">{plan.sections.map((section) => (
            <div key={section.id}>
              <Checklist title={section.title} items={section.steps.map((step, index) => ({ id: `${section.id}-${index}`, label: step.label, detail: step.detail }))} note={section.intro} />
            </div>
          ))}</div>
        </section>
      )}

      <section className="reveal" aria-labelledby="products-title">
        <SectionHeader eyebrow="Recommended for your answers" title="Products in your routine" id="products-title">Grouped by what each one does. We don&apos;t show prices; check the brand&apos;s official page for current details.</SectionHeader>
        <div className="product-groups">{[...groups, ...(ungrouped.length ? [["Other", ungrouped]] : [])].map(([label, products]) => (
          <div className="product-group" key={label}>
            <h3 className="group-title">{label}</h3>
            <div className="product-stack">{products.map((product) => <ProductCard key={product.id} product={product} note={insights?.notes?.[product.id]} />)}</div>
          </div>
        ))}</div>
      </section>

      <Notice tone="info"><strong>Safety notes</strong><ul className="caution-list">{plan.cautions.map((caution) => <li key={caution}>{caution}</li>)}</ul></Notice>
      <p className="disclaimer">{guides.disclaimers.skincare}</p>
    </div>
  );
}
