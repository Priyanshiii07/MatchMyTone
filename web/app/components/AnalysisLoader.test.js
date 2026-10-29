import { act, render, screen } from "@testing-library/react";
import { analysisErrorMessage } from "../../lib/colorMessages";
import AnalysisLoader, { LOADER_MESSAGES } from "./AnalysisLoader";

const TECHNICAL = /gemini|openai|gpt|model|provider|api|503|429|quota|status|error code/i;

it("never mentions providers, models or status codes in any loading message", () => {
  Object.values(LOADER_MESSAGES).flat().forEach((message) => expect(message).not.toMatch(TECHNICAL));
});

it("rotates friendly messages without percentages or countdowns", () => {
  // Arrange
  jest.useFakeTimers();
  render(<AnalysisLoader module="color" interval={1000} />);
  // Act / Assert
  expect(screen.getByRole("status")).toHaveTextContent("Your colors are being discovered…");
  act(() => { jest.advanceTimersByTime(1000); });
  expect(screen.getByRole("status")).toHaveTextContent("Finding the shades that suit you…");
  expect(screen.getByRole("status").textContent).not.toMatch(/\d+\s*%|\d+\s*s(ec)?\b/);
  jest.useRealTimers();
});

it("uses module-specific wording", () => {
  render(<AnalysisLoader module="skincare" />);
  expect(screen.getByRole("status")).toHaveTextContent(/skin/i);
});

it("maps every backend error code to friendly copy without technical details", () => {
  const codes = ["provider_temporary", "provider_malformed", "provider_unavailable", "provider_configuration", "analysis_in_progress", "persistence_failed", "database_unavailable", "invalid_image", "something_new"];
  codes.forEach((errorCode) => {
    const message = analysisErrorMessage({ errorCode, error: "Gemini model 'x' returned 503" });
    expect(message).not.toMatch(TECHNICAL);
    expect(message.length).toBeGreaterThan(20);
  });
  expect(analysisErrorMessage({ errorCode: "provider_temporary" })).toMatch(/selfie is saved on this page/);
  expect(analysisErrorMessage({ errorCode: "provider_temporary", retryAfterSeconds: 7 })).toMatch(/about 7 seconds/);
});
