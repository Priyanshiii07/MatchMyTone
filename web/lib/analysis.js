// Option letters and their shape lists are unchanged from earlier versions, so saved answers keep their
// meaning; only the wording is clearer. "?" (Not sure) carries no shape and is ignored by scoring.
const notSure = { label: "?", text: "Not sure", shapes: [] };

export const bodyQuestions = [
  { id: "Q1", question: "Looking in a mirror, how do your shoulders compare with your hips?", hint: "Stand straight and compare the outer edges of your shoulders with the widest part of your hips.", options: [
    { label: "A", text: "About the same width.", shapes: ["Hourglass", "Rectangle"] }, { label: "B", text: "My shoulders are wider than my hips.", shapes: ["Inverted Triangle"] }, { label: "C", text: "My hips are wider than my shoulders.", shapes: ["Pear"] }, { label: "D", text: "About the same width, with a clearly narrower waist.", shapes: ["Hourglass"] }] },
  { id: "Q2", question: "When your weight changes a little, where do you usually notice it first?", options: [
    { label: "A", text: "Hips and thighs.", shapes: ["Pear"] }, { label: "B", text: "Stomach or upper body.", shapes: ["Apple", "Inverted Triangle"] }, { label: "C", text: "Evenly all over.", shapes: ["Rectangle"] }, { label: "D", text: "Around the waist, with the rest staying balanced.", shapes: ["Hourglass"] }, notSure] },
  { id: "Q3", question: "How noticeable is your waist?", hint: "How much narrower your waist looks than your ribcage and hips. There is no right answer.", options: [
    { label: "A", text: "Very noticeable — clearly narrower.", shapes: ["Hourglass", "Pear"] }, { label: "B", text: "Slightly narrower.", shapes: ["Rectangle"] }, { label: "C", text: "Hardly narrower at all.", shapes: ["Rectangle", "Apple"] }, { label: "D", text: "My waist is wider than my hips.", shapes: ["Apple"] }] },
  { id: "Q5", question: "How do fitted tops or dresses usually sit around your middle?", options: [
    { label: "A", text: "Close-fitting at the waist, following my shape.", shapes: ["Hourglass"] }, { label: "B", text: "Snug around the stomach, loose at the hips.", shapes: ["Apple"] }, { label: "C", text: "Fit at the hips, loose at the waist.", shapes: ["Pear"] }, { label: "D", text: "Fairly straight, without much curve.", shapes: ["Rectangle"] }] },
  { id: "Q6", question: "When you buy jeans that fit your hips, how does the waist fit?", options: [
    { label: "A", text: "The waist fits well too.", shapes: ["Hourglass"] }, { label: "B", text: "The waist is loose or gapes.", shapes: ["Pear"] }, { label: "C", text: "The waist feels tight.", shapes: ["Apple"] }, { label: "D", text: "They fall straight with little difference.", shapes: ["Rectangle"] }] },
  { id: "Q9", question: "When you change size, which clothes start to fit differently first?", options: [
    { label: "A", text: "Waistbands and tops around the middle.", shapes: ["Apple"] }, { label: "B", text: "Trousers or skirts at the hips and thighs.", shapes: ["Pear"] }, { label: "C", text: "Everything changes about evenly.", shapes: ["Rectangle"] }, { label: "D", text: "Shirts across the chest, shoulders and arms.", shapes: ["Inverted Triangle"] }, notSure] },
  { id: "Q13", question: "How would you describe your shoulder line?", hint: "Look at the line from your neck to the edge of each shoulder in a mirror.", options: [
    { label: "A", text: "Straight and broad.", shapes: ["Inverted Triangle"] }, { label: "B", text: "Sloping and narrow.", shapes: ["Pear"] }, { label: "C", text: "Gently curved and balanced.", shapes: ["Hourglass"] }, { label: "D", text: "Fairly straight, neither broad nor narrow.", shapes: ["Rectangle"] }] },
  { id: "Q14", question: "When you wear a belt or high-waisted bottoms, what do you notice?", options: [
    { label: "A", text: "They mark my waist clearly.", shapes: ["Hourglass", "Pear"] }, { label: "B", text: "They draw attention to my middle more than I'd like.", shapes: ["Apple"] }, { label: "C", text: "They don't change my shape much.", shapes: ["Rectangle"] }, { label: "D", text: "My upper body looks shorter.", shapes: ["Inverted Triangle"] }] },
];

const faceNotSure = ["?", "Not sure", null];

export const faceQuestions = [
  ["Q1", "Compared with its width, how long is your face?", "Measure roughly from hairline to chin, and across the widest part of your face.", [["A", "A little longer than it is wide", "Oval"], ["B", "About as long as it is wide", "Round"], ["C", "Wide, with a strong, square outline", "Square"], ["D", "Widest at the cheekbones, narrower at the top and bottom", "Diamond"], ["E", "Widest at the forehead, narrowing to the chin", "Heart"]]],
  ["Q2", "How would you describe your jawline?", "Run a finger along your jaw from ear to chin.", [["A", "Soft and rounded", "Round"], ["B", "Wide, with clear corners", "Square"], ["C", "Narrowing to a point or V shape", "Heart"], ["D", "Gently curved — not very round or sharp", "Oval"], ["E", "Narrow with defined edges", "Diamond"], faceNotSure]],
  ["Q3", "Which part of your face looks widest?", null, [["A", "Forehead", "Heart"], ["B", "Cheekbones", "Diamond"], ["C", "Jaw", "Square"], ["D", "Everything looks about the same width", "Round"], ["E", "No single area stands out", "Oval"]]],
  ["Q4", "What does your chin look like?", null, [["A", "Pointed", "Heart"], ["B", "Rounded", "Round"], ["C", "Broad and flat", "Square"], ["D", "Softly curved", "Oval"], ["E", "Narrow and defined", "Diamond"]]],
  ["Q5", "How would you describe your forehead?", null, [["A", "Wide — the widest part of my face", "Heart"], ["B", "Narrower than my cheekbones", "Diamond"], ["C", "In proportion with the rest of my face", "Oval"], ["D", "About as wide as my jaw", "Square"], ["E", "Rounded and smooth", "Round"], faceNotSure]],
  ["Q6", "Which description fits your overall face shape best?", null, [["A", "Round, with soft curves", "Round"], ["B", "Straight sides with an angular jaw", "Square"], ["C", "Narrow forehead and chin, wide cheekbones", "Diamond"], ["D", "Balanced with soft curves", "Oval"], ["E", "Wider forehead, narrower chin", "Heart"]]],
  ["Q7", "What stands out most about your face?", null, [["A", "Full, rounded cheeks", "Round"], ["B", "A strong jaw", "Square"], ["C", "High cheekbones", "Diamond"], ["D", "A wider forehead", "Heart"], ["E", "Nothing in particular — it looks balanced", "Oval"]]],
].map(([id, question, hint, options]) => ({ id, question, ...(hint ? { hint } : {}), options: options.map(([label, text, shape]) => ({ label, text, shapes: shape ? [shape] : [] })) }));

// Fisher-Yates: every order is equally likely.
export function shuffle(items) { const copy = [...items]; for (let index = copy.length - 1; index > 0; index -= 1) { const swapIndex = Math.floor(Math.random() * (index + 1)); [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]; } return copy; }
const SHAPE_ORDER = { body: ["Hourglass", "Rectangle", "Pear", "Apple", "Inverted Triangle"], face: ["Oval", "Round", "Square", "Heart", "Diamond"] };

// Highest count wins; ties break by a fixed shape order so the (shuffled) answering order never changes the result.
export function scoreShapes(answers, key = "body") {
  const scores = {};
  Object.values(answers || {}).forEach((answer) => (answer?.shapes || []).forEach((shape) => { scores[shape] = (scores[shape] || 0) + 1; }));
  const order = SHAPE_ORDER[key] || SHAPE_ORDER.body;
  const rank = (shape) => (order.includes(shape) ? order.indexOf(shape) : order.length);
  return Object.entries(scores).sort((a, b) => b[1] - a[1] || rank(a[0]) - rank(b[0]))[0]?.[0] || (key === "face" ? "Oval" : "Rectangle");
}
