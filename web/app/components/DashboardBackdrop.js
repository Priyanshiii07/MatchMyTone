import StyleArt from "./StyleArt";

const FAN = ["#C2593F", "#E3A857", "#D4AF60", "#A7AD91", "#005F60", "#C98B9B"];
const DOODLES = [
  { art: "dress", x: 3, y: 18, size: 92, tilt: -14 },
  { art: "frames-round", x: 88, y: 46, size: 86, tilt: 12 },
  { art: "sneaker", x: 6, y: 64, size: 84, tilt: 10 },
  { art: "earrings", x: 92, y: 8, size: 70, tilt: -8 },
  { art: "handbag", x: 90, y: 78, size: 78, tilt: -12 },
];

/** Decorative layer behind the dashboard: colour washes, a palette fan, faint sticker line art and sparkles. */
export default function DashboardBackdrop() {
  return (
    <div className="dashboard-backdrop" aria-hidden="true">
      <span className="backdrop-wash backdrop-wash-a" />
      <span className="backdrop-wash backdrop-wash-b" />
      <span className="backdrop-wash backdrop-wash-c" />
      <svg className="backdrop-fan" viewBox="0 0 200 200">
        {FAN.map((hex, index) => <rect key={hex} x="88" y="20" width="24" height="96" rx="12" fill={hex} transform={`rotate(${-62 + index * 25} 100 150)`} />)}
        <circle cx="100" cy="150" r="7" fill="#352820" />
      </svg>
      <svg className="backdrop-thread" viewBox="0 0 1200 400" preserveAspectRatio="none">
        <path d="M-20 300 C 180 120, 360 380, 600 210 S 980 60, 1220 170" />
      </svg>
      {DOODLES.map((doodle) => (
        <span key={doodle.art} className="backdrop-doodle" style={{ left: `${doodle.x}%`, top: `${doodle.y}%`, width: doodle.size, height: doodle.size, "--tilt": `${doodle.tilt}deg` }}>
          <StyleArt art={doodle.art} color="#E8B6AE" />
        </span>
      ))}
      {[[14, 10], [78, 30], [46, 6], [70, 88], [24, 92]].map(([x, y]) => (
        <svg key={`${x}-${y}`} className="backdrop-spark" style={{ left: `${x}%`, top: `${y}%` }} viewBox="0 0 24 24"><path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" /></svg>
      ))}
    </div>
  );
}
