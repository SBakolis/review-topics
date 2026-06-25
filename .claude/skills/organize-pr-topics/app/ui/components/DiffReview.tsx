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
  viewedFiles: string[];
  collapsedFiles: string[];
  onToggleViewed: (path: string, viewed: boolean) => void;
  onToggleCollapsed: (path: string, collapsed: boolean) => void;
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

export function DiffReview({
  session,
  theme,
  topic,
  viewedFiles,
  collapsedFiles,
  onToggleViewed,
  onToggleCollapsed,
  onCommentSaved,
}: Props) {
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
          viewed={viewedFiles.includes(file)}
          collapsed={collapsedFiles.includes(file)}
          onToggleViewed={onToggleViewed}
          onToggleCollapsed={onToggleCollapsed}
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
  viewed: boolean;
  collapsed: boolean;
  onToggleViewed: (path: string, viewed: boolean) => void;
  onToggleCollapsed: (path: string, collapsed: boolean) => void;
  onCommentSaved: () => void;
};

function FileCard({
  file,
  rows,
  theme,
  topicId,
  viewed,
  collapsed,
  onToggleViewed,
  onToggleCollapsed,
  onCommentSaved,
}: FileCardProps) {
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

  const toggleCollapse = () => {
    onToggleCollapsed(file, !collapsed);
  };

  const handleHeaderKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleCollapse();
    }
  };

  const toggleViewed = () => {
    onToggleViewed(file, !viewed);
  };

  return (
    <section className="file-card">
      <header
        className={`file-card-header${viewed ? " viewed" : ""}`}
        onClick={toggleCollapse}
        onKeyDown={handleHeaderKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
      >
        <span className="file-chevron" aria-hidden="true">
          {collapsed ? "▶" : "▼"}
        </span>
        <span className="file-path">{file}</span>
        <label
          className={`file-viewed-toggle${viewed ? " checked" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <input
            type="checkbox"
            checked={viewed}
            onChange={toggleViewed}
            onClick={(event) => event.stopPropagation()}
          />
          Viewed
        </label>
      </header>
      {collapsed ? null : rows.length === 0 ? (
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
