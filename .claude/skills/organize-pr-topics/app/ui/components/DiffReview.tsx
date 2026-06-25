import { useEffect, useState } from "react";
import type { ReviewSession, ReviewTopic } from "../../shared/schema";
import { mapUnifiedDiff, type DiffCommentTarget } from "../../shared/diff";
import type { Theme } from "../theme";
import {
  detectLanguage,
  highlightLine,
  highlightPlainText,
  type HighlightToken,
} from "../syntaxHighlight";
import { CommentComposer } from "./CommentComposer";

type Props = {
  session: ReviewSession;
  theme: Theme;
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

export function DiffReview({ session, theme, topic, onCommentSaved }: Props) {
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
          theme={theme}
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
  theme: Theme;
  topicId: string;
  onCommentSaved: () => void;
};

function FileCard({ file, rows, theme, topicId, onCommentSaved }: FileCardProps) {
  const [activeTarget, setActiveTarget] = useState<LineTarget | null>(null);
  const [highlightedRows, setHighlightedRows] = useState<Record<number, HighlightToken[]>>({});

  useEffect(() => {
    let cancelled = false;
    const language = detectLanguage(file);

    async function loadHighlightedRows() {
      const entries = await Promise.all(
        rows.map(async (row, index) => [
          index,
          await highlightLine(row.content, language, theme),
        ] as const),
      );

      if (!cancelled) {
        setHighlightedRows(Object.fromEntries(entries));
      }
    }

    setHighlightedRows(
      Object.fromEntries(rows.map((row, index) => [index, highlightPlainText(row.content)])),
    );
    void loadHighlightedRows();

    return () => {
      cancelled = true;
    };
  }, [file, rows, theme]);

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
            const tokens = highlightedRows[index] ?? highlightPlainText(row.content);
            const toggleCommentComposer = () => {
              setActiveTarget(isActive ? null : { line: row.line, side: row.side });
            };
            return (
              <div className="diff-row-group" key={`${row.side}:${row.line}:${index}`}>
                <div
                  className={`diff-row${isActive ? " selected" : ""}`}
                  onClick={toggleCommentComposer}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleCommentComposer();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span className="diff-line-number">{row.line}</span>
                  <span className={`diff-sign diff-sign-${row.type}`}>{signForRow(row)}</span>
                  <span className="diff-content">
                    {tokens.map((token, tokenIndex) => (
                      <span
                        className="syntax-token"
                        key={`${token.content}:${tokenIndex}`}
                        style={token.color ? { color: token.color } : undefined}
                      >
                        {token.content}
                      </span>
                    ))}
                  </span>
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
