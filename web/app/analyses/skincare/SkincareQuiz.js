"use client";

import { useEffect, useState } from "react";
import ChoiceChips from "../../components/ChoiceChips";
import Icon from "../../components/Icon";
import QuizRunner from "../../components/QuizRunner";
import { SKINCARE_EXTRAS, groupedSkincareExtras } from "../../../lib/preferences";
import { questions } from "./questions";

// Only explicit preferences pre-tick an extra; nothing is assumed from gender.
function prefilledExtras(preferences = {}) {
  const extras = [];
  if (["beard", "stubble"].includes(preferences.facial_hair)) extras.push("beard");
  if (preferences.facial_hair === "clean_shaven") extras.push("shaving");
  return extras;
}

function RoutineExtras({ onDone, busy }) {
  const [extras, setExtras] = useState([]);
  useEffect(() => {
    fetch("/api/users/preferences", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => data && setExtras((current) => (current.length ? current : prefilledExtras(data.preferences))))
      .catch(() => {});
  }, []);
  return (
    <div className="quiz-card extras-card">
      <p className="eyebrow">Last step · optional</p>
      <h2>Anything else we should plan for?</h2>
      <p className="chip-help">{SKINCARE_EXTRAS.help}</p>
      {Object.entries(groupedSkincareExtras()).map(([group, options]) => (
        <ChoiceChips key={group} field="skincare_extras" legend={group} help="" options={options} multi value={extras} onChange={(value) => setExtras(value.filter((item) => SKINCARE_EXTRAS.options.some((option) => option.value === item)))} name={`extras-${group}`} disabled={busy} />
      ))}
      <div className="action-group">
        <button className="btn btn-primary" type="button" onClick={() => onDone({ extras: extras.join(",") })} disabled={busy}><Icon name="sparkle" />{busy ? "Preparing your routine…" : "See my routine"}</button>
        <button className="btn btn-quiet" type="button" onClick={() => onDone({})} disabled={busy}>Skip</button>
      </div>
    </div>
  );
}

export default function SkincareQuiz() {
  return <QuizRunner module="skincare" title="Skincare Quiz" intro="Ten quick questions about how your skin looks and feels, then optional routine extras. There are no wrong answers." questions={questions} resultPath="/analyses/skincare/result" FinalStep={RoutineExtras} />;
}
