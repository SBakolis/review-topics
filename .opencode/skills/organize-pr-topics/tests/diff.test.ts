import { describe, expect, it } from "vitest";
import { mapUnifiedDiff } from "../app/shared/diff";

describe("mapUnifiedDiff", () => {
  it("maps added lines to RIGHT side", () => {
    const rows = mapUnifiedDiff(`diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,3 @@
 const a = 1;
+const b = 2;
 const c = 3;
`);

    expect(rows).toContainEqual(
      expect.objectContaining({ path: "src/a.ts", line: 2, side: "RIGHT", content: "const b = 2;" }),
    );
  });

  it("maps removed lines to LEFT side", () => {
    const rows = mapUnifiedDiff(`diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,2 @@
 const a = 1;
-const b = 2;
 const c = 3;
`);

    expect(rows).toContainEqual(
      expect.objectContaining({ path: "src/a.ts", line: 2, side: "LEFT", content: "const b = 2;" }),
    );
  });

  it("maps context lines across multiple hunks", () => {
    const rows = mapUnifiedDiff(`diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,2 @@
 const a = 1;
-const b = 2;
+const b = 3;
@@ -10,2 +10,3 @@
 const j = 10;
+const k = 11;
 const l = 12;
`);

    expect(rows).toContainEqual(
      expect.objectContaining({ path: "src/a.ts", line: 10, side: "RIGHT", content: "const j = 10;" }),
    );
    expect(rows).toContainEqual(
      expect.objectContaining({ path: "src/a.ts", line: 11, side: "RIGHT", content: "const k = 11;" }),
    );
  });
});
