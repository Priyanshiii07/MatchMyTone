// data/questions.js
export const questions = [
  {
    id: "Q1",
    question: "What is your face length like?",
    options: [
      { label: "A", text: "A little longer than wide", shapes: ["Oval"] },
      { label: "B", text: "Same length and width", shapes: ["Round"] },
      { label: "C", text: "Looks wide and strong", shapes: ["Square"] },
      { label: "D", text: "Wider at cheeks, narrow at top/bottom", shapes: ["Diamond"] },
      { label: "E", text: "Wider forehead, narrow chin", shapes: ["Heart"] },
    ],
  },

  {
    id: "Q2",
    question: "How would you describe your jawline?",
    options: [
      { label: "A", text: "Soft and round", shapes: ["Round"] },
      { label: "B", text: "Sharp and wide", shapes: ["Square"] },
      { label: "C", text: "Pointed or V-shaped", shapes: ["Heart"] },
      { label: "D", text: "Slight curve, not too round or sharp", shapes: ["Oval"] },
      { label: "E", text: "Narrow with sharp edges", shapes: ["Diamond"] },
    ],
  },

  {
    id: "Q3",
    question: "Which part of your face looks widest?",
    options: [
      { label: "A", text: "Forehead", shapes: ["Heart"] },
      { label: "B", text: "Cheekbones", shapes: ["Diamond"] },
      { label: "C", text: "Jawline", shapes: ["Square"] },
      { label: "D", text: "All parts look similar", shapes: ["Round"] },
      { label: "E", text: "No one area stands out too much", shapes: ["Oval"] },
    ],
  },

  {
    id: "Q4",
    question: "How does your chin look?",
    options: [
      { label: "A", text: "Pointed", shapes: ["Heart"] },
      { label: "B", text: "Round", shapes: ["Round"] },
      { label: "C", text: "Flat or strong", shapes: ["Square"] },
      { label: "D", text: "Soft curve", shapes: ["Oval"] },
      { label: "E", text: "Narrow and sharp", shapes: ["Diamond"] },
    ],
  },

  {
    id: "Q5",
    question: "How would you describe your forehead?",
    options: [
      { label: "A", text: "Wide and broad", shapes: ["Heart"] },
      { label: "B", text: "Narrow", shapes: ["Diamond"] },
      { label: "C", text: "Balanced", shapes: ["Oval"] },
      { label: "D", text: "Same width as jawline", shapes: ["Square"] },
      { label: "E", text: "Rounded and smooth", shapes: ["Round"] },
    ],
  },

  {
    id: "Q6",
    question: "Which word best describes your overall face shape?",
    options: [
      { label: "A", text: "Circular", shapes: ["Round"] },
      { label: "B", text: "Straight and angular", shapes: ["Square"] },
      { label: "C", text: "Narrow forehead and chin, wide cheeks", shapes: ["Diamond"] },
      { label: "D", text: "Soft curves and balanced", shapes: ["Oval"] },
      { label: "E", text: "Wider forehead, slimmer chin", shapes: ["Heart"] },
    ],
  },

  {
    id: "Q7",
    question: "What stands out the most about your face?",
    options: [
      { label: "A", text: "My cheeks look rounded", shapes: ["Round"] },
      { label: "B", text: "My jawline is sharp", shapes: ["Square"] },
      { label: "C", text: "My cheekbones are high", shapes: ["Diamond"] },
      { label: "D", text: "My forehead looks wider", shapes: ["Heart"] },
      { label: "E", text: "My features look balanced", shapes: ["Oval"] },
    ],
  },
];

// Default export to prevent Expo Router from treating this as a route
export default questions;