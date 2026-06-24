import { useState } from "react";
import type { ReviewSession, ReviewTopic } from "../../shared/schema";
import { mapUnifiedDiff, type DiffCommentTarget } from "../../shared/diff";
import { CommentComposer } from "./CommentComposer";

type Props = {
  session: ReviewSession;
  topic: ReviewTopic;
  onCommentSaved: () => void;
};

type LineTarget = {
  line: number;
  side: "LEFT" | "RIGHT";
};

function signForRow(row: DiffCommentTarget): string {
  if (row.type === "add") return "+";
  if (row.type === "del") return "-";
  return " ";
}

export function DiffReview({ session, topic, onCommentSaved }: Props) {
  const rowsByFile = topic.files.reduce<Record<string, DiffCommentTarget[]>>(
    (acc, file) => {
      acc[file] = [];
      return acc;
    },
    {},
  );

  for (const row of mapUnifiedDiff(session.diff)) {
    if (rowsByFile[row.path]) {
      rowsByFile[row.path].push(row);
    }
  }

  return (
    <div className="diff-review">
      {topic.files.map((file) => (
        <FileCard
          file={file}
          rows={rowsByFile[file] ?? []}
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
  rows: DiffCommentTarget[];
  topicId: string;
  onCommentSaved: () => void;
};

function FileCard({ file, rows, topicId, onCommentSaved }: FileCardProps) {
  const [activeTarget, setActiveTarget] = useState<LineTarget | null>(null);

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
