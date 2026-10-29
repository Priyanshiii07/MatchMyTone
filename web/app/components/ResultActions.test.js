import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ResultActions, { filenameFromDisposition } from "./ResultActions";

function pdfResponse(headers = {}) {
  return { ok: true, status: 200, headers: { get: (name) => ({ "content-type": "application/pdf", "content-disposition": 'attachment; filename="MatchMyTone-Color-Analysis.pdf"', ...headers })[name.toLowerCase()] }, blob: async () => new Blob(["%PDF-1.4"], { type: "application/pdf" }) };
}

beforeEach(() => {
  jest.useFakeTimers();
  global.fetch = jest.fn();
  URL.createObjectURL = jest.fn(() => "blob:summary");
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

it("downloads the PDF from the color-analysis endpoint and confirms only afterwards", async () => {
  // Arrange
  global.fetch.mockResolvedValue(pdfResponse());
  render(<ResultActions resultType="color-analysis" resultId="abc" restart={{ href: "/analyses/color", label: "Analyse another selfie" }} />);
  // Act
  fireEvent.click(screen.getByRole("button", { name: /download summary/i }));
  // Assert
  expect(await screen.findByText("Downloaded MatchMyTone-Color-Analysis.pdf")).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith("/api/quiz/color-analysis/abc/pdf", { cache: "no-store" });
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  act(() => { jest.advanceTimersByTime(60000); });
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:summary");
});

it("shows a friendly error with a working retry when generation fails", async () => {
  global.fetch.mockResolvedValueOnce({ ok: false, status: 500, headers: { get: () => null } }).mockResolvedValueOnce(pdfResponse());
  render(<ResultActions resultType="skincare" resultId="s1" />);
  fireEvent.click(screen.getByRole("button", { name: /download summary/i }));
  expect(await screen.findByText(/couldn't create your summary/i)).toBeInTheDocument();
  expect(screen.queryByText(/Downloaded/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText(/Downloaded/)).toBeInTheDocument();
});

it("asks the user to log in again when the session expired", async () => {
  global.fetch.mockResolvedValue({ ok: false, status: 401, headers: { get: () => null } });
  render(<ResultActions resultType="face-shape" resultId="f1" />);
  fireEvent.click(screen.getByRole("button", { name: /download summary/i }));
  expect(await screen.findByText(/session has ended/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", expect.stringContaining("/login?next="));
});

it("rejects a non-PDF response instead of claiming success", async () => {
  global.fetch.mockResolvedValue({ ...pdfResponse({ "content-type": "text/html" }), blob: async () => new Blob(["<html>"], { type: "text/html" }) });
  render(<ResultActions resultType="body-shape" resultId="b1" />);
  fireEvent.click(screen.getByRole("button", { name: /download summary/i }));
  expect(await screen.findByText(/couldn't create your summary/i)).toBeInTheDocument();
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
});

it("disables download while busy and while the result is still saving", async () => {
  let resolve;
  global.fetch.mockReturnValue(new Promise((done) => { resolve = done; }));
  const { rerender } = render(<ResultActions resultType="skincare" resultId="" pending />);
  expect(screen.getByRole("button", { name: /saving your result/i })).toBeDisabled();
  rerender(<ResultActions resultType="skincare" resultId="s1" />);
  fireEvent.click(screen.getByRole("button", { name: /download summary/i }));
  expect(screen.getByRole("button", { name: /preparing pdf/i })).toBeDisabled();
  await act(async () => { resolve(pdfResponse()); });
  await waitFor(() => expect(screen.getByRole("button", { name: /download summary/i })).toBeEnabled());
});

it("offers restart and dashboard as separate secondary actions", () => {
  render(<ResultActions resultType="body-shape" resultId="b1" restart={{ href: "/analyses/body-shape", label: "Retake body quiz" }} />);
  expect(screen.getByRole("link", { name: /retake body quiz/i })).toHaveAttribute("href", "/analyses/body-shape");
  expect(screen.getByRole("link", { name: /back to dashboard/i })).toHaveAttribute("href", "/dashboard");
});

it("derives a safe filename", () => {
  expect(filenameFromDisposition('attachment; filename="MatchMyTone-Skincare-Analysis.pdf"', "skincare")).toBe("MatchMyTone-Skincare-Analysis.pdf");
  expect(filenameFromDisposition(null, "face-shape")).toBe("MatchMyTone-Face-Shape-Analysis.pdf");
  expect(filenameFromDisposition('attachment; filename="../../evil.pdf"', "skincare")).toBe("....evil.pdf");
});
