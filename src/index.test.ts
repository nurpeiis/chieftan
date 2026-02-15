import { describe, it, expect } from "vitest";
import { VERSION } from "./version.js";

describe("chieftan", () => {
  it("exports version", () => {
    expect(VERSION).toBe("0.1.0");
  });
});
