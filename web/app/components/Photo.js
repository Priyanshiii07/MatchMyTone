"use client";

import { useState } from "react";
import Icon from "./Icon";

const CATEGORY_ICONS = { hair: "scissors", eyewear: "glasses", skincare: "droplet", palette: "palette" };

/** Branded stand-in when an item has no photo or its image fails to load — never an unrelated picture. */
export function PhotoPlaceholder({ category, label }) {
  return (
    <span className="photo-placeholder" role={label ? "img" : undefined} aria-label={label ? `${label} (no photo available)` : undefined} aria-hidden={label ? undefined : true}>
      <Icon name={CATEGORY_ICONS[category] || "hanger"} />
      {label && <span>{label}</span>}
    </span>
  );
}

/**
 * A recommendation photo from /public/assets. `src` is the path inside /assets, e.g. "photos/m-kurta.jpg".
 * Licence attribution for these photos is listed on the /credits page (linked in the footer), not on the image.
 */
export default function Photo({ src, alt, category, className = "" }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <PhotoPlaceholder category={category} label={alt} />;
  return <img className={className} src={`/assets/${src}`} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
