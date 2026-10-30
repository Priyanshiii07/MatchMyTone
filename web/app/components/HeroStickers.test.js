import { fireEvent, render, screen } from "@testing-library/react";
import HeroStickers from "./HeroStickers";
import ModuleArt from "./ModuleArt";
import PaletteDemo from "./PaletteDemo";

it("builds the home hero from illustrated stickers, with no photographs", () => {
  // Arrange / Act
  const { container } = render(<HeroStickers />);
  // Assert
  expect(container.querySelectorAll("img")).toHaveLength(0);
  expect(container.querySelectorAll(".board-sticker svg.style-art").length).toBeGreaterThanOrEqual(6);
  expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
});

it.each(["menswear", "womenswear", "unisex"])("shows sticker art (not photos) on the face and body cards for %s", (catalog) => {
  const { container } = render(<><ModuleArt module="face" catalog={catalog} /><ModuleArt module="body" catalog={catalog} /></>);
  expect(container.querySelectorAll("img")).toHaveLength(0);
  expect(container.querySelectorAll(".sticker-pair .style-art")).toHaveLength(4);
});

it("recolours the demo stickers when another sample palette is chosen", () => {
  const { container } = render(<PaletteDemo />);
  expect(container.querySelectorAll("img")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Cool summer" }));
  expect(screen.getByRole("img", { name: "Shirt in Dusty rose" })).toBeInTheDocument();
});
