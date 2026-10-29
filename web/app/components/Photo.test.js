import { render, screen } from "@testing-library/react";
import Photo from "./Photo";

it("shows the photo without a visible credit caption (credits live on /credits)", () => {
  // Arrange / Act
  const { container } = render(<Photo src="photos/m-shirt.jpg" alt="Oxford shirt" />);
  // Assert
  expect(screen.getByRole("img", { name: "Oxford shirt" })).toHaveAttribute("src", "/assets/photos/m-shirt.jpg");
  expect(container.textContent).toBe("");
  expect(container.querySelector(".photo-credit")).toBeNull();
});
