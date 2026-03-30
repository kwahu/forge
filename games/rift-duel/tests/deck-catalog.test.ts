import { describe, expect, it } from "vitest";
import { getDeckCatalogForApi, starterDeck } from "../src/cards.js";

describe("getDeckCatalogForApi", () => {
  it("sumuje się do tej samej liczby co starterDeck", () => {
    const cat = getDeckCatalogForApi();
    const sum = cat.breakdown.reduce((a, b) => a + b.count, 0);
    expect(sum).toBe(starterDeck().length);
    expect(cat.totalCardsPerPlayer).toBe(20);
  });
});
