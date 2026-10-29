"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AnalysisLoader from "../../../components/AnalysisLoader";
import BackButton from "../../../components/BackButton";
import PageShell from "../../../components/PageShell";
import ResultActions from "../../../components/ResultActions";
import ResultView from "../../../components/ResultView";
import { EmptyState, MODULES, formatDate } from "../../../components/ui";
import { ROUTE_KINDS } from "../../../../lib/results";

export default function SavedResultPage() {
  const params = useParams();
  const kind = ROUTE_KINDS[params?.type];
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    if (!kind || !params?.id) { setState({ status: "missing" }); return; }
    fetch(`/api/quiz/${params.type}/${encodeURIComponent(params.id)}`, { cache: "no-store" })
      .then((response) => {
        if (response.status === 401) { window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`); return null; }
        return response.ok ? response.json() : Promise.reject(new Error(String(response.status)));
      })
      .then((data) => data && setState({ status: "ready", doc: data.result }))
      .catch(() => setState({ status: "missing" }));
  }, [kind, params?.type, params?.id]);

  const moduleConfig = kind ? MODULES[kind] : null;
  const doc = state.doc;
  return (
    <PageShell width="wide" className={kind ? `module-${kind}` : ""}>
      <div className="page-toolbar"><BackButton fallback="/results" label="Back to results" /></div>
      {state.status === "loading" && <AnalysisLoader module="results" />}
      {state.status === "missing" && <EmptyState icon="journal" title="We couldn't find this saved result" action={{ href: "/results", label: "Open your results journal" }}>It may belong to another account or the link may be incomplete.</EmptyState>}
      {state.status === "ready" && (
        <>
          <p className="saved-meta">Saved {formatDate(doc.created_at)}</p>
          <ResultView kind={kind} doc={doc} />
          <ResultActions resultType={params.type} resultId={doc.id} restart={{ href: moduleConfig.href, label: kind === "color" ? "Analyse another selfie" : "Retake this analysis" }} />
        </>
      )}
    </PageShell>
  );
}
