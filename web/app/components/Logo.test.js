import fs from "fs";
import path from "path";
import { fireEvent, render, screen } from "@testing-library/react";
import Logo, { LogoMark, SKIN_TONES } from "./Logo";
import SiteHeader from "./SiteHeader";

jest.mock("next/navigation", () => ({ usePathname: () => "/" }));

it("renders the emblem with every skin tone and a readable wordmark", () => {
  // Arrange / Act
  const { container } = render(<Logo />);
  // Assert
  expect(screen.getByText("My").closest(".logo-wordmark")).toHaveTextContent("MatchMyTone");
  SKIN_TONES.forEach((tone) => expect(container.querySelector(`circle[stroke="${tone}"]`)).not.toBeNull());
  expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
});

it("gives the icon-only mark an accessible name and unique clip ids", () => {
  const { container } = render(<><LogoMark title="MatchMyTone" /><LogoMark title="MatchMyTone" /></>);
  expect(screen.getAllByRole("img", { name: "MatchMyTone" })).toHaveLength(2);
  const ids = [...container.querySelectorAll("clipPath")].map((node) => node.id);
  expect(new Set(ids).size).toBe(2);
});

it("ships standalone SVG assets for the favicon and brand files", () => {
  const root = path.join(__dirname, "..", "..");
  ["public/brand/matchmytone-logo.svg", "public/brand/matchmytone-icon.svg", "app/icon.svg"].forEach((file) => {
    const svg = fs.readFileSync(path.join(root, file), "utf8");
    expect(svg).toMatch(/^<svg[^>]+xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(svg).toContain("<title>MatchMyTone</title>");
    SKIN_TONES.forEach((tone) => expect(svg).toContain(tone));
  });
});

it("shows the logo in the header and a working mobile menu", () => {
  render(<SiteHeader />);
  expect(screen.getByRole("link", { name: "MatchMyTone home" })).toHaveAttribute("href", "/");
  const toggle = screen.getByRole("button", { name: "Open menu" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(toggle);
  const menu = screen.getByRole("navigation", { name: "Mobile navigation" });
  expect(menu).toHaveTextContent("Register");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).not.toBeInTheDocument();
});
