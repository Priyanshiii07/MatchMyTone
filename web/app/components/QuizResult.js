"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { scoreShapes } from "../../lib/analysis";
import { hasRecommendations } from "../../lib/results";
import { skinTypeName } from "../../lib/skincare";
import AnalysisLoader from "./AnalysisLoader";
import BackButton from "./BackButton";
import Celebrate from "./Celebrate";
import ResultActions from "./ResultActions";
import ResultView from "./ResultView";
import { EmptyState, Notice } from "./ui";

const CONFIG = {
  skincare: { api: "skincare", quiz: "/analyses/skincare", restart: "Retake skincare quiz" },
  face: { api: "face-shape", quiz: "/analyses/face-shape", restart: "Retake face quiz" },
  body: { api: "body-shape", quiz: "/analyses/body-shape", restart: "Retake body quiz" },
};

export function readQuizQuery(search) {
  const query = new URLSearchParams(search);
  let answers = {};
  try { answers = JSON.parse(query.get("answers") || "{}"); } catch { answers = {}; }
  const extras = (query.get("extras") || "").split(",").filter(Boolean);
  return { answers: answers && typeof answers === "object" ? answers : {}, requestId: query.get("rid") || "", extras };
}

/**
 * Live result page for questionnaire modules. The answers are scored as before, then saved once per completion;
 * the server generates the personalised recommendations and the page renders the saved document.
 */
export default function QuizResult({ kind }) {
  const config = CONFIG[kind];
  const [query, setQuery] = useState(null);
  const [save, setSave] = useState({ state: "saving", doc: null });
  useEffect(() => { setQuery(readQuizQuery(window.location.search)); }, []);
  const result = useMemo(() => {
    if (!query || !Object.keys(query.answers).length) return null;
    return kind === "skincare" ? skinTypeName(query.answers) : scoreShapes(query.answers, kind);
  }, [query, kind]);

  const persist = useCallback(async () => {
    if (!result) return;
    setSave({ state: "saving", doc: null });
    const body = { answers: query.answers, result, ...(query.requestId ? { request_id: query.requestId } : {}), ...(kind === "skincare" ? { routine_extras: query.extras } : {}) };
    try {
      const response = await fetch(`/api/quiz/${config.api}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (response.status === 401) { window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.result?.id) throw new Error();
      setSave({ state: "saved", doc: data.result });
    } catch {
      setSave({ state: "error", doc: null });
    }
  }, [config.api, kind, query, result]);
  useEffect(() => { persist(); }, [persist]);

  const back = <div className="page-toolbar"><BackButton fallback="/results" /></div>;
  if (!query) return back;
  if (!result) return <>{back}<EmptyState title="No answers found" action={{ href: config.quiz, label: "Start the questionnaire" }}>This page needs a completed questionnaire. Start again to get your personalised result.</EmptyState></>;
  return (
    <>
      {back}
      {save.state === "saving" && <AnalysisLoader module={kind} />}
      {save.state === "error" && <Notice action={<button className="btn btn-quiet btn-small" type="button" onClick={persist}>Try again</button>}>We couldn&apos;t save your {kind === "skincare" ? "routine" : "result"} yet, so we can&apos;t show your personalised recommendations. Your answers are kept on this page — try again.</Notice>}
      {save.doc && hasRecommendations(kind, save.doc) && <><Celebrate /><Notice tone="success">Saved to your results journal.</Notice></>}
      {save.doc && <ResultView kind={kind} doc={save.doc} />}
      <ResultActions resultType={config.api} resultId={save.doc?.id || ""} pending={save.state === "saving"} restart={{ href: config.quiz, label: config.restart }} />
    </>
  );
}
