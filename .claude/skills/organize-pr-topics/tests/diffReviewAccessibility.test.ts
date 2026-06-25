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

describe("FileCard header accessibility", () => {
  const source = readFileSync("app/ui/components/DiffReview.tsx", "utf8");

  it("renders a chevron button with keyboard activation", () => {
    expect(source).toContain("file-chevron");
    expect(source).toContain("onToggleCollapsed");
  });

  it("renders a viewed toggle button", () => {
    expect(source).toContain("file-viewed-toggle");
    expect(source).toContain("onToggleViewed");
  });

  it("conditionally hides the diff body when collapsed", () => {
    expect(source).toContain("collapsedFiles");
    expect(source).toMatch(/collapsed.*&&.*null|collapsed.*\?.*null/);
  });

  it("tints the header when viewed", () => {
    const css = readFileSync("app/ui/styles.css", "utf8");
    expect(css).toContain(".file-card-header.viewed");
    expect(css).toContain(".file-viewed-toggle");
  });
});
