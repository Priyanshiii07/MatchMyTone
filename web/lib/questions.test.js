import { questions as skincareQuestions } from "../app/analyses/skincare/questions";
import { bodyQuestions, faceQuestions, scoreShapes } from "./analysis";
import { determineSkinType } from "./skincare";

// Letter -> shapes exactly as before the wording update; saved answers depend on these never changing.
const BODY_SCORING = {
  Q1: { A: ["Hourglass", "Rectangle"], B: ["Inverted Triangle"], C: ["Pear"], D: ["Hourglass"] },
  Q2: { A: ["Pear"], B: ["Apple", "Inverted Triangle"], C: ["Rectangle"], D: ["Hourglass"] },
  Q3: { A: ["Hourglass", "Pear"], B: ["Rectangle"], C: ["Rectangle", "Apple"], D: ["Apple"] },
  Q5: { A: ["Hourglass"], B: ["Apple"], C: ["Pear"], D: ["Rectangle"] },
  Q6: { A: ["Hourglass"], B: ["Pear"], C: ["Apple"], D: ["Rectangle"] },
  Q9: { A: ["Apple"], B: ["Pear"], C: ["Rectangle"], D: ["Inverted Triangle"] },
  Q13: { A: ["Inverted Triangle"], B: ["Pear"], C: ["Hourglass"], D: ["Rectangle"] },
  Q14: { A: ["Hourglass", "Pear"], B: ["Apple"], C: ["Rectangle"], D: ["Inverted Triangle"] },
};
const FACE_SCORING = {
  Q1: { A: "Oval", B: "Round", C: "Square", D: "Diamond", E: "Heart" },
  Q2: { A: "Round", B: "Square", C: "Heart", D: "Oval", E: "Diamond" },
  Q3: { A: "Heart", B: "Diamond", C: "Square", D: "Round", E: "Oval" },
  Q4: { A: "Heart", B: "Round", C: "Square", D: "Oval", E: "Diamond" },
  Q5: { A: "Heart", B: "Diamond", C: "Oval", D: "Square", E: "Round" },
  Q6: { A: "Round", B: "Square", C: "Diamond", D: "Oval", E: "Heart" },
  Q7: { A: "Round", B: "Square", C: "Diamond", D: "Heart", E: "Oval" },
};

const scored = (options) => options.filter((option) => option.label !== "?");

it("keeps every body answer letter mapped to its original shapes", () => {
  expect(bodyQuestions.map((question) => question.id)).toEqual(Object.keys(BODY_SCORING));
  bodyQuestions.forEach((question) => {
    expect(Object.fromEntries(scored(question.options).map((option) => [option.label, option.shapes]))).toEqual(BODY_SCORING[question.id]);
  });
});

it("keeps every face answer letter mapped to its original shape", () => {
  faceQuestions.forEach((question) => {
    expect(Object.fromEntries(scored(question.options).map((option) => [option.label, option.shapes[0]]))).toEqual(FACE_SCORING[question.id]);
  });
});

it("keeps skincare letters A-E in order on every question, with ids 1-10", () => {
  expect(skincareQuestions.map((question) => question.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  skincareQuestions.forEach((question) => expect(scored(question.options).map((option) => option.label)).toEqual(["A", "B", "C", "D", "E"]));
});

it("never scores a 'Not sure' answer", () => {
  const notSure = { label: "?", text: "Not sure", shapes: [] };
  expect(scoreShapes({ Q1: { label: "C", shapes: ["Pear"] }, Q2: notSure, Q9: notSure })).toBe("Pear");
  expect(determineSkinType({ 1: { label: "B" }, 3: { label: "?" }, 9: { label: "?" } })).toBe("B");
  // "Not sure" is offered sparingly so most answers always carry a signal.
  [skincareQuestions, bodyQuestions, faceQuestions].forEach((quiz) => expect(quiz.filter((question) => question.options.some((option) => option.label === "?")).length).toBeLessThanOrEqual(2));
});

it("uses plain, non-judgemental wording", () => {
  const text = [...bodyQuestions, ...faceQuestions, ...skincareQuestions].flatMap((question) => [question.question, question.hint || "", ...question.options.map((option) => option.text)]).join(" ");
  expect(text).not.toMatch(/beautiful|flattering|sebum|morphology|anthropometric|acnes/i);
  // Jargon is explained once, not repeated on every question.
  expect(skincareQuestions.filter((question) => /T-zone/.test(question.hint || "")).length).toBe(1);
});
