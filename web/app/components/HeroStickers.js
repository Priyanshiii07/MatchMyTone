import StyleArt from "./StyleArt";

// Hand-placed sticker moodboard for the home page hero. Positions are percentages of a square board, so the
// composition scales with the screen; motion is CSS-only and switched off for prefers-reduced-motion.
const STICKERS = [
  { art: "saree", color: "#C2593F", x: 36, y: 6, size: 34, tilt: -6, delay: 0 },
  { art: "blazer", color: "#005F60", x: 4, y: 30, size: 27, tilt: 8, delay: 0.12 },
  { art: "kurta-w", color: "#E3A857", x: 68, y: 26, size: 27, tilt: -9, delay: 0.24 },
  { art: "hair-waves", color: "#6B3F2A", x: 8, y: 66, size: 22, tilt: -10, delay: 0.36 },
  { art: "frames-cateye", color: "#B89018", x: 70, y: 64, size: 22, tilt: 12, delay: 0.48 },
  { art: "sneaker", color: "#6B705C", x: 40, y: 72, size: 21, tilt: 6, delay: 0.6 },
  { art: "handbag", color: "#D67C73", x: 74, y: 2, size: 18, tilt: 14, delay: 0.72 },
  { art: "earrings", color: "#B89018", x: 2, y: 4, size: 16, tilt: -12, delay: 0.84 },
];
const CHIPS = [
  { name: "Terracotta", hex: "#C2593F", x: 58, y: 47, tilt: 9 },
  { name: "Deep teal", hex: "#005F60", x: 27, y: 50, tilt: -7 },
];
const TAPES = [
  { label: "Festive", x: 42, y: 3, tilt: -4 },
  { label: "Office", x: 6, y: 27, tilt: 6 },
  { label: "Everyday", x: 72, y: 23, tilt: -8 },
];
const WHEEL = ["#C2593F", "#E3A857", "#D4AF60", "#A7AD91", "#6B705C", "#005F60", "#5B6C8F", "#C98B9B", "#E8B6AE", "#8C5E34"];

/** Decorative hero: die-cut fashion stickers, paint chips and a palette wheel (no photographs). */
export default function HeroStickers() {
  return (
    <div className="sticker-board" aria-hidden="true">
      <span className="board-glow board-glow-a" />
      <span className="board-glow board-glow-b" />
      <span className="board-wheel" style={{ background: `conic-gradient(${WHEEL.map((hex, index) => `${hex} ${index * 10}% ${(index + 1) * 10}%`).join(", ")})` }}>
        <span className="board-wheel-core"><strong>Your</strong>palette</span>
      </span>
      <svg className="board-doodle" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M14 46 C28 18, 52 22, 58 40 S 84 70, 90 38" />
        <path d="M20 88 C38 76, 62 96, 82 82" />
      </svg>
      {STICKERS.map((sticker, index) => (
        <span key={sticker.art} className="board-sticker" style={{ "--x": `${sticker.x}%`, "--y": `${sticker.y}%`, "--size": `${sticker.size}%`, "--tilt": `${sticker.tilt}deg`, "--delay": `${sticker.delay}s`, "--float": `${6 + (index % 3) * 1.5}s` }}>
          <StyleArt art={sticker.art} color={sticker.color} />
        </span>
      ))}
      {CHIPS.map((chip) => (
        <span key={chip.hex} className="board-chip" style={{ "--x": `${chip.x}%`, "--y": `${chip.y}%`, "--tilt": `${chip.tilt}deg` }}>
          <span style={{ background: chip.hex }} />
          <small>{chip.name}<b>{chip.hex}</b></small>
        </span>
      ))}
      {TAPES.map((tape) => <span key={tape.label} className="board-tape" style={{ "--x": `${tape.x}%`, "--y": `${tape.y}%`, "--tilt": `${tape.tilt}deg` }}>{tape.label}</span>)}
      <svg className="board-spark board-spark-a" viewBox="0 0 24 24"><path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" /></svg>
      <svg className="board-spark board-spark-b" viewBox="0 0 24 24"><path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" /></svg>
    </div>
  );
}
