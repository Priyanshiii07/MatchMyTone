// Neutral, proportion-only outlines used where a gendered figure would be wrong (men's, unisex and mixed catalogs).

// [shoulders, waist, hips] widths in viewBox units.
const BODY_WIDTHS = { Hourglass: [70, 40, 70], Rectangle: [62, 56, 62], Pear: [52, 44, 76], Apple: [64, 74, 62], "Inverted Triangle": [82, 52, 50] };

const FACE_PATHS = {
  Oval: "M60 14c22 0 34 20 34 48 0 32-16 58-34 58S26 94 26 62c0-28 12-48 34-48Z",
  Round: "M60 18c24 0 40 18 40 44s-16 48-40 48-40-22-40-48 16-44 40-44Z",
  Square: "M30 22h60c4 0 6 2 6 6v52c0 16-10 30-36 30S24 96 24 80V28c0-4 2-6 6-6Z",
  Heart: "M24 30c0-10 16-16 36-16s36 6 36 16c0 26-14 58-36 88C38 88 24 56 24 30Z",
  Diamond: "M60 12c10 8 18 22 36 42-14 26-24 48-36 64-12-16-22-38-36-64 18-20 26-34 36-42Z",
};

function bodyPath([shoulders, waist, hips]) {
  const left = (width) => 60 - width / 2;
  const right = (width) => 60 + width / 2;
  return `M${left(shoulders)} 30 Q60 24 ${right(shoulders)} 30 Q${right(waist) + 4} 46 ${right(waist)} 62 Q${right(hips) + 2} 78 ${right(hips)} 92 L${left(hips)} 92 Q${left(hips) - 2} 78 ${left(waist)} 62 Q${left(waist) - 4} 46 ${left(shoulders)} 30Z`;
}

export default function ShapeDiagram({ kind, shape, className = "", decorative = false }) {
  const label = `${shape} ${kind === "face" ? "face" : "body"} shape outline`;
  const a11y = decorative ? { "aria-hidden": true, focusable: "false" } : { role: "img", "aria-label": label };
  if (kind === "face") {
    const path = FACE_PATHS[shape] || FACE_PATHS.Oval;
    return (
      <svg className={`shape-diagram ${className}`.trim()} viewBox="0 0 120 132" {...a11y}>
        <path d={path} fill="#F6E7C4" stroke="#2C2622" strokeWidth="2" />
        <path d="M30 52h60M34 78h52" stroke="#B89018" strokeWidth="1.4" strokeDasharray="3 4" fill="none" />
      </svg>
    );
  }
  const widths = BODY_WIDTHS[shape] || BODY_WIDTHS.Rectangle;
  return (
    <svg className={`shape-diagram ${className}`.trim()} viewBox="0 0 120 120" {...a11y}>
      <circle cx="60" cy="14" r="8" fill="#EFE4D6" stroke="#2C2622" strokeWidth="2" />
      <path d={bodyPath(widths)} fill="#F6E7C4" stroke="#2C2622" strokeWidth="2" strokeLinejoin="round" />
      {[[30, widths[0]], [62, widths[1]], [92, widths[2]]].map(([y, width]) => <path key={y} d={`M${60 - width / 2 - 6} ${y}h${width + 12}`} stroke="#B89018" strokeWidth="1.4" strokeDasharray="3 4" />)}
      <path d="M48 92v20M72 92v20" stroke="#2C2622" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
