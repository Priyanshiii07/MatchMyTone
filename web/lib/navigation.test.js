import { isInternalPath, previousSafePath, readHistory, recordVisit } from "./navigation";

describe("recordVisit", () => {
  it("pushes new pages and ignores repeats of the current page", () => {
    // Arrange
    const history = ["/dashboard"];
    // Act
    const next = recordVisit(recordVisit(history, "/results"), "/results");
    // Assert
    expect(next).toEqual(["/dashboard", "/results"]);
  });

  it("pops when the user returns to the previous page", () => {
    expect(recordVisit(["/dashboard", "/results", "/results/color/1"], "/results")).toEqual(["/dashboard", "/results"]);
  });

  it("ignores external and protocol-relative paths", () => {
    expect(recordVisit(["/dashboard"], "https://evil.example")).toEqual(["/dashboard"]);
    expect(recordVisit(["/dashboard"], "//evil.example")).toEqual(["/dashboard"]);
  });
});

describe("previousSafePath", () => {
  it("returns the previous in-app page when the current page is on top", () => {
    expect(previousSafePath(["/dashboard", "/results"], "/results")).toBe("/dashboard");
  });

  it("has no target for a direct deep link (no history)", () => {
    expect(previousSafePath(["/results/color/1"], "/results/color/1")).toBeNull();
    expect(previousSafePath([], "/profile")).toBeNull();
  });

  it("never sends an app page back into the login flow", () => {
    expect(previousSafePath(["/login?next=%2Fdashboard", "/dashboard"], "/dashboard")).toBeNull();
  });

  it("only allows public targets from public pages", () => {
    expect(previousSafePath(["/", "/login"], "/login", "public")).toBe("/");
    expect(previousSafePath(["/dashboard", "/login"], "/login", "public")).toBeNull();
  });

  it("ignores history that does not end at the current page", () => {
    expect(previousSafePath(["/dashboard", "/results"], "/profile")).toBeNull();
  });
});

describe("readHistory", () => {
  it("tolerates corrupt storage", () => {
    const storage = { getItem: () => "{not json" };
    expect(readHistory(storage)).toEqual([]);
  });

  it("drops unsafe stored entries", () => {
    const storage = { getItem: () => JSON.stringify(["/dashboard", "https://x.test", 4]) };
    expect(readHistory(storage)).toEqual(["/dashboard"]);
    expect(isInternalPath("/\\evil")).toBe(false);
  });
});
