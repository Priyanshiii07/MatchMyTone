const PIECES = ["#C2593F", "#E3A857", "#D67C73", "#6B705C", "#005F60", "#B89018", "#C98B8B", "#8C5E34", "#E2B08C", "#4A2C20", "#F4D5BF", "#9AA59A"];

/** A brief burst of falling swatches after a freshly completed analysis. Decorative; disabled by reduced motion. */
export default function Celebrate() {
  return (
    <div className="celebrate" aria-hidden="true">
      {PIECES.map((color, index) => <span key={color} style={{ background: color, "--x": `${(index * 8.3) % 100}%`, "--d": `${(index % 5) * 90}ms`, "--r": `${index * 37}deg` }} />)}
    </div>
  );
}
