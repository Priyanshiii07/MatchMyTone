"use client";

import { useEffect, useRef, useState } from "react";
import { shuffle } from "../../lib/analysis";
import { navigateTo } from "../../lib/browser";
import BackButton from "./BackButton";
import Icon from "./Icon";
import { ModuleIcon } from "./ui";


/**
 * Guided, one-question-at-a-time questionnaire. Choosing an answer selects it; Continue moves on, Back
 * returns with the earlier answer still selected. On completion it opens resultPath with the answers and a
 * request id. An optional `FinalStep` component is shown after the last question; it calls onDone(extraQueryParams).
 */
export default function QuizRunner({ module, title, intro, questions, resultPath, FinalStep }) {
  // Shuffle after mount so server and client render the same initial markup.
  const [ordered, setOrdered] = useState(questions);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [finishing, setFinishing] = useState(false);
  const [finalStep, setFinalStep] = useState(false);
  const [prompt, setPrompt] = useState("");
  const headingRef = useRef(null);
  useEffect(() => { setOrdered(shuffle(questions)); }, [questions]);
  const current = ordered[index];
  const selected = answers[current.id];
  const answeredCount = Object.keys(answers).length;
  const isLast = index + 1 === ordered.length;

  function finish(next, extra = {}) {
    setFinishing(true);
    const params = new URLSearchParams({ answers: JSON.stringify(next), rid: crypto.randomUUID(), ...extra });
    navigateTo(`${resultPath}?${params}`);
  }

  function go(nextIndex) {
    setIndex(nextIndex);
    setPrompt("");
    // Move focus to the new question so keyboard and screen-reader users follow the step change.
    window.requestAnimationFrame(() => headingRef.current?.focus());
  }

  function choose(option) {
    if (finishing) return;
    setAnswers({ ...answers, [current.id]: option });
    setPrompt("");
  }

  function next() {
    if (finishing) return;
    if (!selected) { setPrompt("Choose the answer that fits best — or “Not sure” where it's offered."); return; }
    if (!isLast) { go(index + 1); return; }
    if (FinalStep) { setFinalStep(true); return; }
    finish(answers);
  }

  // Arrow keys move between options like a native radio group.
  function onOptionKey(event, position) {
    const delta = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    if (!delta) return;
    event.preventDefault();
    const target = (position + delta + current.options.length) % current.options.length;
    choose(current.options[target]);
    event.currentTarget.parentElement.children[target]?.focus();
  }

  if (finalStep) {
    return (
      <section className="quiz-shell">
        <div className="page-toolbar"><button className="back-button" type="button" onClick={() => setFinalStep(false)} disabled={finishing}><Icon name="arrow-left" size={16} />Back to questions</button></div>
        <FinalStep busy={finishing} onDone={(extra) => finish(answers, extra)} />
      </section>
    );
  }

  return (
    <section className={`quiz-shell quiz-${module}`}>
      <div className="page-toolbar"><BackButton fallback="/dashboard" confirmLeave={() => (answeredCount > 0 && !finishing ? "Leave the questionnaire? Your answers so far will not be saved." : null)} /></div>
      <header className="quiz-intro reveal">
        <ModuleIcon module={module} />
        <div><p className="eyebrow">Step-by-step</p><h1>{title}</h1>{intro && <p>{intro}</p>}</div>
      </header>
      <div className="quiz-progress">
        <div className="quiz-progress-meta"><span>Question {index + 1} of {ordered.length}</span><span>{Math.round((answeredCount / ordered.length) * 100)}% answered</span></div>
        <div className="progress-track" role="progressbar" aria-label="Questionnaire progress" aria-valuemin={0} aria-valuemax={ordered.length} aria-valuenow={answeredCount}><span style={{ width: `${(answeredCount / ordered.length) * 100}%` }} /></div>
        <ol className="progress-dots" aria-hidden="true">{ordered.map((question, position) => <li key={question.id} className={position === index ? "is-current" : answers[question.id] ? "is-done" : ""} />)}</ol>
      </div>
      <div className="quiz-card" key={current.id}>
        <h2 id="quiz-question" ref={headingRef} tabIndex={-1}>{current.question}</h2>
        {current.hint && <p className="quiz-hint"><Icon name="sparkle" size={14} />{current.hint}</p>}
        <div className="quiz-options" role="radiogroup" aria-labelledby="quiz-question">
          {current.options.map((option, position) => {
            const checked = selected?.label === option.label;
            return (
              <button className={`quiz-option ${checked ? "is-chosen" : ""} ${option.label === "?" ? "is-unsure" : ""}`} key={option.label} type="button" role="radio" aria-checked={checked} tabIndex={checked || (!selected && position === 0) ? 0 : -1} onClick={() => choose(option)} onKeyDown={(event) => onOptionKey(event, position)} disabled={finishing}>
                <span className="option-label" aria-hidden="true">{checked ? <Icon name="check" size={16} /> : option.label}</span><span>{option.text}</span>
              </button>
            );
          })}
        </div>
        <p className="quiz-prompt" role="status">{prompt}</p>
      </div>
      <div className="quiz-footer">
        <button className="btn btn-quiet" type="button" onClick={() => go(index - 1)} disabled={index === 0 || finishing}><Icon name="arrow-left" size={16} />Previous question</button>
        <button className="btn btn-primary" type="button" onClick={next} disabled={finishing} aria-busy={finishing}>
          {finishing ? <><span className="btn-spinner" aria-hidden="true" />Preparing your results…</> : <>{isLast ? (FinalStep ? "Continue" : "See my results") : "Continue"}<Icon name="arrow-right" size={16} /></>}
        </button>
      </div>
    </section>
  );
}
