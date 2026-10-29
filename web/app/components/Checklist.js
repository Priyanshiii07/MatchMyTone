"use client";

import Icon from "./Icon";
import { useResultState } from "./useStyling";

/** Interactive checklist whose ticks are saved with the result in the user's account (see ResultStateProvider). */
export default function Checklist({ items, title, note = "Your ticks are saved to your account, so they follow you to any device." }) {
  const { checklist, toggleItem, enabled, progressError } = useResultState();
  const completed = items.filter((item) => checklist[item.id]).length;
  const percent = items.length ? Math.round((completed / items.length) * 100) : 0;
  return (
    <div className="checklist">
      {title && (
        <div className="checklist-head">
          <h3>{title}</h3>
          <span>{completed}/{items.length} done</span>
        </div>
      )}
      <div className="checklist-progress" role="progressbar" aria-label={`${title || "Checklist"} progress`} aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={completed}><span style={{ width: `${percent}%` }} /></div>
      <ul>{items.map((item) => (
        <li key={item.id}>
          <label className={checklist[item.id] ? "is-done" : ""}>
            <input type="checkbox" checked={Boolean(checklist[item.id])} onChange={() => toggleItem(item.id)} disabled={!enabled} />
            <span className="check-box" aria-hidden="true"><Icon name="check" size={14} /></span>
            <span className="check-text"><strong>{item.label}</strong>{item.detail && <small>{item.detail}</small>}{item.why && <small className="step-why">Why here: {item.why}</small>}</span>
          </label>
        </li>
      ))}</ul>
      {completed === items.length && items.length > 0 && <p className="checklist-complete" role="status"><Icon name="sparkle" size={14} />All done — lovely work.</p>}
      {progressError && <p className="status-error" role="alert"><Icon name="alert" size={14} />{progressError}</p>}
      {note && <p className="checklist-note">{note}</p>}
    </div>
  );
}
