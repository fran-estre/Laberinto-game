import { describe, expect, it } from "vitest";
import { adjacentPosition, directionForKey } from "./keyboardControls.js";

describe("controles de movimiento por teclado", () => {
  it("mapea las cuatro flechas a direcciones del motor", () => {
    expect(directionForKey("ArrowUp")).toBe("N");
    expect(directionForKey("ArrowRight")).toBe("E");
    expect(directionForKey("ArrowDown")).toBe("S");
    expect(directionForKey("ArrowLeft")).toBe("W");
    expect(directionForKey("Enter")).toBeUndefined();
  });

  it("calcula una celda adyacente y respeta los extremos conectados", () => {
    expect(adjacentPosition({ row: 0, col: 4 }, "N")).toEqual({ row: 8, col: 4 });
    expect(adjacentPosition({ row: 4, col: 8 }, "E")).toEqual({ row: 4, col: 0 });
    expect(adjacentPosition({ row: 4, col: 4 }, "S")).toEqual({ row: 5, col: 4 });
    expect(adjacentPosition({ row: 4, col: 4 }, "W")).toEqual({ row: 4, col: 3 });
  });
});
