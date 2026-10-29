import { describe, expect, it } from "vitest";
import { oppositeOutsidePosition, outsidePosition } from "./tokenAnimation.js";

describe("animación de cruce de extremos", () => {
  it("sale por un extremo y se reposiciona oculta en el extremo opuesto", () => {
    expect(outsidePosition({ row: 4, col: 0 })).toEqual({ row: 4, col: -1 });
    expect(oppositeOutsidePosition({ row: 4, col: 8 })).toEqual({ row: 4, col: 9 });
    expect(outsidePosition({ row: 4, col: 8 })).toEqual({ row: 4, col: 9 });
    expect(oppositeOutsidePosition({ row: 4, col: 0 })).toEqual({ row: 4, col: -1 });
  });
});
