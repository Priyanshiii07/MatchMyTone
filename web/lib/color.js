const HEX = /^#([0-9a-f]{6})$/i;

function toHsl(hex) {
  const value = HEX.exec(hex)?.[1];
  if (!value) return null;
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (!delta) return [0, 0, lightness];
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return [(hue * 60 + 360) % 360, saturation, lightness];
}

function toHex([hue, saturation, lightness]) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - chroma / 2;
  const [r, g, b] = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x] : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return `#${[r, g, b].map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/** Colour-wheel harmonies for a #RRGGBB colour (hue rotation at the same saturation and lightness). */
export function harmonies(hex) {
  const hsl = toHsl(hex);
  if (!hsl) return null;
  const rotate = (degrees) => toHex([(hsl[0] + degrees + 360) % 360, hsl[1], hsl[2]]);
  return { complementary: [rotate(180)], analogous: [rotate(-30), rotate(30)] };
}
