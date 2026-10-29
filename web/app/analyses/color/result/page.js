"use client";

import { useEffect, useState } from "react";
import AnalysisLoader from "../../../components/AnalysisLoader";
import BackButton from "../../../components/BackButton";
import Celebrate from "../../../components/Celebrate";
import PageShell from "../../../components/PageShell";
import ResultActions from "../../../components/ResultActions";
import ResultView from "../../../components/ResultView";
import { EmptyState } from "../../../components/ui";

export default function ColorResultPage() {
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) { setState({ status: "missing" }); return; }
    let stored = null;
    try { stored = JSON.parse(sessionStorage.getItem("matchmytone-color-result") || "null"); } catch { stored = null; }
    fetch(`/api/quiz/color-analysis/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((response) => {
        if (response.status === 401) { window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return null; }
        return response.ok ? response.json() : Promise.reject(new Error(String(response.status)));
      })
      .then((payload) => {
        if (!payload) return;
        // The selfie lives only in this tab's session storage and is shown only for the result it produced.
        setState({ status: "ready", id, doc: payload.result, capturedImage: stored?.id === id ? stored.capturedImage : null });
      })
      .catch(() => setState({ status: "missing" }));
  }, []);
  return (
    <PageShell width="wide" className="module-color">
      <div className="page-toolbar"><BackButton fallback="/results" /></div>
      {state.status === "loading" && <AnalysisLoader module="results" />}
      {state.status === "missing" && <EmptyState icon="palette" title="We couldn't open this color result" action={{ href: "/analyses/color", label: "Start a new color analysis" }}>It may have been opened from an old link. Your saved analyses are always in your Results journal.</EmptyState>}
      {state.status === "ready" && <>{state.capturedImage && <Celebrate />}<ResultView kind="color" doc={state.doc} capturedImage={state.capturedImage} /><ResultActions resultType="color-analysis" resultId={state.id} restart={{ href: "/analyses/color", label: "Analyse another selfie" }} /></>}
    </PageShell>
  );
}
