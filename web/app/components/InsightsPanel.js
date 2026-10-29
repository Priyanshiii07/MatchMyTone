"use client";

import Icon from "./Icon";
import { formatDate } from "./ui";
import { useResultState } from "./useStyling";

/**
 * AI-written notes explaining this result's recommendations. Generated only when the user asks,
 * saved with the result, and never changes which items are recommended.
 */
export default function InsightsPanel({ catalog }) {
  const { insights, generateInsights, insightsState, enabled } = useResultState();
  if (!enabled) return null;
  const busy = insightsState.status === "busy";
  const outdated = insights && catalog && insights.catalog && insights.catalog !== catalog;
  return (
    <section className="insights-panel reveal" aria-labelledby="insights-title" aria-busy={busy}>
      <div className="insights-head">
        <span className="insights-badge" aria-hidden="true"><Icon name="sparkle" size={20} /></span>
        <div>
          <p className="eyebrow">Your stylist&apos;s notes</p>
          <h2 id="insights-title">{insights ? "Why these ideas suit you" : "Want a personal explanation?"}</h2>
        </div>
      </div>
      {insights && !outdated && (
        <>
          <p className="insights-summary">{insights.summary}</p>
          {insights.tips?.length > 0 && <ul className="tip-list">{insights.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>}
          <p className="hint">Written by AI from your saved result on {formatDate(insights.generated_at)}. Notes also appear on the matching cards below.</p>
        </>
      )}
      {outdated && <p className="section-lead">These notes were written for a different styling catalog. Refresh them to match your current ideas.</p>}
      {!insights && <p className="section-lead">Our AI stylist can explain, in plain words, why each idea below may work for your result and preferences. It won&apos;t change what&apos;s recommended.</p>}
      <div className="action-group">
        <button className="btn btn-secondary btn-small" type="button" onClick={generateInsights} disabled={busy} aria-busy={busy}>
          {busy ? <span className="btn-spinner" aria-hidden="true" /> : <Icon name={insights ? "refresh" : "sparkle"} size={16} />}
          {busy ? "Your style edit is on its way…" : insights ? "Refresh notes" : "Explain my recommendations"}
        </button>
      </div>
      <div role="status" aria-live="polite">{insightsState.status === "error" && <p className="calm-notice"><Icon name="sparkle" size={16} />{insightsState.message}</p>}</div>
    </section>
  );
}
