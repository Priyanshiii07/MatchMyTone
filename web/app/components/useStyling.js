"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { aiErrorMessage } from "../../lib/aiMessages";
import { OUTDATED_MESSAGE, backendIsOutdated } from "../../lib/serverStatus";

const ResultStateContext = createContext({ checklist: {}, shades: [], insights: null, toggleItem: () => {}, toggleShade: () => {}, generateInsights: async () => {}, progressError: "", insightsState: { status: "idle" }, enabled: false });


/**
 * Per-result state saved on the server with the result: checklist ticks, favourite shades and AI notes.
 * Updates are optimistic and roll back with a visible message if saving fails.
 */
export function ResultStateProvider({ resultType, doc, children }) {
  const [state, setState] = useState(doc?.user_state || {});
  const [insights, setInsights] = useState(doc?.insights || null);
  const [progressError, setProgressError] = useState("");
  const [insightsState, setInsightsState] = useState({ status: "idle", message: "" });
  useEffect(() => { setState(doc?.user_state || {}); setInsights(doc?.insights || null); }, [doc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async (patch, rollback) => {
    setProgressError("");
    try {
      const response = await fetch(`/api/quiz/${resultType}/${encodeURIComponent(doc.id)}/progress`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      if (!response.ok) throw new Error();
    } catch {
      rollback();
      setProgressError("We couldn't save that change. Please check your connection and try again.");
    }
  }, [doc?.id, resultType]);

  const toggleItem = useCallback((id) => {
    const previous = state.checklist || {};
    const value = !previous[id];
    setState((current) => ({ ...current, checklist: { ...(current.checklist || {}), [id]: value } }));
    save({ checklist: { [id]: value } }, () => setState((current) => ({ ...current, checklist: previous })));
  }, [save, state.checklist]);

  const toggleShade = useCallback((hex) => {
    const previous = state.shades || [];
    const next = previous.includes(hex) ? previous.filter((item) => item !== hex) : [...previous, hex].slice(-12);
    setState((current) => ({ ...current, shades: next }));
    save({ shades: next }, () => setState((current) => ({ ...current, shades: previous })));
  }, [save, state.shades]);

  const generateInsights = useCallback(async () => {
    setInsightsState({ status: "busy", message: "" });
    try {
      const response = await fetch(`/api/quiz/${resultType}/${encodeURIComponent(doc.id)}/insights`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 404 && (await backendIsOutdated())) throw new Error(OUTDATED_MESSAGE);
      if (!response.ok || !data.insights) throw new Error(`${aiErrorMessage(data, response.status).text} Your recommendations below are unaffected.`);
      setInsights(data.insights);
      setInsightsState({ status: "done", message: "" });
    } catch (error) {
      setInsightsState({ status: "error", message: error.message });
    }
  }, [doc?.id, resultType]);

  const value = useMemo(() => ({ checklist: state.checklist || {}, shades: state.shades || [], insights, toggleItem, toggleShade, generateInsights, progressError, insightsState, enabled: Boolean(doc?.id) }), [state, insights, toggleItem, toggleShade, generateInsights, progressError, insightsState, doc?.id]);
  return <ResultStateContext.Provider value={value}>{children}</ResultStateContext.Provider>;
}

export function useResultState() {
  return useContext(ResultStateContext);
}

const FavoritesContext = createContext({ ids: new Set(), toggle: async () => {}, ready: false, error: "" });

/** Loads the user's saved styles once and shares them with every card on the page. */
export function FavoritesProvider({ children, resultId }) {
  const [ids, setIds] = useState(new Set());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/favorites", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error())))
      .then((data) => { setIds(new Set((data.favorites || []).map((item) => item.item_id))); setReady(true); })
      .catch(() => setReady(true));
  }, []);

  const toggle = useCallback(async (itemId) => {
    const saved = ids.has(itemId);
    setError("");
    setIds((current) => { const next = new Set(current); if (saved) next.delete(itemId); else next.add(itemId); return next; });
    try {
      const response = saved
        ? await fetch(`/api/favorites/${encodeURIComponent(itemId)}`, { method: "DELETE" })
        : await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_id: itemId, result_id: resultId }) });
      if (!response.ok) throw new Error();
    } catch {
      setIds((current) => { const next = new Set(current); if (saved) next.add(itemId); else next.delete(itemId); return next; });
      setError("We couldn't update your saved styles. Please try again.");
    }
  }, [ids, resultId]);

  const value = useMemo(() => ({ ids, toggle, ready, error }), [ids, toggle, ready, error]);
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
