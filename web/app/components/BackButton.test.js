import { fireEvent, render, screen } from "@testing-library/react";
import { NAV_STORAGE_KEY } from "../../lib/navigation";
import BackButton from "./BackButton";

const router = { back: jest.fn(), push: jest.fn() };
jest.mock("next/navigation", () => ({ useRouter: () => router }));

function visit(path, history) {
  window.history.pushState({}, "", path);
  window.sessionStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(history));
}

beforeEach(() => { jest.clearAllMocks(); window.sessionStorage.clear(); });

it("uses browser history when the previous page is a safe in-app page", () => {
  // Arrange
  visit("/results", ["/dashboard", "/results"]);
  render(<BackButton fallback="/dashboard" />);
  // Act
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  // Assert
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(router.push).not.toHaveBeenCalled();
});

it("falls back for a direct deep link", () => {
  visit("/results/color/abc", ["/results/color/abc"]);
  render(<BackButton fallback="/results" />);
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(router.push).toHaveBeenCalledWith("/results");
  expect(router.back).not.toHaveBeenCalled();
});

it("falls back instead of returning an app page to login", () => {
  visit("/dashboard", ["/login", "/dashboard"]);
  render(<BackButton fallback="/" />);
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(router.push).toHaveBeenCalledWith("/");
});

it("asks before leaving unsaved work and stays when cancelled", () => {
  visit("/profile/edit", ["/profile", "/profile/edit"]);
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  render(<BackButton fallback="/profile" confirmLeave={() => "You have unsaved changes."} />);
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(confirm).toHaveBeenCalledWith("You have unsaved changes.");
  expect(router.back).not.toHaveBeenCalled();
  expect(router.push).not.toHaveBeenCalled();
  confirm.mockRestore();
});

it("does not ask when there is nothing to lose", () => {
  visit("/profile/edit", ["/profile", "/profile/edit"]);
  const confirm = jest.spyOn(window, "confirm");
  render(<BackButton fallback="/profile" confirmLeave={() => null} />);
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(confirm).not.toHaveBeenCalled();
  expect(router.back).toHaveBeenCalled();
  confirm.mockRestore();
});
