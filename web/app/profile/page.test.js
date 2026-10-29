import { fireEvent, render, screen } from "@testing-library/react";
import SiteHeader from "../components/SiteHeader";
import { navigateTo } from "../../lib/browser";
import ProfilePage from "./page";

jest.mock("../../lib/browser", () => ({ navigateTo: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), usePathname: () => "/profile" }));

const user = { name: "Asha Rao", email: "asha@example.com", phone: "9876543210", gender: "female", dob: "1994-02-01", age: 32 };

beforeEach(() => { global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ user }) }); });

it("shows grouped profile details with Edit and Back but no Logout control", async () => {
  // Act
  render(<ProfilePage />);
  // Assert
  expect(await screen.findByRole("heading", { name: "Asha Rao" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /edit profile/i })).toHaveAttribute("href", "/profile/edit");
  expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  expect(screen.getByText("Female")).toBeInTheDocument();
  const main = screen.getByRole("main");
  const logoutControls = [...main.querySelectorAll("a, button")].filter((element) => /log\s*out/i.test(element.textContent) && !element.closest(".site-header"));
  expect(logoutControls).toHaveLength(0);
});

it("prompts to complete an incomplete profile", async () => {
  global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ user: { name: "New User", email: "n@example.com" } }) });
  render(<ProfilePage />);
  expect(await screen.findByText(/complete your profile/i)).toBeInTheDocument();
  expect(screen.getAllByText("Not added yet").length).toBeGreaterThan(0);
});

it("keeps Logout in the global header and clears the session through the API", async () => {
  // Arrange
  global.fetch.mockResolvedValue({ ok: true, status: 200 });
  render(<SiteHeader authenticated />);
  // Act
  fireEvent.click(screen.getByRole("button", { name: "Logout" }));
  // Assert
  await screen.findByRole("button", { name: /logging out/i });
  expect(global.fetch).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(navigateTo).toHaveBeenCalledWith("/login");
  expect(screen.getByRole("link", { name: "Results" })).toHaveAttribute("href", "/results");
  expect(screen.getByRole("link", { name: "Open profile" })).toHaveAttribute("href", "/profile");
});
