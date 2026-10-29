import { act, fireEvent, render, screen } from "@testing-library/react";
import fixtures from "../../lib/__fixtures__/styling.json";
import QuizResult from "./QuizResult";
import SkincareResultView from "./SkincareResultView";

jest.mock("next/navigation", () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), usePathname: () => "/analyses/skincare/result" }));

const plan = fixtures.skincareShaving;

it("shows morning and evening routine tabs built from the plan", () => {
  // Arrange / Act
  render(<SkincareResultView skinType="Oily Skin" plan={plan} resultId="s1" />);
  // Assert
  const morningTab = screen.getByRole("tab", { name: /Morning/ });
  expect(morningTab).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tabpanel", { name: /Morning/ })).toHaveTextContent("Protect with sunscreen");
  fireEvent.click(screen.getByRole("tab", { name: /Evening/ }));
  expect(screen.getByRole("tabpanel", { name: /Evening/ })).toHaveTextContent("Treat (one active only)");
});

it("adds shaving and beard care only because the user ticked them", () => {
  render(<SkincareResultView skinType="Oily Skin" plan={plan} resultId="s1" />);
  expect(screen.getByRole("heading", { name: "Shaving care" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Beard-area care" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Makeup removal" })).not.toBeInTheDocument();
  plan.cautions.forEach((caution) => expect(screen.getByText(caution)).toBeInTheDocument());
});

it("shows only https product links", () => {
  const unsafe = { ...plan, products: [{ ...plan.products[0], href: "javascript:alert(1)" }] };
  render(<SkincareResultView skinType="Oily Skin" plan={unsafe} resultId="s1" />);
  expect(screen.queryByRole("link", { name: /official site/ })).not.toBeInTheDocument();
});

describe("live questionnaire result", () => {
  const answers = Object.fromEntries(Array.from({ length: 10 }, (_, index) => [index + 1, { label: "A", text: "Oily" }]));

  beforeEach(() => {
    window.history.replaceState({}, "", `/analyses/skincare/result?answers=${encodeURIComponent(JSON.stringify(answers))}&rid=req-1&extras=shaving,beard`);
  });

  it("saves once with the routine extras and renders the server's plan", async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 201, json: async () => ({ result: { id: "s-9", result: "Oily Skin", plan } }) }));
    await act(async () => { render(<QuizResult kind="skincare" />); });
    expect(await screen.findByRole("heading", { name: "Oily Skin" })).toBeInTheDocument();
    const saves = global.fetch.mock.calls.filter(([url]) => url === "/api/quiz/skincare");
    expect(saves).toHaveLength(1);
    const [, options] = saves[0];
    expect(JSON.parse(options.body)).toMatchObject({ result: "Oily Skin", request_id: "req-1", routine_extras: ["shaving", "beard"] });
    expect(screen.getByText("Saved to your results journal.")).toBeInTheDocument();
  });

  it("offers a retry instead of showing invented recommendations when saving fails", async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 503, json: async () => ({ error: "down" }) }));
    await act(async () => { render(<QuizResult kind="skincare" />); });
    expect(await screen.findByText(/couldn.t save your routine yet/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Products in your routine" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
