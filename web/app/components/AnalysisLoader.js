"use client";

import { useEffect, useState } from "react";

export const LOADER_MESSAGES = {
  color: ["Your colors are being discovered…", "Finding the shades that suit you…", "Reading your undertone in the light…", "Putting your personal palette together…", "Almost ready — we're preparing your results."],
  skincare: ["Understanding your skin's needs…", "Matching care to your answers…", "Building your personalised routine…"],
  face: ["Reading your face-shape answers…", "Choosing styles that frame your features…", "Preparing your styling guide…"],
  body: ["Reading your proportions from your answers…", "Picking silhouettes to try…", "Preparing your outfit ideas…"],
  results: ["Opening your style journal…"],
};
const SWATCHES = ["#C2593F", "#E3A857", "#6B705C", "#005F60", "#B89018", "#D67C73"];

/** Indeterminate, friendly progress state. It never shows percentages, timings or provider details. */
export default function AnalysisLoader({ module = "color", title, interval = 3500 }) {
  const messages = LOADER_MESSAGES[module] || LOADER_MESSAGES.color;
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (messages.length < 2) return undefined;
    const timer = window.setInterval(() => setIndex((current) => Math.min(current + 1, messages.length - 1)), interval);
    return () => window.clearInterval(timer);
  }, [messages, interval]);
  return (
    <div className="analysis-loader" role="status" aria-live="polite" aria-busy="true">
      <div className="loader-swatches" aria-hidden="true">{SWATCHES.map((color, position) => <span key={color} style={{ background: color, animationDelay: `${position * 0.18}s` }} />)}</div>
      {title && <p className="loader-title">{title}</p>}
      <p className="loader-message" key={index}>{messages[index]}</p>
      <div className="loader-bar" aria-hidden="true"><span /></div>
    </div>
  );
}
