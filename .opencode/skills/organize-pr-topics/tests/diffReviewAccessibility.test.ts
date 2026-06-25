import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DiffReview row accessibility", () => {
  it("supports keyboard activation for button-like diff rows", () => {
    const source = readFileSync("app/ui/components/DiffReview.tsx", "utf8");

    expect(source).toContain("onKeyDown");
    expect(source).toContain('event.key === "Enter"');
    expect(source).toContain('event.key === " "');
  });
});
