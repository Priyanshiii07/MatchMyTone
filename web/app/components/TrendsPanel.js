"use client";

import { useCallback, useEffect, useState } from "react";
import Icon from "./Icon";
import { formatDate } from "./ui";

const TITLES = { color: "Colour stories editors are covering", skincare: "What's new in skincare", face: "Hair & eyewear in the news", body: "Outfit ideas in the news" };

/**
 * Latest matching articles from publishers' official RSS feeds, with real publication dates and links.
 * When nothing current matches, evergreen ideas are shown and clearly labelled as not current.
 */
export default function TrendsPanel({ resultType, resultId, kind }) {
  const [state, setState] = useState({ status: "loading" });
  const load = useCallback(() => {
    setState({ status: "loading" });
    return fetch(`/api/quiz/${resultType}/${encodeURIComponent(resultId)}/trends`, { cache: "no-store" })
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => setState(ok && ["ok", "no_matches", "unavailable"].includes(data.status) ? { ...data, status: data.status } : { status: "error" }))
      .catch(() => setState({ status: "error" }));
  }, [resultType, resultId]);
  useEffect(() => { if (resultId) load(); }, [load, resultId]);

  const sources = state.sources || [];
  return (
    <section className="trends-panel reveal" aria-labelledby="trends-title" aria-busy={state.status === "loading"}>
      <div className="trends-head">
        <p className="eyebrow"><Icon name="sparkle" size={14} />Trending now</p>
        <h2 id="trends-title">{TITLES[kind]}</h2>
      </div>
      {state.status === "loading" && <div className="skeleton-grid" aria-hidden="true">{[0, 1, 2].map((index) => <div className="skeleton-card" key={index}><span /><span /><span /></div>)}</div>}
      {state.status === "error" && <p className="trends-empty">We couldn&apos;t reach the trend feeds just now. <button className="link-button" type="button" onClick={load}>Try again</button></p>}
      {state.status === "ok" && (
        <ul className="trend-grid">{state.items.map((item) => (
          <li key={item.url} className="trend-card">
            <p className="trend-meta">{item.publisher}{item.published_at && <> · <time dateTime={item.published_at}>{formatDate(item.published_at)}</time></>}</p>
            <h3><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}<span className="sr-only"> (opens {item.publisher} in a new tab)</span></a></h3>
            {item.summary && <p>{item.summary}</p>}
            <p className="trend-why"><strong>Why you&apos;re seeing this:</strong> it mentions {item.matched.join(", ")} — relevant to your result.</p>
          </li>
        ))}</ul>
      )}
      {state.evergreen?.length > 0 && (
        <div className="evergreen">
          <p className="trends-empty">{state.status === "unavailable" ? "The trend feeds aren't reachable right now, so here are" : "No recent articles match your result closely enough, so here are"} <strong>evergreen ideas — timeless styling advice, not current trends.</strong></p>
          <ul className="trend-grid">{state.evergreen.map((idea) => <li key={idea.title} className="trend-card is-evergreen"><p className="trend-meta">Evergreen idea</p><h3>{idea.title}</h3><p>{idea.tip}</p></li>)}</ul>
        </div>
      )}
      {(state.status === "ok" || state.status === "no_matches") && (
        <p className="hint">{state.note} Feeds checked: {sources.map((source) => `${source.publisher} (${formatDate(source.retrieved_at)}${source.stale ? ", last saved copy" : ""})`).join(", ")}.</p>
      )}
    </section>
  );
}
