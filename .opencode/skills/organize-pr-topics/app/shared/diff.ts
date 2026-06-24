export type DiffSide = "LEFT" | "RIGHT";

export type DiffCommentTarget = {
  path: string;
  line: number;
  side: DiffSide;
  content: string;
};

export function mapUnifiedDiff(diff: string): DiffCommentTarget[] {
  const rows: DiffCommentTarget[] = [];
  let currentPath = "";
  let oldLine = 0;
  let newLine = 0;

  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      currentPath = match?.[2] ?? currentPath;
      continue;
    }

    if (line.startsWith("@@")) {
      const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = Number(match[1]);
        newLine = Number(match[2]);
      }
      continue;
    }

    if (!currentPath || line.startsWith("---") || line.startsWith("+++")) {
      continue;
    }

    if (line.startsWith("+")) {
      rows.push({ path: currentPath, line: newLine, side: "RIGHT", content: line.slice(1) });
      newLine += 1;
      continue;
    }

    if (line.startsWith("-")) {
      rows.push({ path: currentPath, line: oldLine, side: "LEFT", content: line.slice(1) });
      oldLine += 1;
      continue;
    }

    if (line.startsWith(" ")) {
      rows.push({ path: currentPath, line: newLine, side: "RIGHT", content: line.slice(1) });
      oldLine += 1;
      newLine += 1;
    }
  }

  return rows;
}
