import { fireEvent, render, screen, within } from "@testing-library/react";
import fixtures from "../../lib/__fixtures__/styling.json";
import ColorResultView, { normalizeColors } from "./ColorResultView";
import { determineSkinType } from "../../lib/skincare";

const result = {
  seasonType: "Deep Autumn", seasonDescription: "Rich and warm.", undertone: "Warm", undertoneDescription: "Golden.", skinAge: 32,
  colorsToWear: ["Terracotta #C2593F", "Deep Teal #005F60", "Olive #6B705C", "Bronze #8C5E34", "Burgundy #6B1D2F", "Mustard #E3A857"].map((entry) => ({ name: entry.split(" #")[0], hex: `#${entry.split(" #")[1]}` })),
  colorsToAvoid: [{ name: "Baby Blue", hex: "#AFDBF5" }, { name: "Neon Pink", hex: "#FF1493" }, { name: "Lavender", hex: "#E6E6FA" }],
};

it("shows accessible swatches and switches between wear, avoid and all", () => {
  // Arrange
  render(<ColorResultView result={result} />);
  const swatches = () => within(screen.getByRole("list", { name: "Color swatches" })).getAllByRole("button");
  // Assert
  expect(swatches()).toHaveLength(6);
  expect(screen.getByRole("button", { name: "Terracotta, #C2593F, recommended" })).toHaveAttribute("aria-pressed", "true");
  // Act
  fireEvent.click(screen.getByRole("button", { name: "To avoid (3)" }));
  expect(swatches()).toHaveLength(3);
  expect(screen.getByRole("button", { name: "Neon Pink, #FF1493, best avoided near the face" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "All (9)" }));
  expect(swatches()).toHaveLength(9);
});

it("selects a shade, then compares up to three shades with text labels", () => {
  render(<ColorResultView result={result} />);
  fireEvent.click(screen.getByRole("button", { name: /Deep Teal/ }));
  expect(screen.getByRole("heading", { name: "Deep Teal" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add to compare" }));
  const tray = screen.getByLabelText("Compared shades");
  expect(within(tray).getByText(/#005F60 · Wear/)).toBeInTheDocument();
  ["Olive", "Bronze", "Burgundy"].forEach((name) => { fireEvent.click(screen.getByRole("button", { name: new RegExp(name) })); fireEvent.click(screen.getByRole("button", { name: "Add to compare" })); });
  expect(within(tray).queryByText(/Deep Teal/)).not.toBeInTheDocument();
  expect(tray.querySelectorAll(".compare-item")).toHaveLength(3);
});

it("neutralises invalid stored hex values instead of injecting them into styles", () => {
  expect(normalizeColors([{ name: "Bad", hex: "red; background:url(x)" }], "wear")[0]).toMatchObject({ hex: "#D9D2C5", valid: false });
});

it("applies the same palette to men's and women's outfits without changing the swatches", () => {
  // Arrange / Act
  const { rerender } = render(<ColorResultView result={result} styling={fixtures.colorMen} onRestyle={jest.fn()} />);
  // Assert: men's outfits use only the analysed colors.
  expect(screen.getByRole("heading", { name: "Festive Indian" })).toBeInTheDocument();
  expect(screen.getByText("Nehru jacket")).toBeInTheDocument();
  expect(screen.getByText("Tie")).toBeInTheDocument();
  const palette = fixtures.colorMen.outfits.flatMap((outfit) => outfit.pieces.map((piece) => piece.hex));
  palette.forEach((hex) => expect(["#C2593F", "#005F60", "#6B705C", "#F3E9D2", "#6B1D2F", "#E3A857"]).toContain(hex));
  const swatchesBefore = within(screen.getByRole("list", { name: "Color swatches" })).getAllByRole("button").map((button) => button.getAttribute("aria-label"));
  // Act: switch catalog (display only)
  rerender(<ColorResultView result={result} styling={fixtures.colorWomen} onRestyle={jest.fn()} />);
  expect(screen.getByText("Saree, lehenga or kurta")).toBeInTheDocument();
  expect(screen.queryByText("Nehru jacket")).not.toBeInTheDocument();
  expect(within(screen.getByRole("list", { name: "Color swatches" })).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(swatchesBefore);
  expect(screen.getByText(/General undertone guidance/)).toBeInTheDocument();
});

it("filters outfit combinations by occasion", () => {
  render(<ColorResultView result={result} styling={fixtures.colorMen} onRestyle={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Office" }));
  expect(screen.getByRole("heading", { name: "Office & business" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Festive Indian" })).not.toBeInTheDocument();
});

it("still renders older results that have no styling", () => {
  render(<ColorResultView result={result} />);
  expect(screen.queryByRole("heading", { name: "Outfit color combinations" })).not.toBeInTheDocument();
  expect(determineSkinType({ 1: { label: "E" }, 2: { label: "E" }, 3: { label: "B" } })).toBe("E");
});
