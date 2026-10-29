import { act, fireEvent, render, screen } from "@testing-library/react";
import VerifyEmail from "./VerifyEmail";

const TOKEN = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";

function respond(ok, status, data) {
  global.fetch = jest.fn(() => Promise.resolve({ ok, status, json: async () => data }));
}

beforeEach(() => { window.history.replaceState(null, "", `/verify-email#token=${TOKEN}`); });

it("reads the token from the fragment, confirms it once with a POST and removes it from the address bar", async () => {
  // Arrange
  respond(true, 200, { message: "Email verified. You can now log in.", status: "verified" });
  // Act
  render(<VerifyEmail />);
  // Assert
  expect(await screen.findByRole("heading", { name: "Email verified." })).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch.mock.calls[0][0]).toBe("/api/auth/verify-email");
  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ token: TOKEN });
  expect(window.location.hash).toBe("");
  expect(screen.getByRole("link", { name: /Go to login/ })).toHaveAttribute("href", "/login");
});

it.each([
  [false, 410, { errorCode: "token_expired", error: "This verification link has expired." }, "This link has expired."],
  [false, 400, { errorCode: "invalid_token", error: "This verification link is invalid." }, "This link isn't valid."],
  [false, 409, { errorCode: "token_superseded", error: "A newer verification link has been sent." }, "This link isn't valid."],
  [true, 200, { status: "already_verified", message: "This link has already been used and your email is verified." }, "Email already verified."],
  [false, 503, { errorCode: "database_unavailable", error: "The database is temporarily unavailable." }, "Verification is temporarily unavailable."],
])("shows a clear state for %s %s responses", async (ok, status, data, heading) => {
  respond(ok, status, data);
  render(<VerifyEmail />);
  expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/token_|errorCode|database/);
});

it("accepts older ?token= links and offers a new link when one has expired", async () => {
  window.history.replaceState(null, "", "/verify-email");
  global.fetch = jest.fn((url) => Promise.resolve(url === "/api/auth/verify-email"
    ? { ok: false, status: 410, json: async () => ({ errorCode: "token_expired", error: "This verification link has expired." }) }
    : { ok: true, status: 200, json: async () => ({ message: "If that email belongs to an account that still needs verifying, we've sent a new link." }) }));
  render(<VerifyEmail token={TOKEN} />);
  await screen.findByRole("heading", { name: "This link has expired." });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "ravi@example.com" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Send a new verification link/ })); });
  expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toEqual({ email: "ravi@example.com" });
  expect(screen.getByText(/we've sent a new link/)).toBeInTheDocument();
});

it("does not call the API when the link has no token", () => {
  window.history.replaceState(null, "", "/verify-email");
  global.fetch = jest.fn();
  render(<VerifyEmail />);
  expect(screen.getByRole("heading", { name: "This link isn't valid." })).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});
