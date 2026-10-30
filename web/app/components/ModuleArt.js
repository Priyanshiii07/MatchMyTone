import StyleArt from "./StyleArt";

const BRAND_PALETTE = ["#C2593F", "#E3A857", "#D67C73", "#6B705C", "#005F60", "#8C5E34"];
const HEX = /^#[0-9a-f]{6}$/i;
// Face and body cards show illustrated stickers that follow the user's styling, so nobody sees a default women's figure.
// [main sticker, main colour, small sticker, small colour]
const FACE_STICKERS = { menswear: ["hair-quiff", "#5B3A29", "frames-rect", "#B89018"], womenswear: ["hair-waves", "#6B3F2A", "frames-cateye", "#C2593F"], unisex: ["hair-shag", "#4A3426", "frames-round", "#B89018"] };
const BODY_STICKERS = { menswear: ["blazer", "#005F60", "loafer", "#8C5E34"], womenswear: ["dress", "#C98B8B", "heel", "#B89018"], unisex: ["denim-jacket", "#5B6C8F", "sneaker", "#6B705C"] };

function Swatches({ palette }) {
  const colors = (palette || []).map((color) => color?.hex).filter((hex) => HEX.test(String(hex))).slice(0, 6);
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      {(colors.length ? colors : BRAND_PALETTE).map((hex, index) => <rect key={`${hex}-${index}`} x="48" y="18" width="24" height="70" rx="12" fill={hex} stroke="#fff" strokeWidth="2" transform={`rotate(${-50 + index * 20} 60 96)`} />)}
      <circle cx="60" cy="96" r="5" fill="#2C2622" />
    </svg>
  );
}

function Routine() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <path d="M60 20s26 28 26 46a26 26 0 0 1-52 0c0-18 26-46 26-46Z" fill="#DFE4D0" stroke="#2C2622" strokeWidth="2" />
      <path d="M46 70a14 14 0 0 0 12 12" stroke="#4F5A3E" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="94" cy="30" r="9" fill="#F7E1A4" stroke="#2C2622" strokeWidth="2" />
      <path d="M28 26a9 9 0 1 0 8 13 7 7 0 0 1-8-13Z" fill="#E9DDF0" stroke="#2C2622" strokeWidth="2" />
    </svg>
  );
}

/** A main die-cut sticker with a smaller companion sticker tucked against it. */
function StickerPair({ set }) {
  const [main, mainColor, small, smallColor] = set;
  return (
    <span className="sticker-pair">
      <span className="sticker sticker-main"><StyleArt art={main} color={mainColor} /></span>
      <span className="sticker sticker-small"><StyleArt art={small} color={smallColor} /></span>
      <span className="sticker-dot" style={{ background: mainColor }} />
      <span className="sticker-dot sticker-dot-b" style={{ background: smallColor }} />
    </span>
  );
}

/** Distinct illustration for each analysis card: palette and routine motifs, and styled stickers for face and body. */
export default function ModuleArt({ module, catalog = "unisex", palette }) {
  const sets = module === "face" ? FACE_STICKERS : module === "body" ? BODY_STICKERS : null;
  const art = sets ? <StickerPair set={sets[catalog] || sets.unisex} /> : module === "color" ? <Swatches palette={palette} /> : <Routine />;
  return <span className={`module-art module-art-${module}`} aria-hidden="true">{art}</span>;
}
