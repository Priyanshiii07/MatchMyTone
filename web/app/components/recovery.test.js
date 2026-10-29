import { act, fireEvent, render, screen, within } from "@testing-library/react";
import fixtures from "../../lib/__fixtures__/styling.json";
import { harmonies } from "../../lib/color";
import { hasRecommendations } from "../../lib/results";
import QuizResult from "./QuizResult";
import ResultView from "./ResultView";
import TrendsPanel from "./TrendsPanel";

jest.mock("next/navigation", () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), usePathname: () => "/" }));

const plan = fixtures.skincareShaving;
const oilyAnswers = Object.fromEntries(Array.from({ length: 10 }, (_, index) => [index + 1, { label: "A", text: "Oily" }]));
const json = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body });

function router(routes) {
  return jest.fn((url, options = {}) => {
    const key = `${options.method || "GET"} ${String(url).split("?")[0]}`;
    const match = Object.entries(routes).find(([pattern]) => key === pattern || (pattern.endsWith("*") && key.startsWith(pattern.slice(0, -1))));
    return match ? match[1](url, options) : json({ status: "unavailable" }, 503);
  });
}

describe("incomplete results never show success", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", `/analyses/skincare/result?answers=${encodeURIComponent(JSON.stringify(oilyAnswers))}&rid=req-2`);
  });

  it("offers recovery when a result is saved without its routine, then shows the repaired routine", async () => {
    // Arrange: an outdated API saves the result but returns no plan; reopening it returns the repaired plan.
    global.fetch = router({
      "POST /api/quiz/skincare": () => json({ result: { id: "s-1", result: "Oily Skin" } }, 201),
      "GET /api/quiz/skincare/s-1": () => json({ result: { id: "s-1", result: "Oily Skin", plan } }),
    });
    // Act
    await act(async () => { render(<QuizResult kind="skincare" />); });
    // Assert: no false success message, and a recovery action instead.
    expect(await screen.findByText(/couldn.t load your personalised routine/)).toBeInTheDocument();
    expect(screen.queryByText("Saved to your results journal.")).not.toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Try again" })); });
    expect(await screen.findByRole("tab", { name: /Morning/ })).toBeInTheDocument();
  });

  it("knows which documents are complete", () => {
    expect(hasRecommendations("skincare", { id: "a", plan })).toBe(true);
    expect(hasRecommendations("skincare", { id: "a" })).toBe(false);
    expect(hasRecommendations("body", { id: "b", styling: { items: [] } })).toBe(false);
    expect(hasRecommendations("face", { id: "c", styling: fixtures.faceMenPrompt })).toBe(true);
  });
});

describe("saved routine checklist", () => {
  it("saves ticks to the account and rolls back with a message when saving fails", async () => {
    let fail = false;
    global.fetch = router({ "PUT /api/quiz/skincare/s-2/progress": () => (fail ? json({}, 503) : json({ user_state: {} })) });
    render(<ResultView kind="skincare" doc={{ id: "s-2", result: "Oily Skin", plan, user_state: { checklist: { "am-cleanse": true } } }} />);
    const morning = screen.getByRole("tabpanel", { name: /Morning/ });
    expect(within(morning).getByRole("checkbox", { name: /Cleanse gently/ })).toBeChecked();
    // Act: tick a step
    await act(async () => { fireEvent.click(within(morning).getByRole("checkbox", { name: /Moisturise/ })); });
    const put = global.fetch.mock.calls.find(([url]) => url.endsWith("/progress"));
    expect(JSON.parse(put[1].body)).toEqual({ checklist: { "am-moisturise": true } });
    expect(within(morning).getByText("2/4 done")).toBeInTheDocument();
    // Act: a failed save is undone and explained
    fail = true;
    await act(async () => { fireEvent.click(within(morning).getByRole("checkbox", { name: /Hydrate/ })); });
    expect(within(morning).getByRole("checkbox", { name: /Hydrate/ })).not.toBeChecked();
    expect(within(morning).getByRole("alert")).toHaveTextContent(/couldn.t save that change/);
  });

  it("groups products by function and explains their ingredients", () => {
    global.fetch = router({});
    render(<ResultView kind="skincare" doc={{ id: "s-3", result: "Oily Skin", plan }} />);
    ["Cleanse", "Hydrate", "Treat", "Moisturise", "Protect"].forEach((group) => expect(screen.getByRole("heading", { name: group })).toBeInTheDocument());
    expect(screen.getByText("Niacinamide (10%)")).toBeInTheDocument();
  });
});

describe("face hairstyle studio", () => {
  it("filters every suggested hairstyle by length and upkeep, with counts and a reset", async () => {
    global.fetch = router({ "GET /api/favorites": () => json({ favorites: [] }) });
    render(<ResultView kind="face" doc={{ id: "f-1", result: "Round", styling: fixtures.faceMen }} />);
    const all = [...fixtures.faceMen.hair, ...fixtures.faceMen.hair_alternatives];
    const short = all.filter((card) => card.lengths.includes("short"));
    // Act
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Short ${short.length}$`) }));
    // Assert
    expect(screen.getByRole("heading", { name: "Matching hairstyles" })).toBeInTheDocument();
    short.forEach((card) => expect(screen.getByRole("heading", { name: card.title })).toBeInTheDocument());
    const longOnly = all.filter((card) => !card.lengths.includes("short"));
    longOnly.forEach((card) => expect(screen.queryByRole("heading", { name: card.title })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^Any length/ }));
    expect(screen.getByRole("heading", { name: "Recommended for you" })).toBeInTheDocument();
  });
});

describe("AI stylist notes", () => {
  it("generates notes on request and shows them on the matching cards", async () => {
    const first = fixtures.bodyMen.items[0];
    global.fetch = router({
      "GET /api/favorites": () => json({ favorites: [] }),
      "POST /api/quiz/body-shape/b-1/insights": () => json({ insights: { summary: "Structure on top balances a Pear frame nicely.", notes: { [first.id]: "A clean base that draws the eye up." }, tips: ["Keep trousers straight."], catalog: "menswear", generated_at: "2026-10-27T10:00:00" } }),
    });
    render(<ResultView kind="body" doc={{ id: "b-1", result: "Pear", styling: fixtures.bodyMen }} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Explain my recommendations" })); });
    expect(screen.getByText("Structure on top balances a Pear frame nicely.")).toBeInTheDocument();
    const card = screen.getByRole("heading", { name: first.title }).closest("article");
    expect(within(card).getByText("A clean base that draws the eye up.")).toBeInTheDocument();
  });

  it("explains a failure without hiding the recommendations", async () => {
    global.fetch = router({ "GET /api/favorites": () => json({ favorites: [] }), "POST /api/quiz/body-shape/b-2/insights": () => json({ errorCode: "provider_unavailable" }, 503) });
    render(<ResultView kind="body" doc={{ id: "b-2", result: "Pear", styling: fixtures.bodyMen }} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Explain my recommendations" })); });
    expect(screen.getByText(/resting for now.*Your recommendations below are unaffected/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Blazers" })).toBeInTheDocument();
  });
});

describe("trending now", () => {
  it("shows dated publisher articles with the words that matched", async () => {
    global.fetch = router({ "GET /api/quiz/body-shape/b-3/trends": () => json({ status: "ok", items: [{ title: "The Barn Jacket Is Back", summary: "A fall staple.", url: "https://www.harpersbazaar.com/a", publisher: "Harper's Bazaar", published_at: "2026-10-26T09:00:00Z", matched: ["jacket", "outfit"] }], sources: [{ publisher: "Harper's Bazaar", retrieved_at: "2026-10-27T08:00:00Z", stale: false }], evergreen: [], note: "Latest articles from the publishers' official RSS feeds." }) });
    render(<TrendsPanel kind="body" resultType="body-shape" resultId="b-3" />);
    const link = await screen.findByRole("link", { name: /The Barn Jacket Is Back/ });
    expect(link).toHaveAttribute("href", "https://www.harpersbazaar.com/a");
    expect(screen.getByText(/26 Oct 2026/)).toBeInTheDocument();
    expect(screen.getByText(/it mentions jacket, outfit/)).toBeInTheDocument();
    expect(screen.getByText(/Feeds checked: Harper's Bazaar/)).toBeInTheDocument();
    expect(screen.queryByText(/Evergreen idea/)).not.toBeInTheDocument();
  });

  it("labels evergreen ideas as not current when nothing matches", async () => {
    global.fetch = router({ "GET /api/quiz/face-shape/f-9/trends": () => json({ status: "no_matches", items: [], sources: [{ publisher: "GQ", retrieved_at: "2026-10-27T08:00:00Z", stale: true }], evergreen: [{ title: "Shape the sides first", tip: "Ask your barber." }], note: "n" }) });
    render(<TrendsPanel kind="face" resultType="face-shape" resultId="f-9" />);
    expect(await screen.findByText(/evergreen ideas — timeless styling advice, not current trends/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Shape the sides first" })).toBeInTheDocument();
    expect(screen.getByText(/GQ \(.*last saved copy\)/)).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("offers a working retry when the feeds can't be reached", async () => {
    let calls = 0;
    global.fetch = router({ "GET /api/quiz/body-shape/b-4/trends": () => { calls += 1; return calls === 1 ? Promise.reject(new Error("offline")) : json({ status: "unavailable", items: [], sources: [], evergreen: [{ title: "Balance volume", tip: "One roomy piece." }] }); } });
    render(<TrendsPanel kind="body" resultType="body-shape" resultId="b-4" />);
    const retry = await screen.findByRole("button", { name: "Try again" });
    await act(async () => { fireEvent.click(retry); });
    expect(await screen.findByText(/aren't reachable right now/)).toBeInTheDocument();
    expect(calls).toBe(2);
  });
});

it("computes colour-wheel harmonies", () => {
  expect(harmonies("#FF0000")).toEqual({ complementary: ["#00FFFF"], analogous: ["#FF0080", "#FF8000"] });
  expect(harmonies("not-a-color")).toBeNull();
});
