// data/questions.js
export const questions = [
  {
    id: "Q1",
    question: "How would you describe your shoulders compared to your hips?",
    options: [
      { label: "A", text: "My shoulders and hips are about the same width.", shapes: ["Hourglass", "Rectangle"] },
      { label: "B", text: "My shoulders are broader than my hips.", shapes: ["Inverted Triangle"] },
      { label: "C", text: "My hips are wider than my shoulders.", shapes: ["Pear"] },
      { label: "D", text: "I have a very defined waist with balanced shoulders and hips.", shapes: ["Hourglass"] },
    ],
  },
  {
    id: "Q2",
    question: "Where do you tend to gain weight first?",
    options: [
      { label: "A", text: "Around my hips and thighs.", shapes: ["Pear"] },
      { label: "B", text: "Around my stomach or upper body.", shapes: ["Apple", "Inverted Triangle"] },
      { label: "C", text: "Evenly all over my body.", shapes: ["Rectangle"] },
      { label: "D", text: "Mostly around my waist but balanced elsewhere.", shapes: ["Hourglass"] },
    ],
  },
  {
    id: "Q3",
    question: "How defined is your waistline?",
    options: [
      { label: "A", text: "Very defined waist.", shapes: ["Hourglass", "Pear"] },
      { label: "B", text: "Slightly defined waist.", shapes: ["Rectangle"] },
      { label: "C", text: "Hardly any waist definition.", shapes: ["Rectangle", "Apple"] },
      { label: "D", text: "My waist is wider than my hips.", shapes: ["Apple"] },
    ],
  },
  {
    id: "Q5",
    question: "How do fitted clothes usually look on your waist?",
    options: [
      { label: "A", text: "They fit snugly and highlight my waist.", shapes: ["Hourglass"] },
      { label: "B", text: "They feel tight around the stomach but loose at the hips.", shapes: ["Apple"] },
      { label: "C", text: "They fit well at the hips but loose at the waist.", shapes: ["Pear"] },
      { label: "D", text: "They fit almost straight without much curve.", shapes: ["Rectangle"] },
    ],
  },
  {
    id: "Q6",
    question: "When you wear jeans, how do they fit your hips and waist?",
    options: [
      { label: "A", text: "Perfectly at both waist and hips.", shapes: ["Hourglass"] },
      { label: "B", text: "Tight at hips, loose at waist.", shapes: ["Pear"] },
      { label: "C", text: "Tight at waist, loose at hips.", shapes: ["Apple"] },
      { label: "D", text: "Fit straight down, not much curve.", shapes: ["Rectangle"] },
    ],
  },
  {
    id: "Q9",
    question: "When you gain or lose weight, where is it most noticeable?",
    options: [
      { label: "A", text: "Around my midsection (stomach).", shapes: ["Apple"] },
      { label: "B", text: "Around my hips and thighs.", shapes: ["Pear"] },
      { label: "C", text: "Evenly all over.", shapes: ["Rectangle"] },
      { label: "D", text: "On my chest and arms.", shapes: ["Inverted Triangle"] },
    ],
  },
  {
    id: "Q13",
    question: "How would you describe your shoulder line?",
    options: [
      { label: "A", text: "Straight and broad.", shapes: ["Inverted Triangle"] },
      { label: "B", text: "Sloping and narrow.", shapes: ["Pear"] },
      { label: "C", text: "Slightly curved and balanced.", shapes: ["Hourglass"] },
      { label: "D", text: "Almost straight without definition.", shapes: ["Rectangle"] },
    ],
  },
  {
    id: "Q14",
    question: "When you wear belts or high-waisted bottoms, how do they look?",
    options: [
      { label: "A", text: "They emphasize my waist beautifully.", shapes: ["Hourglass", "Pear"] },
      { label: "B", text: "They make my waist area look fuller.", shapes: ["Apple"] },
      { label: "C", text: "They don’t change much in my silhouette.", shapes: ["Rectangle"] },
      { label: "D", text: "They make my torso look shorter.", shapes: ["Inverted Triangle"] },
    ],
  },
];

// Default export to prevent Expo Router from treating this as a route
export default questions;