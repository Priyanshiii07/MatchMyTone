jest.mock("next/headers", () => ({ cookies: jest.fn() }));

const { normalizeApiBase } = require("./auth");

it.each([
  ["https://matchmytone-wwzo.onrender.com/api", "https://matchmytone-wwzo.onrender.com/api"],
  ["https://matchmytone-wwzo.onrender.com/api/", "https://matchmytone-wwzo.onrender.com/api"],
  ["https://matchmytone-wwzo.onrender.com", "https://matchmytone-wwzo.onrender.com/api"],
  ["  matchmytone-wwzo.onrender.com/api \n", "https://matchmytone-wwzo.onrender.com/api"],
  ['"https://matchmytone-wwzo.onrender.com/api"', "https://matchmytone-wwzo.onrender.com/api"],
  ["127.0.0.1:5000/api", "http://127.0.0.1:5000/api"],
  ["", ""],
])("normalises the API base URL %p", (input, expected) => {
  // Arrange / Act / Assert
  expect(normalizeApiBase(input)).toBe(expected);
});
