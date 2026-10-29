"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon";
import { AI_LOADING, aiErrorMessage } from "../../lib/aiMessages";

const STORAGE_KEY = "matchmytone-stylist-chat";
const STARTERS = [
  "Create an office outfit using my color palette",
  "Give me three wedding outfit ideas",
  "Explain why my top hairstyle might suit my face shape",
  "Simplify my skincare routine",
  "Help me combine items for a casual weekend look",
];
const MODULE_KEYS = { color: "color_analysis", skincare: "skincare", face: "face_shape", body: "body_shape" };

function readHistory() {
  try { return JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "[]").filter((m) => m && typeof m.content === "string"); } catch { return []; }
}

/**
 * Chat with the AI stylist about the user's own saved results. The conversation lives only in this
 * browser tab (sessionStorage); the server answers from saved results and stores nothing.
 */
export default function StylistChat({ module, initialQuestion }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [state, setState] = useState({ status: "idle", message: "", retry: false, followUps: [] });
  const sentInitial = useRef(false);
  const endRef = useRef(null);

  useEffect(() => { setMessages(readHistory()); }, []);
  useEffect(() => {
    try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20))); } catch { /* storage unavailable */ }
    endRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [messages]);

  async function send(text, history = messages) {
    const question = text.trim();
    if (!question || state.status === "busy") return;
    const next = [...history, { role: "user", content: question }];
    setMessages(next);
    setDraft("");
    setState({ status: "busy", message: "", followUps: [] });
    let response = null;
    let data = {};
    try {
      response = await fetch("/api/stylist/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.slice(-10), module: MODULE_KEYS[module] }) });
      data = await response.json().catch(() => ({}));
    } catch { /* network failure: reported below */ }
    if (response?.ok && data.reply) {
      setMessages([...next, { role: "assistant", content: data.reply }]);
      setState({ status: "idle", message: "", retry: false, followUps: data.follow_ups || [] });
      return;
    }
    const failure = aiErrorMessage(data, response?.status || 0);
    setState({ status: "error", message: failure.text, retry: failure.retry, followUps: [] });
  }

  function retry() {
    const last = messages[messages.length - 1];
    if (last?.role !== "user") return;
    send(last.content, messages.slice(0, -1));
  }

  useEffect(() => {
    if (initialQuestion && !sentInitial.current) { sentInitial.current = true; setDraft(initialQuestion); }
  }, [initialQuestion]);

  return (
    <section className="chat-panel" aria-labelledby="chat-title">
      <div className="chat-head">
        <div><p className="eyebrow"><Icon name="sparkle" size={14} />AI stylist</p><h2 id="chat-title">Ask about your results</h2></div>
        <button className="btn btn-quiet btn-small" type="button" onClick={() => { setMessages([]); setState({ status: "idle", message: "", retry: false, followUps: [] }); }} disabled={!messages.length || state.status === "busy"}><Icon name="refresh" size={16} />New conversation</button>
      </div>
      <p className="hint">Answers use only your own saved analyses and preferences. Skincare answers are general information, not medical advice.</p>
      <div className="chat-log" aria-live="polite">
        {!messages.length && <div className="chat-empty"><p>Try one of these:</p><div className="chip-row">{STARTERS.map((starter) => <button key={starter} type="button" className="chip" onClick={() => send(starter)}>{starter}</button>)}</div></div>}
        {messages.map((message, index) => (
          <div key={index} className={`chat-bubble is-${message.role}`}>
            <span className="sr-only">{message.role === "user" ? "You said:" : "Stylist said:"}</span>
            {message.content.split("\n").map((line, lineIndex) => <p key={lineIndex}>{line}</p>)}
          </div>
        ))}
        {state.status === "busy" && <div className="chat-bubble is-assistant is-typing" role="status"><span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>{AI_LOADING}</div>}
        {state.status === "error" && <p className="calm-notice" role="alert"><Icon name="sparkle" size={16} />{state.message}{state.retry && <> <button className="link-button" type="button" onClick={retry}>Try again</button></>}</p>}
        <div ref={endRef} />
      </div>
      {state.followUps.length > 0 && <div className="chip-row follow-ups">{state.followUps.map((question) => <button key={question} type="button" className="chip" onClick={() => send(question)}>{question}</button>)}</div>}
      <form className="chat-form" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
        <label className="sr-only" htmlFor="chat-input">Your question</label>
        <textarea id="chat-input" rows={2} maxLength={1000} value={draft} placeholder="Ask for an outfit, a routine tweak or a hairstyle explanation…" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(draft); } }} />
        <button className="btn btn-primary" type="submit" disabled={!draft.trim() || state.status === "busy"}>{state.status === "busy" ? <span className="btn-spinner" aria-hidden="true" /> : <Icon name="arrow-right" />}Send</button>
      </form>
    </section>
  );
}
