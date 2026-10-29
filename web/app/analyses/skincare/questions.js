// Option letters A–E keep their original meaning (A oily, B dry, C combination, D normal, E sensitive):
// scoring here and in backend/skincare.py counts letters, so wording can change without changing results.
// "?" marks "Not sure", which is never counted.
const NOT_SURE = "Not sure";

export const questions = [
  ["Which description sounds most like your skin on a typical day?", ["Oily — my face looks shiny by midday", "Dry — my skin often feels tight or flaky", "Combination — oily forehead, nose and chin, but normal or dry cheeks", "Normal — balanced, rarely too oily or too dry", "Sensitive — easily stings, reddens or reacts"], "Go with what you notice most days, not on unusual days."],
  ["About an hour after washing your face (with nothing applied), how does it feel?", ["Fresh at first, then greasy as time passes", "Tight or stretched straight away", "Fine overall, but the forehead and nose get oily sooner", "Comfortable — neither tight nor shiny", "A little red or stinging"], "The forehead, nose and chin (often called the T-zone) are usually the first areas to get oily."],
  ["After some time in the sun, what usually happens to your skin?", ["It looks shiny or sweaty quickly", "It feels rough or flaky afterwards", "My forehead and nose get oily, my cheeks stay normal", "It tans slowly without much trouble", "It burns or turns red easily", NOT_SURE]],
  ["How often do you get breakouts or pimples?", ["Often, especially on my forehead and nose", "Almost never — unless my skin is very dry", "Only on the oilier parts of my face", "Occasionally, a small spot here and there", "When a product or the weather sets it off"]],
  ["When you wake up, how does your skin usually feel?", ["Greasy or shiny, especially across the forehead and nose", "Tight or flaky in places", "A little shiny on the forehead and nose, dry on the cheeks", "Balanced and comfortable", "Warm, red or slightly irritated"]],
  ["Which best describes how your skin feels to the touch?", ["Smooth but slick or oily", "Rough, flaky or dull", "Different depending on the area", "Soft and even", "Thin, delicate or easily upset"]],
  ["A few minutes after you apply moisturiser, how does your skin feel?", ["The moisturiser sits on top and feels greasy", "It soaks in quickly and my skin feels relieved", "My cheeks feel comfortable but my forehead and nose get shiny", "Lightly hydrated and balanced", "It tingles, burns or reacts to some products"]],
  ["What would you most like your routine to help with?", ["Shine, breakouts and blocked pores", "Dryness and flaky patches", "Looking after two different zones", "Keeping my skin as it is", "Calming irritation and flare-ups"]],
  ["When you try a new skincare product, what usually happens?", ["I often break out", "My skin feels drier or uncomfortable", "My cheeks feel tight while my forehead and nose get oily", "Usually nothing — my skin is fine", "Redness, itching or burning starts", NOT_SURE]],
  ["Which sounds most like your current routine?", ["Minimal — just cleanser and moisturiser", "Basic — cleanser, toner and moisturiser", "Moderate — several steps including serums", "Comprehensive — a full routine with many products", "Very gentle — as few products as possible to avoid reactions"]],
].map(([question, options, hint], index) => ({
  id: index + 1,
  question,
  ...(hint ? { hint } : {}),
  options: options.map((text, optionIndex) => (text === NOT_SURE ? { label: "?", text } : { label: String.fromCharCode(65 + optionIndex), text })),
}));
