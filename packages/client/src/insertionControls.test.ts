import { describe, expect, it } from "vitest";
import { isReverseInsertion } from "./insertionControls.js";

describe("controles de inserción", () => {
  it("bloquea sólo la inserción inversa inmediata", () => {
    const previous = { axis: "row", index: 3, from: "left" } as const;
    expect(isReverseInsertion(previous, { axis: "row", index: 3, from: "right" })).toBe(true);
    expect(isReverseInsertion(previous, { axis: "row", index: 5, from: "right" })).toBe(false);
    expect(isReverseInsertion(previous, { axis: "column", index: 3, from: "bottom" })).toBe(false);
    expect(isReverseInsertion(undefined, previous)).toBe(false);
  });
});
