import { act, fireEvent, render, screen } from "@testing-library/react";
import AuthCard from "./AuthCard";

function fill(label, value) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function completeRequiredFields() {
  fill("Username / full name", "Ravi Kumar");
  fill("Email address", "ravi@example.com");
  fill("Phone number", "9876543210");
  fill("Date of birth", "1995-05-05");
  fill("Password", "ValidPass!123");
  fill("Confirm password", "ValidPass!123");
}

beforeEach(() => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 201, json: async () => ({ message: "Registration successful." }) }));
});

it("registers without asking for gender and sends an optional styling choice", async () => {
  // Arrange
  render(<AuthCard mode="signup" />);
  completeRequiredFields();
  // Only the three styling choices are offered.
  expect(screen.getAllByRole("radio").map((radio) => radio.closest("label").textContent)).toEqual(["Men's styling", "Women's styling", "Unisex"]);
  fireEvent.click(screen.getByRole("radio", { name: "Unisex" }));
  // Act
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Register/ })); });
  // Assert
  const body = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(body).not.toHaveProperty("gender");
  expect(body.style_preferences).toEqual({ catalog: "unisex" });
  expect(await screen.findByText("Registration successful.")).toBeInTheDocument();
});

it("keeps gender and styling as separate choices", async () => {
  render(<AuthCard mode="signup" />);
  completeRequiredFields();
  fireEvent.change(screen.getByLabelText(/^Gender/), { target: { value: "male" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Register/ })); });
  const body = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(body.gender).toBe("male");
  expect(body).not.toHaveProperty("style_preferences");
});

it("offers a rate-limit-aware resend when login is refused for an unverified email", async () => {
  // Arrange
  global.fetch = jest.fn((url) => Promise.resolve(url === "/api/auth/login"
    ? { ok: false, status: 403, json: async () => ({ error: "Please verify your email before logging in.", requires_verification: true }) }
    : { ok: false, status: 429, json: async () => ({ error: "A verification email was sent recently. Please wait a little before asking for another." }) }));
  render(<AuthCard mode="login" />);
  fill("Email address", "ravi@example.com");
  fill("Password", "ValidPass!123");
  // Act
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Log in/ })); });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Resend verification email" })); });
  // Assert
  const [url, options] = global.fetch.mock.calls[1];
  expect(url).toBe("/api/auth/resend-verification");
  expect(JSON.parse(options.body)).toEqual({ email: "ravi@example.com" });
  expect(screen.getByText(/sent recently/)).toBeInTheDocument();
});

it("never shows the resend option for an ordinary failed login", async () => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 401, json: async () => ({ error: "Invalid email or password." }) }));
  render(<AuthCard mode="login" />);
  fill("Email address", "ravi@example.com");
  fill("Password", "WrongPass!123");
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Log in/ })); });
  expect(screen.getByText("Invalid email or password.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Resend verification email" })).not.toBeInTheDocument();
});

it("reports a verification email that couldn't be sent as a problem, with a way to retry", async () => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 201, json: async () => ({ message: "Your account was created, but we couldn't send the verification email just now.", requires_verification: true, verification_email_sent: false }) }));
  render(<AuthCard mode="signup" />);
  completeRequiredFields();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Register/ })); });
  expect(document.querySelector(".form-error").textContent).toMatch(/couldn't send/);
  expect(document.querySelector(".form-success")).toBeNull();
  expect(screen.getByRole("button", { name: "Resend verification email" })).toBeInTheDocument();
});
