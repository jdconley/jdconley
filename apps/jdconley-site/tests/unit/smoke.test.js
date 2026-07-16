import { describe, expect, it } from "vitest";

describe("unit harness", () => {
  it("runs ESM tests", () => expect(import.meta.url).toContain("smoke.test.js"));
});
