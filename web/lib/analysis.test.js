import { faceQuestions, scoreShapes } from "./analysis";

it("gives the same face shape for the same answers in any answering order", () => {
  // Arrange: the first option of every question ties Heart and Round 3–3.
  const entries = faceQuestions.map((question) => [question.id, question.options[0]]);
  // Act
  const forward = scoreShapes(Object.fromEntries(entries), "face");
  const reversed = scoreShapes(Object.fromEntries([...entries].reverse()), "face");
  // Assert
  expect(forward).toBe(reversed);
  expect(forward).toBe("Round");
});

it("still picks the clear winner", () => {
  expect(scoreShapes({ a: { shapes: ["Pear"] }, b: { shapes: ["Pear"] }, c: { shapes: ["Apple"] } })).toBe("Pear");
});
