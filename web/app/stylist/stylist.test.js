import { act, fireEvent, render, screen, within } from "@testing-library/react";
import InspirationBoard from "../board/InspirationBoard";
import { ToastProvider } from "../components/Toaster";
import LookGenerator from "./LookGenerator";
import StylistChat from "./StylistChat";

const json = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body });
const wrap = (ui) => render(<ToastProvider>{ui}</ToastProvider>);

beforeEach(() => { window.sessionStorage.clear(); });

describe("AI stylist chat", () => {
  it("sends the conversation, shows the reply and follow-ups, and starts over", async () => {
    // Arrange
    global.fetch = jest.fn(() => json({ reply: "Try a navy overshirt.\n- Add loafers.", follow_ups: ["What shoes?"] }));
    render(<StylistChat module="body" />);
    // Act
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Give me three wedding outfit ideas" })); });
    // Assert
    expect(await screen.findByText("Try a navy overshirt.")).toBeInTheDocument();
    expect(screen.getByText("- Add loafers.")).toBeInTheDocument();
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("/api/stylist/chat");
    expect(JSON.parse(options.body)).toEqual({ messages: [{ role: "user", content: "Give me three wedding outfit ideas" }], module: "body_shape" });
    expect(screen.getByRole("button", { name: "What shoes?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /New conversation/ }));
    expect(screen.queryByText("Try a navy overshirt.")).not.toBeInTheDocument();
  });

  it("explains a failure and retries the same question", async () => {
    let calls = 0;
    global.fetch = jest.fn(() => { calls += 1; return calls === 1 ? json({ errorCode: "provider_temporary", retryable: true }, 503) : json({ reply: "Here is a simpler routine.", follow_ups: [] }); });
    render(<StylistChat module="skincare" />);
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "Simplify my routine" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Send/ })); });
    expect(await screen.findByRole("alert")).toHaveTextContent("Your stylist needs a moment. Please try again.");
    expect(screen.getByRole("alert").textContent).not.toMatch(/gemini|openai|503|provider|quota/i);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Try again" })); });
    expect(await screen.findByText("Here is a simpler routine.")).toBeInTheDocument();
    expect(JSON.parse(global.fetch.mock.calls[1][1].body).messages).toEqual([{ role: "user", content: "Simplify my routine" }]);
  });
});

it("doesn't offer a pointless retry when the day's AI allowance is used up", async () => {
  global.fetch = jest.fn(() => json({ errorCode: "provider_unavailable", retryable: false }, 503));
  render(<StylistChat module="body" />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Give me three wedding outfit ideas" })); });
  expect(await screen.findByRole("alert")).toHaveTextContent(/resting for now/);
  expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  expect(screen.getByText("Give me three wedding outfit ideas")).toBeInTheDocument();
});

describe("occasion look generator", () => {
  const palette = { results: { color_analysis: [{ id: "c1", colors_to_wear: [{ name: "Rust", hex: "#B7410E" }, { name: "Olive", hex: "#556B2F" }] }] } };
  const look = { title: "Office ease", occasion: "office", why: "Structured top balances the frame.", pieces: [{ item_id: "m-oxford", title: "Oxford shirts", art: "shirt", hex: "#B7410E" }, { item_id: "m-chinos", title: "Chinos", art: "trousers", hex: "#556B2F" }] };

  it("generates looks from the saved palette without colour chips, labels the source and saves to the board", async () => {
    global.fetch = jest.fn((url, options = {}) => {
      if (url === "/api/quiz/results") return json(palette);
      if (url === "/api/stylist/looks") return json({ looks: [look], source: "rules", notice: "Put together by our styling rules.", budget_note: "Budget filtering isn't available." });
      if (url === "/api/favorites" && options.method === "POST") return json({ favorite: {} }, 201);
      return json({});
    });
    wrap(<LookGenerator />);
    await screen.findByRole("heading", { name: "Dress me for…" });
    expect(screen.queryByText("Use my colours")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rust" })).not.toBeInTheDocument();
    ["Occasion", "Styling", "Focus", "Comfort & fit", "Budget"].forEach((label) => expect(screen.getByLabelText(label)).toBeInTheDocument());
    expect(screen.getByRole("option", { name: "My saved preference" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Mix of everything/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Budget"), { target: { value: "low" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Generate looks/ })); });
    const request = JSON.parse(global.fetch.mock.calls.find(([url]) => url === "/api/stylist/looks")[1].body);
    expect(request).toEqual({ occasion: "office", budget: "low" });
    expect(await screen.findByText(/Styling rules/)).toBeInTheDocument();
    expect(screen.getByText("Budget filtering isn't available.")).toBeInTheDocument();
    const card = screen.getByRole("heading", { name: "Office ease" }).closest("article");
    await act(async () => { fireEvent.click(within(card).getByRole("button", { name: /Save to board/ })); });
    const saved = JSON.parse(global.fetch.mock.calls.find(([url, options]) => url === "/api/favorites" && options?.method === "POST")[1].body);
    expect(saved.look.pieces).toEqual([{ item_id: "m-oxford", hex: "#B7410E" }, { item_id: "m-chinos", hex: "#556B2F" }]);
    expect(within(card).getByRole("button", { name: /Saved to board/ })).toBeDisabled();
    expect(await screen.findByText("Look saved to your inspiration board.")).toBeInTheDocument();
  });
});

describe("inspiration board", () => {
  const favorites = [
    { item_id: "look-1", kind: "look", title: "Weekend ease", look: { why: "Relaxed.", pieces: [{ item_id: "u-hoodie", title: "Hoodies", photo: "photos/u-hoodie.jpg" }, { item_id: "u-straight-denim", title: "Denim", photo: null }] }, created_at: "2026-10-27T10:00:00" },
    { item_id: "m-blazer", kind: "style", module: "body", category: "outerwear", title: "Blazers", photo: "photos/m-blazer.jpg", catalog: "menswear", result_id: "b1", created_at: "2026-10-27T10:00:00" },
    { item_id: "m-hair-quiff", kind: "style", module: "face", category: "hair", title: "Quiff", photo: null, catalog: "menswear", result_id: null, created_at: "2026-10-27T10:00:00" },
    { item_id: "plum-niacinamide-serum", kind: "product", module: "skincare", title: "Plum Serum", category: "Serum", photo: "plumserum.png", href: "https://plumgoodness.com/x", created_at: "2026-10-27T10:00:00" },
  ];

  function boardFetch({ failDelete = () => false } = {}) {
    return jest.fn((url, options = {}) => {
      if (url === "/api/favorites") return json({ favorites });
      if (url === "/api/quiz/results") return json({ results: { color_analysis: [{ id: "c1", season_type: "Deep Autumn", colors_to_wear: [{ name: "Rust", hex: "#B7410E" }], user_state: { shades: ["#B7410E", "#556B2F"] } }] } });
      if (options.method === "DELETE" || options.method === "PUT") return failDelete() ? json({}, 500) : json({});
      return json({});
    });
  }

  it("shows saved items as pins with category filters and correct Open targets", async () => {
    global.fetch = boardFetch();
    wrap(<InspirationBoard />);
    expect(await screen.findByRole("heading", { name: "Blazers" })).toBeInTheDocument();
    // Real photos where they exist, a branded placeholder (never an illustration) where they don't.
    expect(screen.getByRole("img", { name: "Blazers" })).toHaveAttribute("src", "/assets/photos/m-blazer.jpg");
    expect(screen.getByRole("img", { name: "Quiff (no photo available)" })).toBeInTheDocument();
    expect(within(screen.getByRole("heading", { name: "Blazers" }).closest("li")).getByRole("link", { name: "Open" })).toHaveAttribute("href", "/results/body-shape/b1");
    expect(within(screen.getByRole("heading", { name: "Rust" }).closest("li")).getByRole("link", { name: "Open" })).toHaveAttribute("href", "/results/color/c1");
    expect(within(screen.getByRole("heading", { name: "Plum Serum" }).closest("li")).getByRole("link", { name: /Open/ })).toHaveAttribute("href", "https://plumgoodness.com/x");
    // Filters
    expect(screen.getByRole("button", { name: /^All 6$/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /^Hair & grooming 1$/ }));
    expect(screen.getByRole("heading", { name: "Quiff" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Blazers" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Outfits 1$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("heading", { name: "Weekend ease", level: 2 })).toBeInTheDocument();
  });

  it("removes the right item, rolling back on failure, and removes shades through the result", async () => {
    let fail = true;
    global.fetch = boardFetch({ failDelete: () => fail });
    jest.useFakeTimers();
    wrap(<InspirationBoard />);
    await act(async () => { await Promise.resolve(); });
    await screen.findByRole("heading", { name: "Blazers" });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Remove Blazers from your board" })); });
    act(() => { jest.advanceTimersByTime(400); });
    expect(screen.getByRole("heading", { name: "Blazers" })).toBeInTheDocument();
    fail = false;
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Remove Blazers from your board" })); });
    act(() => { jest.advanceTimersByTime(400); });
    expect(screen.queryByRole("heading", { name: "Blazers" })).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith("/api/favorites/m-blazer", { method: "DELETE" });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Remove Rust from your board" })); });
    const put = global.fetch.mock.calls.find(([, options]) => options?.method === "PUT");
    expect(put[0]).toBe("/api/quiz/color-analysis/c1/progress");
    expect(JSON.parse(put[1].body)).toEqual({ shades: ["#556B2F"] });
    jest.useRealTimers();
  });

  it("shows an inviting empty state", async () => {
    global.fetch = jest.fn((url) => (url === "/api/favorites" ? json({ favorites: [] }) : json({ results: {} })));
    wrap(<InspirationBoard />);
    expect(await screen.findByText("Your board is waiting for its first pin")).toBeInTheDocument();
  });
});
