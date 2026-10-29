import { act, fireEvent, render, screen } from "@testing-library/react";
import { navigateTo } from "../../lib/browser";
import QuizRunner from "./QuizRunner";

jest.mock("../../lib/browser", () => ({ navigateTo: jest.fn() }));

jest.mock("next/navigation", () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), usePathname: () => "/analyses/face-shape" }));
jest.mock("../../lib/analysis", () => ({ ...jest.requireActual("../../lib/analysis"), shuffle: (items) => items }));

const questions = [
  { id: "Q1", question: "First question?", options: [{ label: "A", text: "Alpha", shapes: ["Oval"] }, { label: "B", text: "Beta", shapes: ["Round"] }, { label: "?", text: "Not sure", shapes: [] }] },
  { id: "Q2", question: "Second question?", options: [{ label: "A", text: "Gamma", shapes: ["Heart"] }, { label: "B", text: "Delta", shapes: ["Square"] }] },
];

beforeEach(() => {
  navigateTo.mockClear();
  global.crypto.randomUUID = () => "rid-1";
});

it("selects an answer, asks for one before continuing, and keeps it when going back", () => {
  // Arrange
  render(<QuizRunner module="face" title="Face" questions={questions} resultPath="/analyses/face-shape/result" />);
  // Act: Continue without choosing
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  // Assert
  expect(screen.getByRole("status")).toHaveTextContent(/Choose the answer that fits best/);
  expect(screen.getByRole("heading", { name: "First question?" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: /Beta/ }));
  expect(screen.getByRole("radio", { name: /Beta/ })).toHaveAttribute("aria-checked", "true");
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  expect(screen.getByRole("heading", { name: "Second question?" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Previous question/ }));
  expect(screen.getByRole("radio", { name: /Beta/ })).toHaveAttribute("aria-checked", "true");
});

it("supports arrow keys and finishes with the chosen answers", async () => {
  render(<QuizRunner module="face" title="Face" questions={questions} resultPath="/analyses/face-shape/result" />);
  fireEvent.click(screen.getByRole("radio", { name: /Alpha/ }));
  fireEvent.keyDown(screen.getByRole("radio", { name: /Alpha/ }), { key: "ArrowDown" });
  expect(screen.getByRole("radio", { name: /Beta/ })).toHaveAttribute("aria-checked", "true");
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  fireEvent.click(screen.getByRole("radio", { name: /Gamma/ }));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /See my results/ })); });
  const url = new URL(navigateTo.mock.calls[0][0], "http://localhost");
  expect(url.pathname).toBe("/analyses/face-shape/result");
  expect(JSON.parse(url.searchParams.get("answers"))).toEqual({ Q1: questions[0].options[1], Q2: questions[1].options[0] });
  expect(url.searchParams.get("rid")).toBe("rid-1");
});
