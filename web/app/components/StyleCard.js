"use client";

import Icon from "./Icon";
import Photo from "./Photo";
import { useFavorites, useResultState } from "./useStyling";

const HEX = /^#[0-9a-f]{6}$/i;

/** One recommendation: picture, category, why it may suit, a fit tip, occasions, palette shades and a save toggle. */
export default function StyleCard({ card, categoryLabel, occasionLabels = {}, compact = false }) {
  const { ids, toggle, ready } = useFavorites();
  const note = useResultState().insights?.notes?.[card.id];
  const colors = (card.colors || []).filter((color) => HEX.test(String(color?.hex)));
  const saved = ids.has(card.id);
  return (
    <article className={`style-card ${compact ? "is-compact" : ""}`}>
      <div className="style-card-media">
        <Photo src={card.photo} alt={card.title} category={card.group || card.category} />
        <button type="button" className={`favorite-button ${saved ? "is-saved" : ""}`} aria-pressed={saved} aria-label={saved ? `Remove ${card.title} from saved styles` : `Save ${card.title}`} onClick={() => toggle(card.id)} disabled={!ready}>
          <Icon name="heart" size={18} />
        </button>
      </div>
      <div className="style-card-body">
        {categoryLabel && <p className="look-category">{categoryLabel}</p>}
        <h4>{card.title}</h4>
        <p>{card.why}</p>
        {note && <p className="ai-note"><Icon name="sparkle" size={14} />{note}</p>}
        {card.reasons?.length > 0 && <ul className="reason-list">{card.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
        {!compact && card.tip && <p className="style-tip"><strong>Tip:</strong> {card.tip}</p>}
        {!compact && card.occasions?.length > 0 && <p className="style-occasions">{card.occasions.map((occasion) => occasionLabels[occasion] || occasion).join(" · ")}</p>}
        {colors.length > 0 && (
          <p className="style-colors"><span>Your shades</span>{colors.map((color) => <span key={color.hex} className="mini-swatch" style={{ background: color.hex }} title={`${color.name} ${color.hex}`}><span className="sr-only">{color.name} {color.hex}</span></span>)}</p>
        )}
      </div>
    </article>
  );
}
