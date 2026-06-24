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

  it("tags added lines with type 'add'", () => {
    const rows = mapUnifiedDiff(`diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,1 +1,2 @@
 const a = 1;
+const b = 2;
`);

    expect(rows).toContainEqual(
      expect.objectContaining({ type: "add", content: "const b = 2;", side: "RIGHT" }),
    );
  });

  it("tags removed lines with type 'del'", () => {
    const rows = mapUnifiedDiff(`diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,1 @@
 const a = 1;
-const b = 2;
`);

    expect(rows).toContainEqual(
      expect.objectContaining({ type: "del", content: "const b = 2;", side: "LEFT" }),
    );
  });

  it("tags context lines with type 'context'", () => {
    const rows = mapUnifiedDiff(`diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,2 @@
 const a = 1;
-const b = 2;
+const b = 3;
`);

    expect(rows).toContainEqual(
      expect.objectContaining({ type: "context", content: "const a = 1;" }),
    );
  });
});
