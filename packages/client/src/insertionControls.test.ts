import { describe, expect, it } from "vitest";
import { insertionShift, isReverseInsertion } from "./insertionControls.js";

describe("controles de inserción", () => {
  it("bloquea sólo la inserción inversa inmediata", () => {
    const previous = { axis: "row", index: 3, from: "left" } as const;
    expect(isReverseInsertion(previous, { axis: "row", index: 3, from: "right" })).toBe(true);
    expect(isReverseInsertion(previous, { axis: "row", index: 5, from: "right" })).toBe(false);
    expect(isReverseInsertion(previous, { axis: "column", index: 3, from: "bottom" })).toBe(false);
    expect(isReverseInsertion(undefined, previous)).toBe(false);
  });

  it("desplaza visualmente la fila o columna en la dirección de entrada", () => {
    expect(insertionShift({ axis: "row", index: 1, from: "left" })).toEqual({ x: -1, y: 0 });
    expect(insertionShift({ axis: "row", index: 1, from: "right" })).toEqual({ x: 1, y: 0 });
    expect(insertionShift({ axis: "column", index: 1, from: "top" })).toEqual({ x: 0, y: -1 });
    expect(insertionShift({ axis: "column", index: 1, from: "bottom" })).toEqual({ x: 0, y: 1 });
  });
});
