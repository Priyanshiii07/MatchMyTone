import { act, fireEvent, render, screen, within } from "@testing-library/react";
import fixtures from "../../lib/__fixtures__/styling.json";
import BodyResultView from "./BodyResultView";
import ChoiceChips from "./ChoiceChips";
import FaceResultView from "./FaceResultView";
import ModuleArt from "./ModuleArt";
import ResultView from "./ResultView";
import { FavoritesProvider } from "./useStyling";

const WOMENSWEAR_TITLES = /off-shoulder|fit-and-flare|flared trousers|cropped jackets|boat-neck|bodycon|saree|lehenga/i;

function okJson(body, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: async () => body });
}

function bodyDoc(styling, extra = {}) {
  return { id: "body-1", result: "Pear", answers: {}, confidence: { level: "clear", alternatives: [], answered: 8 }, styling, ...extra };
}

function renderWithFavorites(ui) {
  return render(<FavoritesProvider resultId="body-1">{ui}</FavoritesProvider>);
}

// Routes the requests made by result pages: favorites, trends (reported unavailable) and anything else.
function routedFetch(handler = () => okJson({})) {
  return jest.fn((url, options) => {
    if (String(url).startsWith("/api/favorites")) return okJson({ favorites: [] });
    if (String(url).endsWith("/trends")) return okJson({ status: "unavailable" }, 503);
    return handler(url, options);
  });
}

beforeEach(() => { global.fetch = routedFetch(); });

describe("Body Analysis styling guide", () => {
  it("shows a men's wardrobe with no womenswear for a men's catalog", async () => {
    // Arrange / Act
    renderWithFavorites(<BodyResultView doc={bodyDoc(fixtures.bodyMen)} />);
    // Assert
    expect(await screen.findByRole("heading", { name: "Triangle (Pear)" })).toBeInTheDocument();
    ["Crew-neck T-shirts", "Straight-fit jeans", "Blazers", "Kurtas", "Loafers"].forEach((title) => expect(screen.getByRole("heading", { name: title })).toBeInTheDocument());
    const cards = screen.getAllByRole("article");
    cards.forEach((card) => expect(card.textContent).not.toMatch(WOMENSWEAR_TITLES));
    expect(screen.queryByRole("button", { name: /^Dresses & one-pieces/ })).not.toBeInTheDocument();
    // Men's results use a neutral outline, never the women's figure illustration.
    expect(screen.getByRole("img", { name: "Pear body shape outline" })).toBeInTheDocument();
  });

  it("shows women's pieces with matching photos for a women's catalog", async () => {
    renderWithFavorites(<BodyResultView doc={bodyDoc(fixtures.bodyWomen)} />);
    const card = (await screen.findByRole("heading", { name: "Off-shoulder tops" })).closest("article");
    expect(within(card).getByRole("img", { name: "Off-shoulder tops" })).toHaveAttribute("src", "/assets/offshouldertop.jpg");
    expect(screen.getByRole("button", { name: /^Dresses & one-pieces/ })).toBeInTheDocument();
  });

  it("filters by category and occasion, with an empty state", async () => {
    renderWithFavorites(<BodyResultView doc={bodyDoc(fixtures.bodyMen)} />);
    await screen.findByRole("heading", { name: "Blazers" });
    // Act: category filter
    fireEvent.click(screen.getByRole("button", { name: /^Footwear \d+$/ }));
    // Assert
    expect(screen.getByRole("heading", { name: "Loafers" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Blazers" })).not.toBeInTheDocument();
    // Options that would show nothing are disabled up front.
    expect(screen.getByRole("option", { name: /^Weddings/ })).toBeDisabled();
    // Act: force an empty combination anyway
    fireEvent.change(screen.getByLabelText(/^Occasion/), { target: { value: "wedding" } });
    expect(screen.getByRole("heading", { name: "No ideas match Footwear + Weddings" })).toBeInTheDocument();
    expect(screen.getByText(/You have 18 recommendations in total/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByRole("heading", { name: "Sherwanis" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^All \d+$/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the user's own palette shades on each card", async () => {
    renderWithFavorites(<BodyResultView doc={bodyDoc(fixtures.bodyMen)} />);
    const card = (await screen.findByRole("heading", { name: "Blazers" })).closest("article");
    const expected = fixtures.bodyMen.items.find((item) => item.id === "m-blazer").colors.map((color) => color.hex);
    expected.forEach((hex) => expect(within(card).getByText(new RegExp(hex))).toBeInTheDocument());
  });

  it("saves a favorite through the API and reflects the state", async () => {
    renderWithFavorites(<BodyResultView doc={bodyDoc(fixtures.bodyMen)} />);
    const save = await screen.findByRole("button", { name: "Save Blazers" });
    await act(async () => { fireEvent.click(save); });
    expect(global.fetch).toHaveBeenCalledWith("/api/favorites", expect.objectContaining({ method: "POST", body: JSON.stringify({ item_id: "m-blazer", result_id: "body-1" }) }));
    expect(screen.getByRole("button", { name: "Remove Blazers from saved styles" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Result pages without the styling catalog", () => {
  const CATALOG_UI = /Styling catalog|Edit preferences|Refresh with my current preferences|Mix of everything|Which styling ideas would you like/;

  it("shows the saved catalog's recommendations with no catalog controls", async () => {
    render(<ResultView kind="body" doc={bodyDoc(fixtures.bodyMen)} />);
    expect(await screen.findByRole("heading", { name: "Blazers" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(CATALOG_UI);
    expect(screen.queryByRole("button", { name: "Women's styling" })).not.toBeInTheDocument();
  });

  it("keeps neutral recommendations for users without a preference, without forcing a choice", async () => {
    render(<ResultView kind="body" doc={bodyDoc(fixtures.bodyNeedsChoice)} />);
    expect(await screen.findByRole("heading", { name: "Your personal styling guide" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(CATALOG_UI);
    screen.getAllByRole("article").forEach((card) => expect(card.textContent).not.toMatch(WOMENSWEAR_TITLES));
  });

  it("has no catalog controls on face and color results either", async () => {
    const { unmount } = render(<ResultView kind="face" doc={{ id: "f0", result: "Round", styling: fixtures.faceMen }} />);
    await screen.findByRole("heading", { name: "Recommended for you" });
    expect(document.body.textContent).not.toMatch(CATALOG_UI);
    unmount();
    render(<ResultView kind="color" doc={{ id: "c0", season_type: "Deep Autumn", colors_to_wear: [{ name: "Rust", hex: "#B7410E" }], colors_to_avoid: [], styling: fixtures.colorMen }} />);
    await screen.findByRole("heading", { name: "Outfit color combinations" });
    expect(document.body.textContent).not.toMatch(CATALOG_UI);
  });
});

describe("Face Analysis styling", () => {
  it("never offers beard or moustache styling, even for results saved with beard ideas", async () => {
    // Arrange: a result saved before the feature was retired still carries beard cards and a prompt.
    const legacy = { ...fixtures.faceMen, beard: [{ id: "beard-boxed", title: "Short boxed beard", group: "beard", why: "Old idea", reasons: [], colors: [] }], beard_prompt: true };
    // Act
    const { unmount } = renderWithFavorites(<FaceResultView doc={{ id: "f1", result: "Round", styling: legacy }} />);
    // Assert
    expect(await screen.findByRole("heading", { name: "Recommended for you" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Beard & moustache styling" })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/beard|moustache/i);
    expect(screen.getAllByText("Suits the hair texture you told us").length).toBeGreaterThan(0);
    unmount();
    renderWithFavorites(<FaceResultView doc={{ id: "f2", result: "Round", styling: fixtures.faceMenPrompt }} />);
    expect(await screen.findByText(/Tell us your hair texture/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/beard|moustache|upkeep you/i);
  });

  it("never shows a makeup section on face results, even when makeup ideas were saved", async () => {
    renderWithFavorites(<FaceResultView doc={{ id: "f3", result: "Heart", styling: fixtures.faceWomenMakeup }} />);
    expect(await screen.findByRole("heading", { name: "Recommended for you" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Makeup color ideas/ })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Lips|Cheeks|Liner/);
    expect(screen.queryByText(/Want beard or moustache ideas\?/)).not.toBeInTheDocument();
  });
});

describe("Preference chips", () => {
  it("supports single choice with clearing, and multiple choice", () => {
    const onChange = jest.fn();
    const { rerender } = render(<ChoiceChips field="catalog" value="unisex" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Men's styling" }));
    expect(onChange).toHaveBeenLastCalledWith("menswear");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(screen.queryByRole("radio", { name: /Mix of everything/ })).not.toBeInTheDocument();
    rerender(<ChoiceChips field="occasions" value={["office"]} onChange={onChange} />);
    expect(screen.getAllByRole("checkbox").map((box) => box.closest("label").textContent)).toEqual(["Everyday", "College", "Office", "Festive"]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Festive" }));
    expect(onChange).toHaveBeenLastCalledWith(["office", "festive"]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Office" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});

it("dashboard body art follows the chosen catalog instead of a default women's figure", () => {
  const { container, rerender } = render(<ModuleArt module="body" catalog="menswear" />);
  const menMarkup = container.innerHTML;
  rerender(<ModuleArt module="body" catalog="womenswear" />);
  expect(container.innerHTML).not.toEqual(menMarkup);
});
