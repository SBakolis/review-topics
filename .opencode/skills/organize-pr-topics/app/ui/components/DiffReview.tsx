import { useState } from "react";
import type { ReviewSession, ReviewTopic } from "../../shared/schema";
import { CommentComposer } from "./CommentComposer";

type Props = {
  session: ReviewSession;
  topic: ReviewTopic;
  onCommentSaved: () => void;
};

type ParsedRow = {
  type: "add" | "del" | "context";
  line: number;
  side: "LEFT" | "RIGHT";
  content: string;
};

type LineTarget = {
  line: number;
  side: "LEFT" | "RIGHT";
};

function extractFileDiff(diff: string, filePath: string): string {
  const marker = `diff --git a/${filePath} b/${filePath}`;
  const startIndex = diff.indexOf(marker);
  if (startIndex === -1) {
    return "";
  }

  const nextDiffIndex = diff.indexOf("diff --git", startIndex + marker.length);
  const endIndex = nextDiffIndex === -1 ? diff.length : nextDiffIndex;
  return diff.slice(startIndex, endIndex).trimEnd();
}

function parseFileDiff(diff: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  let oldLine = 0;
  let newLine = 0;
  let started = false;

  for (const line of diff.split("\n")) {
    if (line.startsWith("@@")) {
      const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = Number(match[1]);
        newLine = Number(match[2]);
        started = true;
      }
      continue;
    }

    if (!started || line.startsWith("---") || line.startsWith("+++")) {
      continue;
    }

    if (line.startsWith("+")) {
      rows.push({ type: "add", line: newLine, side: "RIGHT", content: line.slice(1) });
      newLine += 1;
      continue;
    }

    if (line.startsWith("-")) {
      rows.push({ type: "del", line: oldLine, side: "LEFT", content: line.slice(1) });
      oldLine += 1;
      continue;
    }

    if (line.startsWith(" ")) {
      rows.push({ type: "context", line: newLine, side: "RIGHT", content: line.slice(1) });
      oldLine += 1;
      newLine += 1;
    }
  }

  return rows;
}

function signForRow(row: ParsedRow): string {
  if (row.type === "add") return "+";
  if (row.type === "del") return "-";
  return " ";
}

export function DiffReview({ session, topic, onCommentSaved }: Props) {
  return (
    <div className="diff-review">
      {topic.files.map((file) => (
        <FileCard
          file={file}
          fileDiff={extractFileDiff(session.diff, file)}
          key={file}
          topicId={topic.id}
          onCommentSaved={onCommentSaved}
        />
      ))}
    </div>
  );
}

type FileCardProps = {
  file: string;
  fileDiff: string;
  topicId: string;
  onCommentSaved: () => void;
};

function FileCard({ file, fileDiff, topicId, onCommentSaved }: FileCardProps) {
  const [activeTarget, setActiveTarget] = useState<LineTarget | null>(null);
  const rows = fileDiff ? parseFileDiff(fileDiff) : [];

  return (
    <section className="file-card">
      <header className="file-card-header">{file}</header>
      {rows.length === 0 ? (
        <p className="file-diff-empty">No diff available for {file}.</p>
      ) : (
        <div className="file-diff">
          {rows.map((row, index) => {
            const isActive =
              activeTarget?.line === row.line && activeTarget?.side === row.side;
            return (
              <div className="diff-row-group" key={`${row.side}:${row.line}:${index}`}>
                <div
                  className={`diff-row${isActive ? " selected" : ""}`}
                  onClick={() =>
                    setActiveTarget(isActive ? null : { line: row.line, side: row.side })
                  }
                  role="button"
                  tabIndex={0}
                >
                  <span className="diff-line-number">{row.line}</span>
                  <span className={`diff-sign diff-sign-${row.type}`}>{signForRow(row)}</span>
                  <span className="diff-content">{row.content || "\u00a0"}</span>
                </div>
                {isActive ? (
                  <CommentComposer
                    topicId={topicId}
                    path={file}
                    line={activeTarget.line}
                    side={activeTarget.side}
                    onSaved={() => {
                      setActiveTarget(null);
                      onCommentSaved();
                    }}
                  />
                ) : null}
              </div>
            );
          })}
          <CommentComposer topicId={topicId} path={file} onSaved={onCommentSaved} />
        </div>
      )}
    </section>
  );
}
