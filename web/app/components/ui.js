import Link from "next/link";
import Icon from "./Icon";

export const MODULES = {
  color: { title: "Color Analysis", icon: "palette", href: "/analyses/color", route: "color", key: "color_analysis", accent: "coral" },
  skincare: { title: "Skincare Analysis", icon: "droplet", href: "/analyses/skincare", route: "skincare", key: "skincare", accent: "sage" },
  face: { title: "Face Analysis", icon: "face", href: "/analyses/face-shape", route: "face-shape", key: "face_shape", accent: "gold" },
  body: { title: "Body Analysis", icon: "body", href: "/analyses/body-shape", route: "body-shape", key: "body_shape", accent: "rose" },
};

export function ModuleIcon({ module, size = 26 }) {
  const config = MODULES[module];
  return <span className={`module-icon accent-${config.accent}`} aria-hidden="true"><Icon name={config.icon} size={size} /></span>;
}

export function SectionHeader({ eyebrow, title, children, id }) {
  return <header className="section-header">{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 id={id}>{title}</h2>{children && <p className="section-lead">{children}</p>}</header>;
}

export function EmptyState({ icon = "sparkle", title, children, action }) {
  return <div className="empty-state"><span className="empty-icon" aria-hidden="true"><Icon name={icon} size={24} /></span><h3>{title}</h3>{children && <p>{children}</p>}{action && <Link className="btn btn-secondary btn-small" href={action.href}>{action.label}<Icon name="arrow-right" size={16} /></Link>}</div>;
}

export function Notice({ tone = "error", children, action }) {
  return <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}><Icon name={tone === "error" ? "alert" : tone === "success" ? "check" : "sparkle"} /><div>{children}</div>{action}</div>;
}

export function SkeletonCards({ count = 3 }) {
  return <div className="skeleton-grid" aria-hidden="true">{Array.from({ length: count }, (_, index) => <div className="skeleton-card" key={index}><span /><span /><span /></div>)}</div>;
}

export function formatDate(value) {
  // The API returns naive UTC timestamps; without a zone the browser would read them as local time.
  const text = typeof value === "string" && /T\d{2}:\d{2}/.test(value) && !/(Z|[+-]\d{2}:?\d{2})$/.test(value) ? `${value}Z` : value;
  const date = text ? new Date(text) : null;
  if (!date || Number.isNaN(date.getTime())) return "Date not recorded";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

/**
 * Shown only when real recommendations exist but the chosen filters exclude all of them.
 * Names the filters responsible and offers a reset; the rest of the page stays visible.
 */
export function FilterEmptyState({ filters, total, onReset }) {
  return (
    <div className="empty-state filter-empty" role="status">
      <span className="empty-icon" aria-hidden="true"><Icon name="hanger" size={24} /></span>
      <h3>No ideas match {filters.length ? filters.join(" + ") : "these filters"}</h3>
      <p>You have {total} recommendation{total === 1 ? "" : "s"} in total — {filters.length > 1 ? "this combination of filters" : "this filter"} just doesn&apos;t include any of them. Reset to see everything, or pick another option.</p>
      <button className="btn btn-secondary btn-small" type="button" onClick={onReset}><Icon name="refresh" size={16} />Reset filters</button>
    </div>
  );
}
