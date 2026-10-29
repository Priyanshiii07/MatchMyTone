"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import guides from "../../lib/style-guides.json";
import { RESULT_ROUTES, resultLabel } from "../../lib/results";
import BackButton from "../components/BackButton";
import Icon from "../components/Icon";
import PageShell from "../components/PageShell";
import { EmptyState, MODULES, ModuleIcon, Notice, SkeletonCards, formatDate } from "../components/ui";

const ORDER = ["color", "skincare", "face", "body"];
const HEX = /^#[0-9a-f]{6}$/i;

function Preview({ module, item }) {
  if (module === "color") {
    const colors = (item.colors_to_wear || item.colorsToWear || []).map((color) => color?.hex).filter((hex) => HEX.test(String(hex))).slice(0, 6);
    return colors.length ? <span className="card-palette" aria-hidden="true">{colors.map((hex, index) => <span key={`${hex}-${index}`} style={{ background: hex }} />)}</span> : null;
  }
  const source = module === "skincare" ? guides.skincare : guides[module];
  const image = source?.[item.result]?.image;
  return image ? <img className="card-thumb" src={`/assets/${image}`} alt="" loading="lazy" /> : null;
}

export default function ResultsPage() {
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  function load() {
    setError(false);
    fetch("/api/quiz/results", { cache: "no-store" })
      .then((response) => {
        if (response.status === 401) { window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`); return null; }
        return response.ok ? response.json() : Promise.reject(new Error());
      })
      .then((data) => data && setGroups(data.results || {}))
      .catch(() => setError(true));
  }
  useEffect(load, []);

  const total = useMemo(() => (groups ? ORDER.reduce((sum, module) => sum + (groups[MODULES[module].key] || []).length, 0) : 0), [groups]);
  const visible = filter === "all" ? ORDER : [filter];

  return (
    <PageShell width="wide" className="module-results">
      <div className="page-toolbar"><BackButton fallback="/dashboard" /></div>
      <header className="page-intro reveal"><p className="eyebrow">Your style journal</p><h1>Results worth <em>revisiting.</em></h1><p>Every analysis you save stays with your account. Reopen any of them to explore again or download a printable summary.</p></header>
      {error && <Notice action={<button className="btn btn-quiet btn-small" type="button" onClick={load}>Try again</button>}>We couldn&apos;t load your results just now.</Notice>}
      {!groups && !error && <SkeletonCards count={4} />}
      {groups && (
        <>
          <div className="journal-toolbar">
            <div className="segmented" role="group" aria-label="Filter results">
              <button type="button" className={filter === "all" ? "is-active" : ""} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All ({total})</button>
              {ORDER.map((module) => <button key={module} type="button" className={filter === module ? "is-active" : ""} aria-pressed={filter === module} onClick={() => setFilter(module)}>{MODULES[module].title.replace(" Analysis", "")} ({(groups[MODULES[module].key] || []).length})</button>)}
            </div>
            <label className="sort-control">Sort<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
          </div>
          <div className="journal-sections">
            {visible.map((module) => {
              const config = MODULES[module];
              const items = [...(groups[config.key] || [])].sort((a, b) => (sort === "newest" ? 1 : -1) * String(b.created_at || "").localeCompare(String(a.created_at || "")));
              return (
                <section className="journal-section reveal" key={module} aria-labelledby={`journal-${module}`}>
                  <header className="journal-heading"><ModuleIcon module={module} size={22} /><h2 id={`journal-${module}`}>{config.title}</h2><span className="count-badge">{items.length} saved</span></header>
                  {!items.length ? (
                    <EmptyState icon={config.icon} title="Nothing saved here yet" action={{ href: config.href, label: `Start ${config.title.toLowerCase()}` }}>Complete this analysis and your result will appear in your journal automatically.</EmptyState>
                  ) : (
                    <ul className="journal-grid">{items.map((item) => (
                      <li key={item.id}>
                        <Link className="journal-card" href={`/results/${RESULT_ROUTES[config.key]}/${item.id}`}>
                          <Preview module={module} item={item} />
                          <span className="journal-card-body"><strong>{resultLabel(config.key, item)}</strong><small><Icon name="journal" size={14} />{formatDate(item.created_at)}</small></span>
                          <span className="journal-card-cta">View results<Icon name="arrow-right" size={16} /></span>
                        </Link>
                      </li>
                    ))}</ul>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </PageShell>
  );
}
