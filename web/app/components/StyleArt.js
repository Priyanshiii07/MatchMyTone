// Flat line-art illustrations used when a recommendation has no photo.
// Every drawing sits on a 120px grid, uses the same ink outline and takes a main color and an accent.
const INK = "#2C2622";
const SKIN = "#EFE4D6";
const LIGHT = "#F7F3EE";
const DEFAULT_COLOR = "#C9B79C";
const HAIR_COLOR = "#3B2F2A";
const HEX = /^#[0-9a-f]{6}$/i;
const SOFT = { strokeWidth: 1.5, strokeOpacity: 0.45 };
const STITCH = { strokeWidth: 1.2, strokeDasharray: "2 2.5", strokeOpacity: 0.6 };

function safeHex(value, fallback) {
  return typeof value === "string" && HEX.test(value) ? value : fallback;
}

// Moves each channel towards white (amount > 0) or black (amount < 0).
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  return `#${[16, 8, 0].map((s) => {
    const v = (n >> s) & 255;
    const out = Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount);
    return out.toString(16).padStart(2, "0");
  }).join("")}`;
}

function defaultAccent(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum < 0.35 ? shade(hex, 0.3) : shade(hex, -0.2);
}

// ---- shared shapes -------------------------------------------------------

const NECKS = {
  round: "M48 22 Q60 30 72 22",
  v: "M48 22 L60 42 L72 22",
  camp: "M48 22 L60 44 L72 22",
  cardi: "M48 22 L60 56 L72 22",
  deep: "M48 22 L60 64 L72 22",
};
const SHORT = " L86 27 L102 44 L91 55 L84 49 V100 H36 V49 L29 55 L18 44 L34 27 Z";
const LONG = " L86 27 Q96 40 104 94 L92 97 L84 52 V100 H36 V52 L28 97 L16 94 Q24 40 34 27 Z";
const top = (neck, long) => NECKS[neck] + (long ? LONG : SHORT);
const CUFFS = "M17 86 L29.4 89 M103 86 L90.6 89";
const SLEEVE_BANDS = "M20.8 41.1 L31.8 52.1 M99.2 41.1 L88.2 52.1";
const OPEN_NECK = (y) => `M48 22 Q60 28 72 22 L60 ${y} Z`;

const Mirror = ({ children }) => <g transform="matrix(-1 0 0 1 120 0)">{children}</g>;

const Buttons = ({ x = 60, ys, r = 1.5 }) => ys.map((y) => <circle key={y} cx={x} cy={y} r={r} fill={INK} stroke="none" />);

const ShirtCollar = ({ fill }) => (
  <>
    <path d="M48 22 Q60 16 72 22" />
    <path d="M48 22 L60 30 L50 36 L45 27 Z" fill={fill} />
    <path d="M72 22 L60 30 L70 36 L75 27 Z" fill={fill} />
  </>
);

const Lapels = ({ fill, y = 64 }) => (
  <>
    <path d="M48 22 Q60 17 72 22" />
    <path d={`M48 22 L60 ${y} L43 41 L46 37 L41 33 Z`} fill={fill} />
    <path d={`M72 22 L60 ${y} L77 41 L74 37 L79 33 Z`} fill={fill} />
  </>
);

const RibTicks = ({ x1, x2, y1, y2, step = 4 }) => {
  const ticks = [];
  for (let x = x1; x <= x2; x += step) ticks.push(`M${x} ${y1} V${y2}`);
  return <path d={ticks.join(" ")} fill="none" {...SOFT} />;
};

// ---- bust for hair and facial hair ---------------------------------------

const Bust = () => (
  <>
    <path d="M18 112 Q20 92 50 88 H70 Q100 92 102 112 Z" fill={SKIN} />
    <path d="M52 70 V89 H68 V70" fill={SKIN} />
    <ellipse cx="41" cy="54" rx="3.5" ry="6" fill={SKIN} />
    <ellipse cx="79" cy="54" rx="3.5" ry="6" fill={SKIN} />
    <ellipse cx="60" cy="52" rx="19" ry="24" fill={SKIN} />
  </>
);

const SHORT_HAIR = "M41 49 Q39 25 60 24 Q81 25 79 49 Q76 37 60 35 Q44 37 41 49 Z";

const curlPoints = (cx, cy, rx, ry, from, to, n) => Array.from({ length: n }, (_, i) => {
  const t = ((from + ((to - from) * i) / (n - 1)) * Math.PI) / 180;
  return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
});

const Curls = ({ points, r, fill }) => points.map(([x, y]) => (
  <circle key={`${x.toFixed(1)}-${y.toFixed(1)}`} cx={x} cy={y} r={r} fill={fill} />
));

const column = (x, y1, y2, step) => {
  const pts = [];
  for (let y = y1; y <= y2; y += step) pts.push([x, y]);
  return pts;
};



// ---- eyewear ---------------------------------------------------------------

const Rim = ({ d, c, width = 4 }) => (
  <>
    <path d={d} fill={c} fillOpacity="0.14" strokeWidth={width + 3} />
    <path d={d} fill="none" stroke={c} strokeWidth={width} />
  </>
);

const Pair = ({ children }) => <>{children}<Mirror>{children}</Mirror></>;

const TEMPLES = "M15 55 L8 52 M105 55 L112 52";

// ---- drawings -------------------------------------------------------------

const DRAWINGS = {
  // Tops
  tee: (c) => (
    <>
      <path d={top("round")} fill={c} />
      <path d="M45.5 23 Q60 36 74.5 23" fill="none" />
      <path d={SLEEVE_BANDS} fill="none" {...SOFT} />
      <path d="M38 95 H82" fill="none" {...STITCH} />
    </>
  ),
  "vneck-tee": (c) => (
    <>
      <path d={top("v")} fill={c} />
      <path d="M45 23 L60 47 L75 23" fill="none" />
      <path d={SLEEVE_BANDS} fill="none" {...SOFT} />
      <path d="M38 95 H82" fill="none" {...STITCH} />
    </>
  ),
  polo: (c, a) => (
    <>
      <path d={top("round")} fill={c} />
      <path d="M57 27 V46 H63 V27" fill="none" />
      <Buttons ys={[34, 41]} />
      <path d="M48 22 L43 30 L57 34 L60 28 Z" fill={a} />
      <path d="M72 22 L77 30 L63 34 L60 28 Z" fill={a} />
      <path d={SLEEVE_BANDS} fill="none" stroke={a} strokeWidth="3" />
      <path d={SLEEVE_BANDS} fill="none" {...SOFT} />
    </>
  ),
  shirt: (c) => (
    <>
      <path d={top("round", true)} fill={c} />
      <path d="M57 31 V100 M63 31 V100" fill="none" {...SOFT} />
      <Buttons ys={[42, 56, 70, 84]} />
      <path d="M67 44 H78 V55 L72.5 58 L67 55 Z" fill="none" {...SOFT} />
      <path d={CUFFS} fill="none" />
      <ShirtCollar fill={c} />
    </>
  ),
  "shirt-short": (c, a) => (
    <>
      <path d={top("camp")} fill={c} />
      <path d="M48 22 L60 44 L72 22 Q60 18 48 22 Z" fill={a} />
      <path d="M48 22 L40 28 L57 42 Z" fill={c} />
      <path d="M72 22 L80 28 L63 42 Z" fill={c} />
      <path d="M60 44 V100" fill="none" {...SOFT} />
      <Buttons ys={[56, 70, 84]} />
      <path d={SLEEVE_BANDS} fill="none" {...SOFT} />
    </>
  ),
  henley: (c) => (
    <>
      <path d={top("round", true)} fill={c} />
      <path d="M45.5 23 Q60 36 74.5 23" fill="none" />
      <path d="M57 29 V50 H63 V29" fill="none" />
      <Buttons ys={[35, 41, 47]} r={1.3} />
      <path d={CUFFS} fill="none" />
    </>
  ),
  knit: (c, a) => (
    <>
      <path d={top("round", true)} fill={c} />
      <path d="M44 22 Q60 38 76 22 L72 22 Q60 30 48 22 Z" fill={a} />
      <path d="M36.5 90 H83.5 V100 H36.5 Z" fill={a} />
      <RibTicks x1={39} x2={81} y1={91} y2={99} />
      <path d="M17 86 L29.4 89 L28 97 L16 94 Z M103 86 L90.6 89 L92 97 L104 94 Z" fill={a} />
      <path d="M48 36 Q45 48 48 60 Q51 72 48 86 M60 36 Q57 48 60 60 Q63 72 60 86 M72 36 Q69 48 72 60 Q75 72 72 86" fill="none" {...SOFT} />
    </>
  ),
  hoodie: (c, a) => (
    <>
      <path d="M45 27 Q42 6 60 6 Q78 6 75 27 Z" fill={a} />
      <path d={top("round", true)} fill={c} />
      <path d="M44 24 Q46 12 60 12 Q74 12 76 24 Q60 34 44 24 Z" fill={a} />
      <path d="M48 22 Q60 30 72 22" fill="none" />
      <path d="M56 28 V44 M64 28 V44" fill="none" />
      <path d="M45 70 H75 L79 90 H41 Z" fill="none" />
      <path d="M36 92 H84 M17 86 L29.4 89 M103 86 L90.6 89" fill="none" />
    </>
  ),
  blouse: (c, a) => (
    <>
      <path d="M48 22 Q60 34 72 22 L84 26 Q102 28 100 46 Q94 56 84 50 Q78 72 88 100 H32 Q42 72 36 50 Q26 56 20 46 Q18 28 36 26 Z" fill={c} />
      <path d="M84 50 Q90 44 91 36 M36 50 Q30 44 29 36" fill="none" {...SOFT} />
      <path d="M40 66 Q60 70 80 66" fill="none" {...SOFT} />
      <path d="M60 32 Q52 24 51 32 Q52 38 60 32 Q68 24 69 32 Q68 38 60 32 Z" fill={a} />
      <path d="M59 33 L55 46 M61 33 L65 46" fill="none" />
    </>
  ),
  overshirt: (c, a) => (
    <>
      <path d={top("round", true)} fill={c} />
      <path d="M57 31 V100 M63 31 V100" fill="none" {...SOFT} />
      <Buttons ys={[44, 58, 72, 86]} r={1.8} />
      <path d="M40 44 H53 V60 H40 Z M67 44 H80 V60 H67 Z" fill={a} />
      <path d="M40 49 H53 M67 49 H80" fill="none" />
      <path d="M39 46 H54 M66 46 H81" fill="none" {...STITCH} />
      <path d={CUFFS} fill="none" />
      <path d="M38 94 H82" fill="none" {...STITCH} />
      <ShirtCollar fill={c} />
    </>
  ),

  // Bottoms
  jeans: (c, a) => (
    <>
      <path d="M34 14 H86 L90 106 H66 L60 44 L54 106 H30 Z" fill={c} />
      <path d="M33.7 22 H86.3" fill="none" />
      <path d="M60 22 V40 Q60 44 64 42" fill="none" />
      <path d="M36 22 Q46 24 46 33 M84 22 Q74 24 74 33" fill="none" />
      <path d="M38 22 Q48 25 48 35 M82 22 Q72 25 72 35 M63 22 V38 M32.2 98 H55 M65 98 H88" fill="none" stroke={a} {...STITCH} />
      <path d="M42 14 V22 M78 14 V22" fill="none" />
      <circle cx="60" cy="18" r="1.6" fill={INK} stroke="none" />
    </>
  ),
  trousers: (c) => (
    <>
      <path d="M35 14 H85 L88 106 H66 L60 42 L54 106 H32 Z" fill={c} />
      <path d="M34.7 22 H85.3" fill="none" />
      <path d="M60 22 V38" fill="none" />
      <path d="M38 22 L44 34 M82 22 L76 34" fill="none" />
      <path d="M46 24 L43 104 M74 24 L77 104" fill="none" {...SOFT} />
    </>
  ),
  "wide-trousers": (c) => (
    <>
      <path d="M38 14 H82 L98 106 H64 L60 48 L56 106 H22 Z" fill={c} />
      <path d="M36.6 22 H83.4" fill="none" />
      <path d="M60 22 V40" fill="none" />
      <path d="M46 22 L42 104 M52 22 L50 40 M74 22 L78 104 M68 22 L70 40" fill="none" {...SOFT} />
    </>
  ),
  "flared-trousers": (c) => (
    <>
      <path d="M37 14 H83 L80 72 L94 106 H66 L63 72 L60 44 L57 72 L54 106 H26 L40 72 Z" fill={c} />
      <path d="M36.6 22 H83.4" fill="none" />
      <path d="M60 22 V38" fill="none" />
      <path d="M48 24 L48 72 L40 104 M72 24 L72 72 L80 104" fill="none" {...SOFT} />
    </>
  ),
  cargo: (c, a) => (
    <>
      <path d="M34 14 H86 L88 104 H66 L60 42 L54 104 H32 Z" fill={c} />
      <path d="M33.7 22 H86.3" fill="none" />
      <path d="M60 22 V38" fill="none" />
      <path d="M35 54 H47 V72 H35 Z M73 54 H85 V72 H73 Z" fill={a} />
      <path d="M35 59 H47 M73 59 H85" fill="none" />
      <Buttons x={41} ys={[62]} r={1.2} />
      <Buttons x={79} ys={[62]} r={1.2} />
      <path d="M33 96 H54.7 M65.3 96 H87.5" fill="none" {...SOFT} />
    </>
  ),
  shorts: (c) => (
    <>
      <path d="M32 30 H88 L95 86 H64 L60 58 L56 86 H25 Z" fill={c} />
      <path d="M31 38 H89" fill="none" />
      <path d="M60 38 V54" fill="none" />
      <path d="M35 38 Q44 40 44 48 M85 38 Q76 40 76 48" fill="none" />
      <path d="M25.6 80 H56.6 M63.4 80 H94.3" fill="none" {...SOFT} />
    </>
  ),
  skirt: (c, a) => (
    <>
      <path d="M42 29 H78 L96 98 Q60 104 24 98 Z" fill={c} />
      <path d="M42 20 H78 V29 H42 Z" fill={a} />
      <circle cx="73" cy="24.5" r="1.5" fill={INK} stroke="none" />
      <path d="M52 30 Q48 64 40 100 M68 30 Q72 64 80 100" fill="none" {...SOFT} />
    </>
  ),
  "pleated-skirt": (c, a) => (
    <>
      <path d="M42 29 H78 L96 98 L90 101 L84 98 L78 101 L72 98 L66 101 L60 98 L54 101 L48 98 L42 101 L36 98 L30 101 L24 98 Z" fill={c} />
      <path d="M42 20 H78 V29 H42 Z" fill={a} />
      <path d="M48 29 L36 98 M54 29 L48 98 M60 29 L60 98 M66 29 L72 98 M72 29 L84 98" fill="none" {...SOFT} />
    </>
  ),

  // One-pieces
  dress: (c) => (
    <>
      <path d="M48 12 L52 14 Q54 26 60 26 Q66 26 68 14 L72 12 L76 18 Q72 30 74 42 L72 50 L96 104 Q60 110 24 104 L48 50 L46 42 Q48 30 44 18 Z" fill={c} />
      <path d="M48 50 Q60 54 72 50" fill="none" />
      <path d="M54 52 L44 106 M66 52 L76 106" fill="none" {...SOFT} />
    </>
  ),
  jumpsuit: (c, a) => (
    <>
      <path d="M47 12 L52 12 Q56 24 60 24 Q64 24 68 12 L73 12 L77 20 Q74 34 75 48 L88 106 H65 L60 64 L55 106 H32 L45 48 Q46 34 43 20 Z" fill={c} />
      <path d="M45.5 45 H74.5 V51 H45.5 Z" fill={a} />
      <path d="M52 52 L44 104 M68 52 L76 104" fill="none" {...SOFT} />
    </>
  ),
  coord: (c, a) => (
    <>
      <path d="M24 26 Q33 32 42 26 L50 29 L58 41 L52 46 L49 42 V74 H17 V42 L14 46 L8 41 L16 29 Z" fill={c} />
      <path d="M22.5 27 Q33 37 43.5 27" fill="none" />
      <path d="M68 22 H106 L109 106 H91 L87 50 L83 106 H65 Z" fill={c} />
      <path d="M67.7 30 H106.3" fill="none" />
      <path d="M68 22 H106 V30 H67.7 Z" fill={a} />
      <path d="M76 32 L74 104 M98 32 L100 104" fill="none" {...SOFT} />
    </>
  ),

  // Outerwear
  bomber: (c, a) => (
    <>
      <path d={top("round", true)} fill={c} />
      <path d="M45 21 Q60 35 75 21 L72 22 Q60 30 48 22 Z" fill={a} />
      <path d="M36.5 90 H83.5 V100 H36.5 Z" fill={a} />
      <RibTicks x1={39} x2={81} y1={91} y2={99} />
      <path d="M17 86 L29.4 89 L28 97 L16 94 Z M103 86 L90.6 89 L92 97 L104 94 Z" fill={a} />
      <path d="M60 28 V100" fill="none" />
      <path d="M42 62 L46 76 M78 62 L74 76" fill="none" />
      <path d="M90 44 H98 V52 H90 Z" fill="none" {...SOFT} />
    </>
  ),
  "denim-jacket": (c, a) => (
    <>
      <path d={top("round", true)} fill={c} />
      <path d="M36.5 88 H83.5 V100 H36.5 Z" fill={c} />
      <path d="M57 31 V100 M63 31 V100" fill="none" {...SOFT} />
      <Buttons ys={[44, 60, 76, 94]} r={1.8} />
      <path d="M40 46 H53 V50 L46.5 54 L40 50 Z M67 46 H80 V50 L73.5 54 L67 50 Z" fill={a} />
      <path d="M42 56 V88 M78 56 V88 M38 92 H55 M65 92 H82" fill="none" stroke={a} {...STITCH} />
      <path d={CUFFS} fill="none" />
      <ShirtCollar fill={a} />
    </>
  ),
  blazer: (c, a) => (
    <>
      <path d={OPEN_NECK(64)} fill={LIGHT} />
      <path d={top("deep", true)} fill={c} />
      <path d="M60 64 V100" fill="none" />
      <Buttons x={62} ys={[70, 82]} r={1.8} />
      <path d="M40 80 H52 M68 80 H80 M69 48 H79" fill="none" />
      <path d={CUFFS} fill="none" {...SOFT} />
      <Lapels fill={a} />
    </>
  ),
  suit: (c, a) => (
    <>
      <path d={OPEN_NECK(64)} fill={LIGHT} />
      <path d="M57.5 27 H62.5 L63 31 L61.5 58 L60 61 L58.5 58 L57 31 Z" fill={a} />
      <path d="M57 31 H63" fill="none" />
      <path d={top("deep", true)} fill={c} />
      <path d="M60 64 V100" fill="none" />
      <Buttons x={62} ys={[70]} r={1.8} />
      <path d="M40 80 H52 M68 80 H80" fill="none" />
      <path d="M69 48 L71.5 44 L73.5 47 L75.5 43 L78 48 Z" fill={LIGHT} />
      <path d="M69 48 H79" fill="none" />
      <path d={CUFFS} fill="none" {...SOFT} />
      <Lapels fill={c} />
    </>
  ),
  coat: (c, a) => (
    <>
      <path d="M48 16 Q60 22 72 16 L60 52 Z" fill={LIGHT} />
      <path d="M48 16 L60 52 L72 16 L86 21 Q96 36 102 88 L90 90 L84 48 L90 110 H30 L36 48 L30 90 L18 88 Q24 36 34 21 Z" fill={c} />
      <path d="M60 52 V110" fill="none" />
      <path d="M48 16 L60 52 L42 36 L45 32 L40 28 Z M72 16 L60 52 L78 36 L75 32 L80 28 Z" fill={a} />
      <path d="M34.6 66 H85.4 V73 H34.1 Z" fill={a} />
      <path d="M56 64 H64 V75 H56 Z" fill="none" />
      <Buttons x={53} ys={[58, 82, 94]} r={1.8} />
      <Buttons x={67} ys={[58, 82, 94]} r={1.8} />
      <path d="M19.5 80 L30.8 82.5 M100.5 80 L89.2 82.5" fill="none" {...SOFT} />
    </>
  ),
  cardigan: (c, a) => (
    <>
      <path d={OPEN_NECK(56)} fill={LIGHT} />
      <path d={top("cardi", true)} fill={c} />
      <path d="M48 22 L60 56 M72 22 L60 56 M60 56 V100" fill="none" strokeWidth="3.5" stroke={a} />
      <path d="M48 22 L60 56 L72 22 M60 56 V100" fill="none" />
      <Buttons x={63} ys={[62, 72, 82, 92]} r={1.8} />
      <path d="M36.5 92 H83.5" fill="none" />
      <RibTicks x1={40} x2={80} y1={93} y2={99} />
      <path d="M42 70 H54 V82 H42 Z M66 70 H78 V82 H66 Z" fill="none" {...SOFT} />
      <path d={CUFFS} fill="none" />
    </>
  ),

  // Traditional
  kurta: (c, a) => (
    <>
      <path d="M48 16 Q60 20 72 16 L86 21 Q95 36 100 80 L89 82 L84 46 L86 108 H34 L36 46 L31 82 L20 80 Q25 36 34 21 Z" fill={c} />
      <path d="M49 12 Q60 16 71 12 V17 Q60 21 49 17 Z" fill={a} />
      <path d="M57.5 19 V48 H62.5 V19" fill="none" />
      <Buttons ys={[25, 32, 39]} r={1.3} />
      <path d="M35.2 96 L37 108 M84.8 96 L83 108" fill="none" />
      <path d="M36 103 H84" fill="none" stroke={a} {...STITCH} />
      <path d="M21 72 L31.8 74 M99 72 L88.2 74" fill="none" {...SOFT} />
    </>
  ),
  "kurta-set": (c, a) => (
    <>
      <path d="M45 70 H75 L71 112 H62 L60 86 L58 112 H49 Z" fill={a} />
      <path d="M49 8 Q60 12 71 8 L83 12 Q91 26 95 62 L85 64 L81 34 L83 88 H37 L39 34 L35 64 L25 62 Q29 26 37 12 Z" fill={c} />
      <path d="M50 5 Q60 9 70 5 V9 Q60 13 50 9 Z" fill={a} />
      <path d="M58 11 V34 H62 V11" fill="none" />
      <Buttons ys={[17, 23, 29]} r={1.2} />
      <path d="M37.4 78 L39 88 M82.6 78 L81 88" fill="none" />
      <path d="M38 84 H82" fill="none" stroke={a} {...STITCH} />
    </>
  ),
  "kurta-w": (c, a) => (
    <>
      <path d="M50 16 Q60 26 70 16 L82 20 Q91 34 95 64 L85 66 L79 42 Q84 76 98 108 H22 Q36 76 41 42 L35 66 L25 64 Q29 34 38 20 Z" fill={c} />
      <path d="M50 16 Q60 26 70 16" fill="none" />
      <path d="M60 24 V34" fill="none" />
      <path d="M44 30 Q60 42 76 30" fill="none" stroke={a} {...STITCH} strokeWidth="2" />
      <path d="M24 102 Q60 106 96 102" fill="none" stroke={a} {...STITCH} strokeWidth="2" />
      <path d="M52 44 Q46 76 36 106 M68 44 Q74 76 84 106" fill="none" {...SOFT} />
    </>
  ),
  "nehru-jacket": (c, a) => (
    <>
      <path d="M50 16 Q60 19 70 16 L82 20 Q78 36 84 50 L86 96 Q74 100 62 98 L60 94 L58 98 Q46 100 34 96 L36 50 Q42 36 38 20 Z" fill={c} />
      <path d="M50 11 Q60 14 70 11 V16 Q60 19 50 16 Z" fill={a} />
      <path d="M60 18 V94" fill="none" />
      <Buttons x={63} ys={[26, 38, 50, 62, 74, 86]} r={1.6} />
      <path d="M40 72 L51 70 M80 72 L69 70 M68 44 L78 42" fill="none" />
    </>
  ),
  sherwani: (c, a) => (
    <>
      <path d="M48 16 Q60 20 72 16 L88 22 Q96 40 100 86 L89 88 L84 48 L86 110 H34 L36 48 L31 88 L20 86 Q24 40 32 22 Z" fill={c} />
      <path d="M34.3 103 H85.7 V110 H34 Z" fill={a} />
      <path d="M48 11 Q60 15 72 11 V17 Q60 21 48 17 Z" fill={a} />
      <path d="M60 20 V103" fill="none" />
      <Buttons x={62.5} ys={[25, 34, 43, 52, 61, 70, 79, 88]} r={1.4} />
      <path d="M19.3 78 L30.8 80 L31 88 L20 86 Z M100.7 78 L89.2 80 L89 88 L100 86 Z" fill={a} />
      <path d="M44 22 Q60 30 76 22" fill="none" stroke={a} {...STITCH} strokeWidth="2" />
    </>
  ),
  "indo-western": (c, a) => (
    <>
      <path d="M48 18 Q60 22 72 18 L86 23 Q95 38 100 84 L89 86 L84 48 L86 94 L34 110 L36 48 L31 86 L20 84 Q25 38 34 23 Z" fill={c} />
      <path d="M49 13 Q60 17 71 13 V18 Q60 22 49 18 Z" fill={a} />
      <path d="M66 20 Q64 60 46 106" fill="none" />
      <path d="M66 20 Q64 60 46 106" fill="none" stroke={a} strokeWidth="1.5" strokeDasharray="2 2.5" transform="translate(-3 0)" />
      <Buttons x={69} ys={[28, 38, 48]} r={1.5} />
      <Buttons x={66} ys={[60, 70]} r={1.5} />
    </>
  ),
  saree: (c, a) => (
    <>
      <path d="M43 18 Q60 26 77 18 L80 22 L78 44 H42 L40 22 Z" fill={a} />
      <path d="M40 54 Q60 50 80 54 L88 108 H32 Z" fill={c} />
      <path d="M56 58 L52 108 M60 58 L58 108 M64 58 L64 108 M68 58 L70 108" fill="none" {...SOFT} />
      <path d="M33 102 H87" fill="none" stroke={a} strokeWidth="3" />
      <path d="M40 16 L28 24 L26 88 L38 84 L42 30 Z" fill={c} />
      <path d="M40 16 L50 14 L84 54 L74 60 Z" fill={c} />
      <path d="M48 17 L80 55 M28.5 80 L37.6 77" fill="none" stroke={a} strokeWidth="2.5" />
      <path d="M40 16 L50 14 L84 54 L74 60 Z M40 16 L28 24 L26 88 L38 84 L42 30" fill="none" />
    </>
  ),
  lehenga: (c, a) => (
    <>
      <path d="M44 46 Q60 42 76 46 Q96 78 106 104 Q60 114 14 104 Q24 78 44 46 Z" fill={c} />
      <path d="M15.6 99 Q60 109 104.4 99 L106 104 Q60 114 14 104 Z" fill={a} />
      <path d="M44 46 Q60 42 76 46 L77 52 Q60 48 43 52 Z" fill={a} />
      <path d="M52 50 L42 106 M60 49 V110 M68 50 L78 106 M47 51 L28 104 M73 51 L92 104" fill="none" {...SOFT} />
      <path d="M46 16 Q60 24 74 16 L82 19 L90 30 L82 35 L78 30 V38 Q60 41 42 38 V30 L38 35 L30 30 L38 19 Z" fill={a} />
      <path d="M46 16 Q60 24 74 16" fill="none" />
    </>
  ),

  // Footwear
  sneaker: (c, a) => (
    <>
      <path d="M16 80 L17 52 Q18 46 26 47 L40 50 Q47 45 53 50 L66 60 Q86 63 100 68 Q108 72 106 80 Z" fill={c} />
      <path d="M12 80 H108 Q108 90 100 90 H18 Q12 90 12 84 Z" fill={LIGHT} />
      <path d="M12 84 H108" fill="none" {...SOFT} />
      <path d="M44 52 L50 58 M49 51 L55 57 M54 54 L58 59" fill="none" />
      <path d="M30 72 Q56 64 80 74" fill="none" stroke={a} strokeWidth="3" />
      <path d="M86 64 Q90 72 88 80" fill="none" {...SOFT} />
      <path d="M17 52 L26 54 L25 80" fill="none" {...SOFT} />
    </>
  ),
  loafer: (c, a) => (
    <>
      <path d="M12 82 H108 V88 H12 Z" fill={a} />
      <path d="M14 82 L15 66 Q16 60 26 62 L50 64 Q60 56 76 60 Q100 64 106 76 Q108 82 102 82 Z" fill={c} />
      <path d="M50 64 Q64 72 82 61" fill="none" />
      <path d="M60 67 Q66 70 72 66" fill="none" strokeWidth="3" stroke={a} />
      <path d="M12 88 H36 V92 H12 Z" fill={a} />
    </>
  ),
  derby: (c, a) => (
    <>
      <path d="M12 80 H108 V86 H12 Z" fill={a} />
      <path d="M12 86 H34 V91 H12 Z" fill={a} />
      <path d="M15 80 L16 56 Q18 50 26 52 L46 56 Q56 50 64 56 Q90 62 104 70 Q110 76 106 80 Z" fill={c} />
      <path d="M44 56 Q56 70 70 62" fill="none" />
      <path d="M50 56 L56 52 M54 60 L60 55 M59 63 L64 58" fill="none" />
      <path d="M16 74 H104" fill="none" {...STITCH} />
      <path d="M84 64 Q90 72 88 80" fill="none" {...SOFT} />
    </>
  ),
  boot: (c, a) => (
    <>
      <path d="M20 84 H108 V92 H20 Z" fill={a} />
      <path d="M22 18 H52 L54 62 Q80 64 98 70 Q108 74 106 84 H22 Z" fill={c} />
      <path d="M22 26 H52" fill="none" {...SOFT} />
      <path d="M46 30 H54 M46 38 H54 M46 46 H54 M46 54 H54" fill="none" />
      <path d="M50 26 V62" fill="none" {...SOFT} />
      <path d="M82 66 Q88 74 86 84" fill="none" {...SOFT} />
      <path d="M20 92 H44 V96 H20 Z" fill={a} />
    </>
  ),
  sandal: (c, a) => (
    <>
      <path d="M14 82 Q14 76 22 76 H100 Q110 76 108 84 Q106 88 98 88 H22 Q14 88 14 82 Z" fill={a} />
      <path d="M62 76 Q70 54 90 58 Q100 62 98 76 L90 76 Q90 66 82 66 Q72 66 70 76 Z" fill={c} />
      <path d="M24 76 Q24 52 36 50 Q46 50 50 60 L54 76 L48 76 L44 62 Q40 56 34 58 Q30 62 30 76 Z" fill={c} />
      <path d="M44 62 L64 70 L62 76" fill="none" stroke={c} strokeWidth="5" />
      <path d="M44 62 L64 70" fill="none" />
      <circle cx="36" cy="54" r="2" fill={LIGHT} />
    </>
  ),
  heel: (c, a) => (
    <>
      <path d="M26 62 L35 68 L31 98 H27 Z" fill={a} />
      <path d="M22 40 Q30 62 60 72 Q90 78 104 90 Q106 96 98 96 H82 Q56 90 34 70 L24 62 Q20 50 22 40 Z" fill={c} />
      <path d="M22 40 Q34 52 54 60 Q64 62 70 72" fill="none" {...SOFT} />
      <path d="M82 96 Q60 92 36 72" fill="none" {...SOFT} />
    </>
  ),
  flat: (c, a) => (
    <>
      <path d="M14 76 Q16 64 30 66 Q50 70 70 66 Q96 64 106 76 Q108 84 100 84 H20 Q14 84 14 76 Z" fill={c} />
      <path d="M28 66 Q50 76 72 66 Q50 61 28 66 Z" fill={a} />
      <path d="M14 80 H107" fill="none" {...SOFT} />
      <path d="M76 66 Q70 58 72 66 Q70 74 76 68 Q82 74 80 66 Q82 58 76 66 Z" fill={a} />
    </>
  ),

  // Accessories
  watch: (c, a) => (
    <>
      <path d="M50 10 H70 V110 H50 Z" fill={a} />
      <path d="M50 22 H70 M50 98 H70" fill="none" {...SOFT} />
      <path d="M82 56 H86 V64 H82 Z" fill={c} />
      <circle cx="60" cy="60" r="22" fill={c} />
      <circle cx="60" cy="60" r="16" fill={LIGHT} />
      <path d="M60 46 V49 M74 60 H71 M60 74 V71 M46 60 H49" fill="none" {...SOFT} />
      <path d="M60 60 V50 M60 60 L67 64" fill="none" />
    </>
  ),
  belt: (c, a) => (
    <>
      <path d="M10 52 H82 V68 H10 Z" fill={c} />
      <path d="M96 52 H108 L112 60 L108 68 H96 Z" fill={c} />
      <path d="M12 55 H80 M12 65 H80" fill="none" {...STITCH} />
      <circle cx="102" cy="60" r="1.6" fill={INK} stroke="none" />
      <rect x="80" y="46" width="18" height="28" rx="4" fill="none" stroke={INK} strokeWidth="6" />
      <rect x="80" y="46" width="18" height="28" rx="4" fill="none" stroke={a} strokeWidth="3" />
      <path d="M80 60 H94" fill="none" strokeWidth="2.5" />
    </>
  ),
  tie: (c, a) => (
    <>
      <path d="M58 28 H62 L74 92 L60 106 L46 92 Z" fill={c} />
      <path d="M55 58 L64 49 M52 74 L66 61 M50 90 L68 74" fill="none" stroke={a} strokeWidth="3" />
      <path d="M58 28 H62 L74 92 L60 106 L46 92 Z" fill="none" />
      <path d="M53 12 H67 L68 21 L62 29 H58 L52 21 Z" fill={c} />
      <path d="M44 10 L53 12 M76 10 L67 12" fill="none" {...SOFT} />
    </>
  ),
  backpack: (c, a) => (
    <>
      <path d="M50 26 Q50 12 60 12 Q70 12 70 26" fill="none" strokeWidth="3" />
      <rect x="30" y="24" width="60" height="82" rx="16" fill={c} />
      <path d="M36 46 Q60 34 84 46" fill="none" />
      <rect x="38" y="64" width="44" height="34" rx="8" fill={a} />
      <path d="M44 72 H76" fill="none" {...SOFT} />
      <path d="M76 72 V80" fill="none" />
      <path d="M30 40 Q22 64 30 94 M90 40 Q98 64 90 94" fill="none" {...SOFT} />
    </>
  ),
  handbag: (c, a) => (
    <>
      <path d="M38 50 Q38 18 60 18 Q82 18 82 50 H76 Q76 24 60 24 Q44 24 44 50 Z" fill={a} />
      <path d="M26 50 H94 L102 100 Q102 104 98 104 H22 Q18 104 18 100 Z" fill={c} />
      <path d="M26 50 H94 L92 70 Q60 80 28 70 Z" fill={a} />
      <rect x="56" y="70" width="8" height="8" rx="2" fill={LIGHT} />
      <path d="M22 96 H98" fill="none" {...STITCH} />
    </>
  ),
  scarf: (c, a) => (
    <>
      <path d="M46 48 L40 98 L54 101 L58 52 Z" fill={c} />
      <path d="M64 52 L70 96 L83 92 L74 46 Z" fill={c} />
      <path d="M42 84 L55 87 M69 82 L81 79" fill="none" stroke={a} strokeWidth="3" />
      <path d="M41 98 L40 106 M45 99 L44 107 M49 100 L49 108 M53 101 L53 108 M71 96 L72 104 M75 95 L77 103 M79 94 L81 102" fill="none" />
      <path d="M32 26 Q60 44 88 26 Q92 40 80 50 Q60 60 40 50 Q28 40 32 26 Z" fill={c} />
      <path d="M36 34 Q60 50 84 34" fill="none" {...SOFT} />
      <path d="M33.5 42 Q60 56 86.5 42" fill="none" stroke={a} strokeWidth="3" />
    </>
  ),
  earrings: (c, a) => (
    <Pair>
      <path d="M38 22 Q38 16 42 18" fill="none" />
      <circle cx="38" cy="28" r="4" fill={c} />
      <path d="M38 32 V44" fill="none" />
      <path d="M38 44 Q49 62 38 76 Q27 62 38 44 Z" fill={c} />
      <circle cx="38" cy="64" r="4" fill={a} />
    </Pair>
  ),
  necklace: (c, a) => (
    <>
      <path d="M24 18 Q24 72 60 80 Q96 72 96 18" fill="none" />
      <Curls points={curlPoints(60, 18, 36, 62, 30, 150, 9).filter(([, y]) => y < 74)} r={1.8} fill={c} />
      <circle cx="60" cy="82" r="3" fill="none" />
      <path d="M60 85 Q71 94 60 106 Q49 94 60 85 Z" fill={c} />
      <circle cx="60" cy="96" r="3" fill={a} />
    </>
  ),
  bracelet: (c, a) => (
    <>
      <path d="M24 62 a36 22 0 1 0 72 0 a36 22 0 1 0 -72 0 Z M34 58 a26 13 0 1 0 52 0 a26 13 0 1 0 -52 0 Z" fill={c} fillRule="evenodd" />
      <circle cx="44" cy="79" r="3.5" fill={a} />
      <circle cx="60" cy="83" r="3.5" fill={a} />
      <circle cx="76" cy="79" r="3.5" fill={a} />
    </>
  ),
  cap: (c, a) => (
    <>
      <path d="M84 70 Q102 70 110 82 Q98 88 82 78 Z" fill={a} />
      <path d="M14 78 Q14 36 52 34 Q84 34 88 72 V78 Z" fill={c} />
      <path d="M52 34 Q42 52 42 78 M52 34 Q66 50 68 77" fill="none" {...SOFT} />
      <path d="M14 78 H88" fill="none" />
      <circle cx="52" cy="33" r="3" fill={a} />
      <circle cx="30" cy="54" r="1.5" fill={INK} stroke="none" />
    </>
  ),
  hairclip: (c, a) => {
    const upper = [32, 44, 56, 68, 80];
    return (
      <>
        {upper.map((x) => <path key={`l${x}`} d={`M${x + 2} 60 V82 Q${x + 6} 90 ${x + 10} 82 V60`} fill={a} />)}
        {upper.map((x) => <path key={`u${x}`} d={`M${x - 4} 58 V36 Q${x} 28 ${x + 4} 36 V58`} fill={c} />)}
        <rect x="22" y="52" width="76" height="12" rx="6" fill={c} />
        <path d="M30 58 H90" fill="none" {...SOFT} />
      </>
    );
  },

  // Eyewear
  "frames-round": (c) => (
    <>
      <path d={TEMPLES} fill="none" />
      <Pair><Rim c={c} d="M17 60 a19 19 0 1 0 38 0 a19 19 0 1 0 -38 0 Z" /></Pair>
      <path d="M55 57 Q60 52 65 57" fill="none" stroke={INK} strokeWidth="5" />
      <path d="M55 57 Q60 52 65 57" fill="none" stroke={c} strokeWidth="2.5" />
    </>
  ),
  "frames-rect": (c) => (
    <>
      <path d={TEMPLES} fill="none" />
      <Pair><Rim c={c} d="M19 48 H51 Q55 48 55 52 V68 Q55 72 51 72 H19 Q15 72 15 68 V52 Q15 48 19 48 Z" /></Pair>
      <path d="M55 55 Q60 51 65 55" fill="none" stroke={INK} strokeWidth="5" />
      <path d="M55 55 Q60 51 65 55" fill="none" stroke={c} strokeWidth="2.5" />
    </>
  ),
  "frames-aviator": (c) => (
    <>
      <path d={TEMPLES} fill="none" />
      <Pair><Rim c={c} width={2.5} d="M16 48 Q16 44 24 44 H50 Q56 44 55 52 Q53 72 38 78 Q20 80 16 60 Z" /></Pair>
      <path d="M50 44 Q60 40 70 44 M55 52 Q60 48 65 52" fill="none" stroke={INK} strokeWidth="4.5" />
      <path d="M50 44 Q60 40 70 44 M55 52 Q60 48 65 52" fill="none" stroke={c} strokeWidth="2" />
    </>
  ),
  "frames-browline": (c) => (
    <>
      <path d={TEMPLES} fill="none" />
      <Pair>
        <path d="M16 52 Q16 46 24 46 H48 Q56 46 55 54 Q54 72 36 74 Q18 74 16 58 Z" fill={c} fillOpacity="0.14" />
        <path d="M16 52 Q16 46 24 46 H48 Q56 46 55 54" fill="none" strokeWidth="10" />
        <path d="M16 52 Q16 46 24 46 H48 Q56 46 55 54" fill="none" stroke={c} strokeWidth="7" />
        <circle cx="21" cy="50" r="1.3" fill={LIGHT} stroke="none" />
      </Pair>
      <path d="M55 52 Q60 48 65 52" fill="none" strokeWidth="2.5" />
    </>
  ),
  "frames-square": (c) => (
    <>
      <path d={TEMPLES} fill="none" />
      <Pair><Rim c={c} width={6} d="M22 42 H48 Q56 42 56 50 V70 Q56 78 48 78 H22 Q14 78 14 70 V50 Q14 42 22 42 Z" /></Pair>
      <path d="M56 54 H64" fill="none" stroke={INK} strokeWidth="7" />
      <path d="M56 54 H64" fill="none" stroke={c} strokeWidth="4" />
    </>
  ),
  "frames-cateye": (c) => (
    <>
      <path d="M14 50 L8 50 M106 50 L112 50" fill="none" />
      <Pair><Rim c={c} d="M12 42 Q30 46 49 49 Q57 51 55 60 Q52 74 36 74 Q20 74 18 60 Q16 50 12 42 Z" /></Pair>
      <path d="M55 55 Q60 51 65 55" fill="none" stroke={INK} strokeWidth="5" />
      <path d="M55 55 Q60 51 65 55" fill="none" stroke={c} strokeWidth="2.5" />
    </>
  ),
  "frames-rimless": (c) => (
    <>
      <Pair>
        <path d="M22 48 H48 Q55 48 55 55 V64 Q55 74 44 74 H26 Q16 74 16 62 V54 Q16 48 22 48 Z" fill={c} fillOpacity="0.14" strokeOpacity="0.5" strokeWidth="1.5" />
        <path d="M18 52 L8 50" fill="none" stroke={c} strokeWidth="3" />
        <circle cx="18" cy="52" r="2" fill={INK} stroke="none" />
        <circle cx="53" cy="53" r="2" fill={INK} stroke="none" />
      </Pair>
      <path d="M53 53 Q60 47 67 53" fill="none" stroke={c} strokeWidth="3" />
    </>
  ),

  // Hair
  "hair-crop": (c) => (
    <>
      <Bust />
      <path d="M40 50 Q38 23 60 23 Q82 23 80 50 L78 44 Q76 38 72 38 L68 41 L64 38 L60 41 L56 38 L52 41 L48 38 Q44 38 42 44 Z" fill={c} />
      <path d="M50 28 L48 36 M58 27 L57 36 M66 28 L66 36 M73 31 L72 37" fill="none" {...SOFT} />
    </>
  ),
  "hair-crew": (c) => (
    <>
      <Bust />
      <path d="M41 48 Q39 25 60 24 Q81 25 79 48 Q76 38 66 36 L60 38 L54 36 Q44 38 41 48 Z" fill={c} />
      <path d="M52 28 L54 34 M60 27 L60 34 M68 28 L66 34" fill="none" {...SOFT} />
    </>
  ),
  "hair-sidepart": (c) => (
    <>
      <Bust />
      <path d="M40 52 Q36 22 58 20 Q84 20 81 50 Q78 38 70 34 Q56 32 46 40 Q42 44 40 52 Z" fill={c} />
      <path d="M48 23 Q46 30 45 40" fill="none" stroke={shade(c, 0.35)} strokeWidth="1.5" />
      <path d="M52 26 Q64 24 76 32 M54 30 Q66 28 78 38" fill="none" {...SOFT} />
    </>
  ),
  "hair-quiff": (c) => (
    <>
      <Bust />
      <path d="M41 50 Q38 32 46 27 Q48 12 64 11 Q80 12 76 22 Q82 30 79 50 Q76 38 68 36 Q58 34 50 38 Q44 41 41 50 Z" fill={c} />
      <path d="M50 26 Q54 16 66 14 M56 30 Q60 20 72 18" fill="none" {...SOFT} />
    </>
  ),
  "hair-pompadour": (c) => (
    <>
      <Bust />
      <path d="M41 50 Q39 30 44 24 Q42 8 62 7 Q86 8 80 30 L79 50 Q76 36 66 34 Q52 34 46 38 Q42 42 41 50 Z" fill={c} />
      <path d="M48 20 Q60 10 76 16 M48 28 Q62 18 78 26" fill="none" {...SOFT} />
    </>
  ),
  "hair-fade": (c) => (
    <>
      <Bust />
      <path d="M41 50 Q42 40 46 36 L45 52 Z M79 50 Q78 40 74 36 L75 52 Z" fill={c} fillOpacity="0.3" stroke="none" />
      <path d="M42 42 L44 40 M42 47 L44 45 M43 51 L45 49 M78 42 L76 40 M78 47 L76 45 M77 51 L75 49" fill="none" stroke={c} strokeWidth="1.5" />
      <path d="M43 38 Q42 20 60 20 Q78 20 77 38 Q70 33 60 33 Q50 33 43 38 Z" fill={c} />
      <path d="M52 24 Q60 22 70 26" fill="none" {...SOFT} />
    </>
  ),
  "hair-buzz": (c) => (
    <>
      <Bust />
      <path d="M41.5 50 Q40 27.5 60 27 Q80 27.5 78.5 50 Q76 40 60 38 Q44 40 41.5 50 Z" fill={c} fillOpacity="0.55" />
      <Curls points={curlPoints(60, 44, 13, 12, 200, 340, 6)} r={0.9} fill={c} />
    </>
  ),
  "hair-medium": (c) => (
    <>
      <Bust />
      <path d="M38 72 Q30 22 60 20 Q90 22 82 72 Q79 75 76 70 Q78 50 72 40 Q62 44 50 37 Q42 46 44 70 Q41 75 38 72 Z" fill={c} />
      <path d="M50 37 Q56 30 66 30 M58 26 Q68 28 74 36" fill="none" {...SOFT} />
    </>
  ),
  "hair-curly-short": (c) => (
    <>
      <Bust />
      <path d={SHORT_HAIR} fill={c} />
      <Curls points={curlPoints(60, 46, 20, 21, 190, 350, 9)} r={5} fill={c} />
      <Curls points={curlPoints(60, 44, 11, 13, 215, 325, 4)} r={4.5} fill={c} />
    </>
  ),
  "hair-long": (c, a) => (
    <>
      <path d="M38 40 Q36 20 60 20 Q84 20 82 40 L86 100 H34 Z" fill={a} />
      <Bust />
      <Pair>
        <path d="M60 21 Q40 21 39 48 Q37 78 33 104 L46 104 Q46 82 44 64 Q44 46 52 36 Q56 32 60 30 Z" fill={c} />
      </Pair>
      <path d="M60 22 V30" fill="none" {...SOFT} />
    </>
  ),
  "hair-bun": (c) => (
    <>
      <Bust />
      <circle cx="60" cy="18" r="10" fill={c} />
      <path d="M54 14 Q60 10 66 16" fill="none" {...SOFT} />
      <path d="M41 50 Q38 26 60 26 Q82 26 79 50 Q76 38 60 36 Q44 38 41 50 Z" fill={c} />
      <path d="M48 36 Q52 30 58 28 M72 36 Q68 30 62 28" fill="none" {...SOFT} />
    </>
  ),
  "hair-pixie": (c) => (
    <>
      <Bust />
      <path d="M40 56 Q35 24 60 22 Q85 22 81 52 Q80 44 76 40 Q66 44 50 39 L47 47 Q43 48 41 56 Z" fill={c} />
      <path d="M50 39 Q56 34 72 36 M56 28 Q66 30 74 38" fill="none" {...SOFT} />
    </>
  ),
  "hair-bob": (c, a) => (
    <>
      <path d="M38 50 H82 V74 H38 Z" fill={a} />
      <Bust />
      <path d="M60 22 Q36 22 36 52 L35 74 H47 Q44 60 46 46 Q50 36 60 32 Q70 36 74 46 Q76 60 73 74 H85 L84 52 Q84 22 60 22 Z" fill={c} />
      <path d="M60 23 V32" fill="none" {...SOFT} />
    </>
  ),
  "hair-lob": (c, a) => (
    <>
      <path d="M38 50 H82 L84 90 H36 Z" fill={a} />
      <Bust />
      <path d="M60 22 Q36 22 36 52 L33 92 L48 88 Q44 64 46 46 Q50 36 60 32 Q70 36 74 46 Q76 64 72 88 L87 92 L84 52 Q84 22 60 22 Z" fill={c} />
      <path d="M54 24 Q50 30 52 34" fill="none" {...SOFT} />
    </>
  ),
  "hair-long-layers": (c, a) => (
    <>
      <path d="M38 40 Q36 20 60 20 Q84 20 82 40 L86 100 H34 Z" fill={a} />
      <Bust />
      <Pair>
        <path d="M60 21 Q38 21 38 46 Q34 58 38 66 Q32 78 36 88 Q30 98 34 106 L46 102 Q42 92 46 84 Q42 72 46 60 Q44 46 52 36 Q56 32 60 30 Z" fill={c} />
        <path d="M38 66 Q42 64 44 68 M36 88 Q40 85 44 86" fill="none" {...SOFT} />
      </Pair>
    </>
  ),
  "hair-fringe": (c, a) => (
    <>
      <path d="M38 50 H82 L84 88 H36 Z" fill={a} />
      <Bust />
      <path d="M60 20 Q35 20 36 50 L34 88 H46 Q44 70 44 56 L44 43 H76 L76 56 Q76 70 74 88 H86 L84 50 Q85 20 60 20 Z" fill={c} />
      <path d="M50 34 L49 42 M56 33 L55.5 42 M62 33 L62 42 M68 34 L68.5 42" fill="none" {...SOFT} />
    </>
  ),
  "hair-waves": (c, a) => (
    <>
      <path d="M38 40 Q36 20 60 20 Q84 20 82 40 L86 100 H34 Z" fill={a} />
      <Bust />
      <Pair>
        <path d="M60 21 Q38 21 38 46 Q30 58 38 70 Q46 82 36 94 Q30 102 38 106 L48 102 Q54 92 46 82 Q38 70 46 58 Q44 44 52 36 Q56 32 60 30 Z" fill={c} />
        <path d="M41 60 Q36 66 42 74 M40 86 Q44 92 40 98" fill="none" {...SOFT} />
      </Pair>
    </>
  ),
  "hair-shag": (c, a) => (
    <>
      <path d="M38 40 Q36 20 60 20 Q84 20 82 40 L84 86 H36 Z" fill={a} />
      <Bust />
      <Pair>
        <path d="M60 18 Q34 18 36 48 L31 56 L37 60 L32 70 L39 72 L34 84 L43 81 L41 92 L48 86 Q44 70 46 56 Q48 44 56 40 Q60 36 60 33 Z" fill={c} />
        <path d="M60 33 Q52 34 48 44" fill="none" {...SOFT} />
      </Pair>
    </>
  ),
  "hair-ponytail": (c) => (
    <>
      <path d="M74 30 Q98 26 97 54 Q98 80 88 100 Q86 82 84 68 Q82 52 76 44 Z" fill={c} />
      <path d="M90 66 Q92 80 89 92" fill="none" {...SOFT} />
      <Bust />
      <path d="M41 50 Q38 24 60 24 Q82 24 79 50 Q76 38 60 34 Q44 38 41 50 Z" fill={c} />
      <path d="M48 32 Q62 26 76 32 M52 38 Q66 32 78 40" fill="none" {...SOFT} />
      <path d="M77 30 L84 38" fill="none" stroke={shade(c, 0.4)} strokeWidth="3" />
    </>
  ),
  "hair-updo": (c) => (
    <>
      <Bust />
      <path d="M41 50 Q36 14 52 10 Q60 4 70 10 Q86 16 79 50 Q76 36 60 34 Q44 36 41 50 Z" fill={c} />
      <path d="M58 30 Q50 22 58 14 Q66 10 70 18 Q72 26 64 26 Q60 24 62 20" fill="none" {...SOFT} />
      <path d="M42 48 Q40 56 43 64 M78 48 Q80 56 77 64" fill="none" stroke={c} strokeWidth="1.8" />
    </>
  ),
  "hair-curly-long": (c, a) => (
    <>
      <path d="M38 46 Q36 18 60 16 Q84 18 82 46 L86 100 H34 Z" fill={a} />
      <Curls points={[...column(34, 50, 98, 8), ...column(86, 50, 98, 8)]} r={6} fill={a} />
      <Bust />
      <path d={SHORT_HAIR} fill={c} />
      <Curls points={curlPoints(60, 44, 23, 26, 180, 360, 11)} r={6} fill={c} />
      <Curls points={curlPoints(60, 42, 14, 12, 205, 335, 5)} r={5} fill={c} />
      <Curls points={[...column(40, 62, 102, 8), ...column(80, 62, 102, 8)]} r={6} fill={c} />
    </>
  ),

};

const Fallback = (c) => (
  <>
    <path d="M60 38 L16 72 Q12 76 18 76 H102 Q108 76 104 72 Z" fill={c} fillOpacity="0.25" />
    <path d="M60 38 Q60 34 64 31 Q70 27 69 22 Q68 16 61 16 Q55 17 54 23" fill="none" />
    <circle cx="60" cy="38" r="2" fill={INK} stroke="none" />
  </>
);

export const ART_KEYS = Object.keys(DRAWINGS);

const isHairKey = (key) => key.startsWith("hair-");

export default function StyleArt({ art, color = DEFAULT_COLOR, accent, title, className = "" }) {
  const key = typeof art === "string" && Object.prototype.hasOwnProperty.call(DRAWINGS, art) ? art : null;
  const hair = key !== null && isHairKey(key);
  const fallbackColor = hair ? HAIR_COLOR : DEFAULT_COLOR;
  const main = hair && color === DEFAULT_COLOR ? HAIR_COLOR : safeHex(color, fallbackColor);
  const second = safeHex(accent, defaultAccent(main));
  return (
    <svg
      className={`style-art ${className}`.trim()}
      viewBox="0 0 120 120"
      fill="none"
      stroke={INK}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : "true"}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {key ? DRAWINGS[key](main, second) : Fallback(main)}
    </svg>
  );
}
