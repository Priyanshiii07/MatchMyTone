import { useId } from "react";

// MatchMyTone emblem: a ring of six skin tones (deep to light) around two overlapping tones
// whose overlap is champagne gold — "the match". Mirrors /public/brand/*.svg.
export const SKIN_TONES = ["#4A2C20", "#7A4B32", "#A86B47", "#C98D66", "#E2B08C", "#F4D5BF"];
const RING = 2 * Math.PI * 40;

export function LogoMark({ size = 40, title, className = "" }) {
  const clipId = `mmt-${useId().replace(/:/g, "")}`;
  const a11y = title ? { role: "img", "aria-label": title } : { "aria-hidden": true };
  return (
    <svg className={`logo-mark ${className}`.trim()} width={size} height={size} viewBox="0 0 100 100" focusable="false" {...a11y}>
      <defs><clipPath id={clipId}><circle cx="43" cy="50" r="14" /></clipPath></defs>
      <circle cx="50" cy="50" r="48" fill="none" stroke="#B89018" strokeWidth="1.4" />
      {SKIN_TONES.map((tone, index) => (
        <circle key={tone} cx="50" cy="50" r="40" fill="none" stroke={tone} strokeWidth="10" strokeDasharray={`${RING / 6 - 2.4} ${RING}`} transform={`rotate(${index * 60 - 90} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="30" fill="#FFF8EC" />
      <circle cx="43" cy="50" r="14" fill="#8C5A3C" />
      <circle cx="57" cy="50" r="14" fill="#EBC2A2" />
      <circle cx="57" cy="50" r="14" fill="#C9A227" clipPath={`url(#${clipId})`} />
      <path d="M72 22c.5 3 1.8 4.3 4.8 4.8-3 .5-4.3 1.8-4.8 4.8-.5-3-1.8-4.3-4.8-4.8 3-.5 4.3-1.8 4.8-4.8Z" fill="#B89018" />
    </svg>
  );
}

/** Emblem + wordmark. `size` sets the emblem height; the wordmark scales with CSS. */
export default function Logo({ size = 40, className = "", showWordmark = true }) {
  return (
    <span className={`logo ${className}`.trim()}>
      <LogoMark size={size} title={showWordmark ? undefined : "MatchMyTone"} />
      {showWordmark && <span className="logo-wordmark">Match<span>My</span>Tone</span>}
    </span>
  );
}
