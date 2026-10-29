import Photo from "./Photo";

const BRAND_PALETTE = ["#C2593F", "#E3A857", "#D67C73", "#6B705C", "#005F60", "#8C5E34"];
const HEX = /^#[0-9a-f]{6}$/i;
// Face and body cards show a real photograph matching the user's styling, so nobody sees a default women's figure.
const BODY_PHOTO = { menswear: ["photos/card-body-m.jpg", "Man in a full-length traditional outfit"], womenswear: ["photos/card-body-w.jpg", "Woman in a full-length floral dress"], unisex: ["photos/card-body-u.jpg", "Person in a matching grey jacket and trousers"] };
const FACE_PHOTO = { menswear: ["photos/card-face-m.jpg", "Close-up portrait of a man's face"], womenswear: ["photos/card-face-w.jpg", "Close-up portrait of a woman's face"], unisex: ["photos/card-face-u.jpg", "Close-up portrait of a person in glasses"] };

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

/** Distinct visual for each analysis card: palette and routine motifs, and real photographs for face and body. */
export default function ModuleArt({ module, catalog = "unisex", palette }) {
  if (module === "face" || module === "body") {
    const [src, alt] = (module === "face" ? FACE_PHOTO : BODY_PHOTO)[catalog] || (module === "face" ? FACE_PHOTO : BODY_PHOTO).unisex;
    return <span className={`module-art module-art-${module} has-photo`}><span className="module-art-photo"><Photo src={src} alt={alt} category={module === "face" ? "hair" : "clothing"} /></span></span>;
  }
  return <span className={`module-art module-art-${module}`} aria-hidden="true">{module === "color" ? <Swatches palette={palette} /> : <Routine />}</span>;
}
