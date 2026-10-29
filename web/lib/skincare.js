export const SKIN_TYPE_NAMES = { A: "Oily Skin", B: "Dry Skin", C: "Combination Skin", D: "Normal Skin", E: "Sensitive Skin" };

// Majority answer letter decides the skin type; ties resolve toward combination, oily, sensitive, dry, then normal.
export function determineSkinType(answers) {
  const counts = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  Object.values(answers || {}).forEach((answer) => { if (answer?.label in counts) counts[answer.label] += 1; });
  const max = Math.max(...Object.values(counts));
  const top = Object.keys(counts).filter((key) => counts[key] === max);
  if (top.length === 5 || (top.includes("A") && top.includes("B")) || top.includes("C")) return "C";
  if (top.length === 1) return top[0];
  if (top.includes("A")) return "A";
  if (top.includes("E")) return "E";
  if (top.includes("B")) return "B";
  return "D";
}

export function skinTypeName(answers) {
  return SKIN_TYPE_NAMES[determineSkinType(answers)];
}
