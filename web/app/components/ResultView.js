"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "./Icon";
import { colorDocumentToView, hasRecommendations } from "../../lib/results";
import { OUTDATED_MESSAGE, backendIsOutdated } from "../../lib/serverStatus";
import BodyResultView from "./BodyResultView";
import ColorResultView from "./ColorResultView";
import FaceResultView from "./FaceResultView";
import InsightsPanel from "./InsightsPanel";
import SkincareResultView from "./SkincareResultView";
import TrendsPanel from "./TrendsPanel";
import { FavoritesProvider, ResultStateProvider, useFavorites } from "./useStyling";
import { Notice } from "./ui";

export const API_TYPES = { color: "color-analysis", body: "body-shape", face: "face-shape", skincare: "skincare" };

const STYLIST_PROMPTS = {
  color: "Create an office outfit using my color palette",
  skincare: "Simplify my skincare routine",
  face: "Explain why my top hairstyle might suit my face shape",
  body: "Give me three wedding outfit ideas",
};

/** Entry points to the AI stylist and look generator, pre-filled for this module. */
function StylistLinks({ module }) {
  return (
    <aside className="stylist-links reveal" aria-label="More from your AI stylist">
      <Link className="stylist-link" href={`/stylist?module=${module}&ask=${encodeURIComponent(STYLIST_PROMPTS[module])}`}><Icon name="sparkle" size={18} /><span><strong>Ask your AI stylist</strong><small>“{STYLIST_PROMPTS[module]}”</small></span></Link>
      {module !== "skincare" && <Link className="stylist-link" href="/stylist?tab=looks"><Icon name="hanger" size={18} /><span><strong>Generate looks for an occasion</strong><small>Built from your palette and body result</small></span></Link>}
      <Link className="stylist-link" href="/board"><Icon name="heart" size={18} /><span><strong>Your inspiration board</strong><small>Everything you&apos;ve saved</small></span></Link>
    </aside>
  );
}

function FavoritesError() {
  const { error } = useFavorites();
  return error ? <Notice>{error}</Notice> : null;
}

/** Shown when a saved result has no recommendations (for example an outdated API). Never a success state. */
export function MissingRecommendations({ kind, onRetry, busy, attempts = 0 }) {
  const [outdated, setOutdated] = useState(false);
  useEffect(() => { backendIsOutdated().then(setOutdated); }, [attempts]);
  return (
    <Notice action={<button className="btn btn-quiet btn-small" type="button" onClick={onRetry} disabled={busy} aria-busy={busy}>{busy ? <><span className="btn-spinner" aria-hidden="true" />Trying again…</> : "Try again"}</button>}>
      Your answers are saved, but we couldn&apos;t load your personalised {kind === "skincare" ? "routine" : "recommendations"} just now. Try again — nothing will be lost or saved twice.
      {attempts > 0 && !busy && <><br /><strong>Still not available after {attempts} {attempts === 1 ? "retry" : "retries"}.</strong></>}
      {outdated && <><br /><strong>{OUTDATED_MESSAGE}</strong></>}
    </Notice>
  );
}

function Styled({ kind, doc, capturedImage }) {
  return (
    <ResultStateProvider resultType={API_TYPES[kind]} doc={doc}>
      {kind === "color" && <ColorResultView result={colorDocumentToView(doc)} capturedImage={capturedImage} styling={doc.styling} />}
      {kind === "body" && <BodyResultView doc={doc} />}
      {kind === "face" && <FaceResultView doc={doc} />}
      <div className="result-extras">
        <InsightsPanel catalog={doc.styling?.catalog} />
        <StylistLinks module={kind} />
        <TrendsPanel kind={kind} resultType={API_TYPES[kind]} resultId={doc.id} />
      </div>
    </ResultStateProvider>
  );
}

/** Renders any saved analysis document (live or reopened) with the same components. */
export default function ResultView({ kind, doc: initialDoc, capturedImage }) {
  const [doc, setDoc] = useState(initialDoc);
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  async function reload() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/quiz/${API_TYPES[kind]}/${encodeURIComponent(doc.id)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.result) setDoc(data.result);
    } finally { setBusy(false); setAttempts((count) => count + 1); }
  }
  const complete = hasRecommendations(kind, doc);
  // A color result is still worth showing without styling: its palette is the analysis itself.
  if (!complete && kind !== "color") return <MissingRecommendations kind={kind} onRetry={reload} busy={busy} attempts={attempts} />;
  if (kind === "skincare") {
    return (
      <FavoritesProvider resultId={doc.id}>
        <ResultStateProvider resultType={API_TYPES.skincare} doc={doc}>
          <SkincareResultView skinType={doc.result} plan={doc.plan} />
          <div className="result-extras">
            <InsightsPanel />
            <StylistLinks module="skincare" />
            <TrendsPanel kind="skincare" resultType="skincare" resultId={doc.id} />
          </div>
        </ResultStateProvider>
      </FavoritesProvider>
    );
  }
  return (
    <FavoritesProvider resultId={doc.id}>
      <FavoritesError />
      {!complete && <MissingRecommendations kind={kind} onRetry={reload} busy={busy} attempts={attempts} />}
      <Styled kind={kind} doc={doc} capturedImage={capturedImage} />
    </FavoritesProvider>
  );
}
